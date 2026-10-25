// Dan AI — answers like Dan, for the member asking.
// Pipeline: auth/mode → Brain (cached) → member context + DERIVED (code) → PLAN (Haiku)
//   → RETRIEVE (scored, privacy-filtered) → DRAFT (Sonnet) → CHECK (Sonnet) → code GUARDRAILS.
// Modes: MEMBER (asker), ADMIN (optional "Context from" member), TEST (admin + synthetic persona).
// Debug is returned to admins only. Test actions: test / grade / finalize (admin only).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { timing, relevantExcerpt, checkerResult, type Timing } from "./performance.ts";
import { joinChunks } from "../_shared/danBrain.ts";
import { isCronCall } from "../_shared/cron.ts";
import type { ContextAnswers } from "../_shared/contextRoom.ts";
import { buildMemberBlock, type MemberInput } from "./context.ts";
import { loadExtras, nextBuildTask } from "./dossier.ts";
import { bestRecording } from "./recordings.ts";
import { buildTaskTitle, isFocusQuestion, loadBuildHelp } from "./buildHelp.ts";
import { IG_REFRESH_MS, cleanHandle, fetchProfile, fetchRecentPosts } from "./instagram.ts";
import { persona } from "./testPersonas.ts";
import { gateFromLabel, missingRules, mustSay } from "./mustSay.ts";
import { signals } from "./signals.ts";
import { guideFor, prescribe, workshopGuideText } from "./workshops.ts";
import { loadRoster, ROSTER_PROMPT } from "./roster.ts";
import { situationBlock } from "./playbook.ts";
import { BRAIN_HEADER, BUILD_HELP_FORMAT, FOCUS_FORMAT, STEP_PROMPT, CHECKER_PROMPT, FLAG_REPLY, GRADER_PROMPT, MEMORY_PROMPT, NAME_FALLBACK, PLAN_PROMPT, draftPrompt } from "./prompts.ts";
import { findBanned, findNames, limitBro, hasCostPerClient, looksTruncated, matchResource, nameTokens, redact, repairCostPerClient, wordCount } from "./guardrails.ts";

const SONNET = "claude-sonnet-5-5";
const HAIKU = "claude-haiku-5-5";
// Thinking off for speed. Sonnet 5.5 rejects "disabled" (400); "between_tools" is its off switch.
const THINKING_OFF: Record<string, { type: string }> = { [SONNET]: { type: "between_tools" } };
const SOURCE_TAGS: Record<string, string> = {
  teaching: "Workshop/Q&A", transcript: "Training", note: "Note", whatsapp: "Dan in WhatsApp", call: "1:1 call",
};
const GROUP_CALL = /momentum|q&a|q & a|workshop|hot seat|powerup|power up|pay to play|edit flow/i;

type Point = { do: string; why: string };
type Answer = { answer: string; points: Point[]; note: string | null; resource: string | null; resource_why?: string | null };
type Turn = { role: "user" | "assistant"; content: string };
type Block = { type: "text"; text: string; cache_control?: { type: "ephemeral" } };
type Plan = {
  topic?: string; is_boundary?: boolean; asks_about_other_member?: boolean; search_terms?: string[]; member_facts_needed?: string[]; gate_relevant?: boolean;
  /** What they actually need, read past the brain dump. */
  core_problem?: string;
  /** "one": a single fix answers it; "steps": it genuinely needs ordered steps. */
  shape?: "one" | "steps";
  /** False for a general business question that isn't about Dan's gates, roadmap or build tasks. */
  program_related?: boolean;
};
// deno-lint-ignore no-explicit-any
type DB = any;

// ---------- JSON helpers ----------
function stripFence(raw: string) {
  return raw.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
}
function parseJson(raw: string): Record<string, unknown> | null {
  const cleaned = stripFence(raw);
  try { return JSON.parse(cleaned); } catch { /* next */ }
  const m = cleaned.match(/\{[\s\S]*\}/);
  if (m) {
    try { return JSON.parse(m[0]); } catch { /* next */ }
    // Raw newlines inside strings: escape them and retry.
    try { return JSON.parse(m[0].replace(/"(?:[^"\\]|\\.)*"/g, s => s.replace(/\n/g, "\\n"))); } catch { /* invalid */ }
  }
  return null;
}
function toAnswer(v: unknown): Answer | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const answer = String(o.answer ?? "").trim();
  if (!answer) return null;
  let points: Point[] = [];
  if (Array.isArray(o.points)) {
    points = o.points.map(p => {
      if (p && typeof p === "object") {
        const po = p as Record<string, unknown>;
        return { do: String(po.do ?? "").trim(), why: String(po.why ?? "").trim() };
      }
      return { do: String(p ?? "").trim(), why: "" };
    }).filter(p => p.do).slice(0, 4);
  } else if (Array.isArray(o.next_steps)) {
    // Legacy shape from older chats: plain action strings become points without a reason.
    points = o.next_steps.map(String).filter(Boolean).slice(0, 4).map(s => ({ do: s, why: "" }));
  }
  return {
    answer,
    points,
    note: o.note && o.note !== "null" ? String(o.note) : null,
    resource: o.resource && o.resource !== "null" ? String(o.resource) : null,
    resource_why: typeof o.resource_why === "string" && o.resource_why.trim() && o.resource_why !== "null" ? o.resource_why.trim().slice(0, 200) : null,
  };
}
const fullText = (a: Answer) => [a.answer, ...a.points.map(p => `${p.do} ${p.why}`), a.note ?? ""].join("\n");

// ---------- model calls ----------
async function callAnthropic(model: string, system: Block[], messages: Turn[], retried = false, metrics?: Timing, stage = "other", signal?: AbortSignal): Promise<string> {
  const key = Deno.env.get("ANTHROPIC_API_KEY");
  if (!key) throw new Error("No Anthropic key");
  const started = performance.now();
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    signal,
    method: "POST",
    headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model, max_tokens: stage === "plan" ? 400 : stage === "other" ? 4000 : 1200, thinking: THINKING_OFF[model] ?? { type: "disabled" }, system, messages }),
  });
  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${await res.text()}`);
  const data = await res.json();
  metrics?.calls.push({ stage, model, ms: Math.round(performance.now() - started), input_tokens: data.usage?.input_tokens ?? 0, cache_read_input_tokens: data.usage?.cache_read_input_tokens ?? 0, cache_creation_input_tokens: data.usage?.cache_creation_input_tokens ?? 0, output_tokens: data.usage?.output_tokens ?? 0, retry: retried });
  const text = (data.content ?? []).filter((b: { type: string }) => b.type === "text").map((b: { text: string }) => b.text).join("");
  if (data.stop_reason === "max_tokens" && !retried) {
    return callAnthropic(model, system, [...messages, { role: "assistant", content: text || "(cut off)" }, { role: "user", content: "Be shorter. Return the complete JSON." }], true, metrics, stage, signal);
  }
  if (!text) throw new Error(`Claude returned no content (stop_reason: ${data.stop_reason ?? "unknown"})`);
  return text;
}
async function callGemini(system: Block[], messages: Turn[], retried = false, metrics?: Timing, stage = "other"): Promise<string> {
  const key = Deno.env.get("LOVABLE_API_KEY");
  if (!key) throw new Error("No AI key configured");
  const started = performance.now();
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash", max_tokens: stage === "other" ? 4000 : 1200,
      reasoning_effort: "none",
      messages: [{ role: "system", content: system.map(b => b.text).join("\n\n") }, ...messages],
    }),
  });
  if (!res.ok) throw new Error(`Lovable gateway ${res.status}: ${await res.text()}`);
  const data = await res.json();
  metrics?.calls.push({ stage, model: "google/gemini-2.5-flash", ms: Math.round(performance.now() - started), input_tokens: data.usage?.prompt_tokens ?? 0, cache_read_input_tokens: data.usage?.prompt_tokens_details?.cached_tokens ?? 0, cache_creation_input_tokens: 0, output_tokens: data.usage?.completion_tokens ?? 0, retry: retried });
  const text = data.choices?.[0]?.message?.content ?? "";
  if (data.choices?.[0]?.finish_reason === "length" && !retried) {
    return callGemini(system, [...messages, { role: "assistant", content: text || "(cut off)" }, { role: "user", content: "Be shorter. Return the complete JSON." }], true, metrics, stage);
  }
  if (!text) throw new Error("Gateway returned no content");
  return text;
}
/** Sonnet, falling back to Gemini if Anthropic fails. */
async function callMain(system: Block[], messages: Turn[], metrics?: Timing, stage = "other"): Promise<string> {
  try { return await callAnthropic(SONNET, system, messages, false, metrics, stage); }
  catch (err) {
    if (!Deno.env.get("LOVABLE_API_KEY")) throw err;
    console.error("Claude failed, falling back to Gemini:", err);
    return await callGemini(system, messages, false, metrics, stage);
  }
}

// ---------- Brain (cached 10 min) ----------
let brainCache: { at: number; text: string; docs: number; words: number } | null = null;
async function loadBrain(admin: DB) {
  if (brainCache && Date.now() - brainCache.at < 10 * 60 * 1000) return brainCache;
  const { data: docs } = await admin.from("knowledge_docs").select("id, title, created_at").eq("source_type", "brain").order("created_at");
  let text = "";
  if (docs?.length) {
    const { data: rows } = await admin.from("knowledge_chunks").select("doc_id, chunk_index, content")
      .in("doc_id", docs.map((d: { id: string }) => d.id)).order("chunk_index").limit(10000);
    text = docs.map((d: { id: string; title: string }) => {
      const parts = (rows ?? []).filter((r: { doc_id: string }) => r.doc_id === d.id).map((r: { content: string }) => r.content);
      return `### ${d.title}\n\n${joinChunks(parts)}`;
    }).join("\n\n");
  }
  brainCache = { at: Date.now(), text, docs: docs?.length ?? 0, words: text.split(/\s+/).filter(Boolean).length };
  return brainCache;
}

// ---------- member context ----------
async function loadMemberInput(admin: DB, memberId: string): Promise<MemberInput> {
  const profileQuery = admin.from("profiles").select("full_name, business_overview, gate, gate_key_task, gate_move_up").eq("id", memberId).maybeSingle();
  const extrasPromise = profileQuery.then(({ data }: { data: { gate: string | null } | null }) => loadExtras(admin, memberId, data?.gate ?? null));
  const [{ data: profile }, { data: room }, { data: totals }, { data: goal }, extras] = await Promise.all([
    profileQuery,
    admin.from("context_rooms").select("answers").eq("user_id", memberId).maybeSingle(),
    admin.from("monthly_totals")
      .select("month, mrr, mrr_manual, total_revenue, oneoff_revenue, expenses, new_clients, leads_generated, booked_calls, calls_showed, offers_made, ad_spend, content_posts, active_retainers, retainers_lost, retainer_convos, ad_leads, case_studies_posted, ad_spend_awareness, ad_spend_leadgen, meetings, expense_contractors")
      .eq("user_id", memberId).order("month", { ascending: false }).limit(6),
    admin.from("goals").select("starting_mrr, target_mrr, target_date, retainer_tier_1, retainer_tier_2, retainer_tier_3").eq("user_id", memberId).maybeSingle(),
    extrasPromise,
  ]);
  const answers = { ...((room?.answers ?? {}) as ContextAnswers) };
  delete (answers as Record<string, unknown>).anything_else;
  return {
    name: profile?.full_name ?? null, business_overview: profile?.business_overview ?? null,
    gate: profile?.gate ?? null, gate_key_task: profile?.gate_key_task ?? null, gate_move_up: profile?.gate_move_up ?? null,
    answers, totals: totals ?? [], goal: goal ?? null, extras,
  };
}

// ---------- member memory ----------
/** The member-facing brief, with any other member's name stripped out. */
async function safeBrief(admin: DB, raw: unknown, memberId: string, ownName: string | null): Promise<string | null> {
  if (typeof raw !== "string" || !raw.trim()) return null;
  const { data } = await admin.from("profiles").select("id, full_name");
  const others = ((data ?? []) as { id: string; full_name: string | null }[]).filter(p => p.id !== memberId && p.full_name).map(p => p.full_name ?? "");
  return redact(raw.trim().slice(0, 400), nameTokens(others, ownName));
}
// Sonnet rewrites each member's running memory from everything the portal holds.
// Triggers mark it dirty when their data changes; refreshed after their questions
// (debounced) and by the every-2-days job.
const MEMORY_DEBOUNCE_MS = 10 * 60 * 1000;
function memorySummary(m: Record<string, unknown>): string {
  const list = (k: string, label: string) => Array.isArray(m[k]) && (m[k] as unknown[]).length ? `${label}: ${(m[k] as unknown[]).map(String).join("; ")}` : null;
  return [
    m.snapshot ? String(m.snapshot) : null,
    list("working", "Working"), list("stuck", "Stuck"), list("commitments", "Committed to"),
    list("patterns", "Patterns"), list("personal", "Personal"),
    m.next_focus ? `Next focus: ${m.next_focus}` : null, list("watch_outs", "Watch out for"),
  ].filter(Boolean).join("\n");
}
async function refreshMemory(admin: DB, memberId: string, force = false): Promise<{ ok: boolean; skipped?: string }> {
  const { data: row } = await admin.from("member_memory").select("memory, refreshed_at, dirty_at, refresh_started_at, instagram_handle, instagram_fetched_at, instagram_profile").eq("user_id", memberId).maybeSingle();
  const now = Date.now();
  if (!force && row?.refresh_started_at && now - Date.parse(row.refresh_started_at) < 2 * 60 * 1000) return { ok: true, skipped: "in progress" };
  if (!force && row?.refreshed_at && row.dirty_at <= row.refreshed_at) return { ok: true, skipped: "up to date" };
  const startedAt = new Date().toISOString();
  await admin.from("member_memory").upsert({ user_id: memberId, refresh_started_at: startedAt }, { onConflict: "user_id" });
  // Their Instagram: pulled at most every 2 days (or when the handle changes), cached on the memory row.
  const { data: room } = await admin.from("context_rooms").select("answers").eq("user_id", memberId).maybeSingle();
  const handle = cleanHandle((room?.answers as Record<string, unknown> | null)?.instagram_handle);
  const igDue = !!handle && (handle !== row?.instagram_handle || !row?.instagram_fetched_at || now - Date.parse(row.instagram_fetched_at) > IG_REFRESH_MS);
  if (handle && igDue) {
    try {
      const [posts, profile] = await Promise.all([fetchRecentPosts(handle), fetchProfile(handle).catch(() => null)]);
      if (posts) await admin.from("member_memory").update({ instagram: posts, instagram_handle: handle, instagram_fetched_at: new Date().toISOString(), ...(profile ? { instagram_profile: profile } : {}) }).eq("user_id", memberId);
    } catch (err) { console.error("instagram pull failed", handle, err); }
  } else if (handle && !row?.instagram_profile) {
    // Posts are fresh but the profile (bio, link, pinned) hasn't been pulled yet.
    try {
      const profile = await fetchProfile(handle);
      if (profile) await admin.from("member_memory").update({ instagram_profile: profile }).eq("user_id", memberId);
    } catch (err) { console.error("instagram profile pull failed", handle, err); }
  }
  const member = await loadMemberInput(admin, memberId);
  if (member.extras) member.extras.memory = null; // the previous memory goes in separately below
  const { data: asked } = await admin.from("dan_ai_messages").select("content, created_at").eq("user_id", memberId).eq("role", "user").order("created_at", { ascending: false }).limit(20);
  const msg = `${buildMemberBlock(member).text}\n\n=====\n\nEVERY QUESTION THEY'VE ASKED DAN AI RECENTLY (newest first)\n${((asked ?? []) as { content: string; created_at: string }[]).map(a => `- ${a.created_at.slice(0, 10)}: ${a.content.slice(0, 300)}`).join("\n") || "(none)"}\n\n=====\n\nYOUR PREVIOUS MEMORY\n${row?.memory && Object.keys(row.memory).length ? JSON.stringify(row.memory) : "(none yet)"}\n\nToday is ${startedAt.slice(0, 10)}.`;
  let memory: Record<string, unknown> | null = null;
  for (let i = 0; i < 2 && !memory; i++) {
    try { memory = parseJson(await callMain([{ type: "text", text: MEMORY_PROMPT }], [{ role: "user", content: msg }], undefined, "other")); }
    catch (err) { console.error("memory refresh failed", memberId, err); }
  }
  if (!memory) {
    await admin.from("member_memory").update({ refresh_started_at: null }).eq("user_id", memberId);
    return { ok: false };
  }
  const brief = await safeBrief(admin, memory.brief, memberId, member.name ?? null);
  await admin.from("member_memory").update({
    memory, summary: memorySummary(memory), refreshed_at: startedAt, refresh_started_at: null,
    brief,
    sources: { totals: member.totals.length, build: member.extras?.build.length ?? 0, questions: asked?.length ?? 0 },
  }).eq("user_id", memberId);
  return { ok: true };
}
/** Fire-and-forget refresh after a chat, so the next answer knows what just happened. */
function refreshInBackground(admin: DB, memberId: string, member: MemberInput | null) {
  const mem = member?.extras?.memory;
  if (mem && mem.refreshed_at && Date.now() - Date.parse(mem.refreshed_at) < MEMORY_DEBOUNCE_MS) return;
  const task = refreshMemory(admin, memberId).catch(err => console.error("background memory refresh", err));
  // deno-lint-ignore no-explicit-any
  const rt = (globalThis as any).EdgeRuntime;
  if (rt?.waitUntil) rt.waitUntil(task);
}

// ---------- plan ----------
const STOP = new Set("the and for with that this what how should does have from your about just into they them then than when will would could i'm i've my me you are can get got its it's".split(" "));
function keywordTerms(q: string) {
  return [...new Set(q.toLowerCase().replace(/[^a-z0-9$\s]/g, " ").split(/\s+/).filter(w => w.length > 2 && !STOP.has(w)))].slice(0, 12);
}
async function runPlan(question: string, history: Turn[], metrics: Timing): Promise<{ plan: Plan; fallback: boolean }> {
  const convo = history.slice(-4).map(t => `${t.role}: ${t.content.slice(0, 500)}`).join("\n");
  const controller = new AbortController();
  // Sonnet reads the question first: what they really need and how big the answer should be.
  const timeout = setTimeout(() => controller.abort(), 9000);
  try {
    const parsed = parseJson(await callAnthropic(SONNET, [{ type: "text", text: PLAN_PROMPT, cache_control: { type: "ephemeral" } }],
      [{ role: "user", content: `RECENT CONVERSATION: ${convo}\nQUESTION: ${question}` }], false, metrics, "plan", controller.signal)) as Plan | null;
    if (parsed && Array.isArray(parsed.search_terms)) return { plan: parsed, fallback: false };
  } catch {
    metrics.calls.push({ stage: "plan", model: SONNET, ms: 9000, input_tokens: 0, cache_read_input_tokens: 0, cache_creation_input_tokens: 0, output_tokens: 0, retry: false, error: controller.signal.aborted ? "9s deadline; keyword fallback" : "plan failed; keyword fallback" });
  } finally { clearTimeout(timeout); }
  // Classification remains conservative; the full draft/checker still adjudicates boundaries from the question.
  const boundary = /(?:ProfitX.*(?:bill|paus|cancel|refund|invoice)|(?:paus|cancel|refund|invoice).*ProfitX|mental health|legal|personal crisis)/i.test(question);
  const privacy = /(?:what.*(?:making|revenue)|who.*gate|other members?)/i.test(question);
  return { plan: { topic: boundary ? "boundary" : privacy ? "privacy" : /ads?|campaign|leads?|scal/i.test(question) ? "ads" : "other", is_boundary: boundary, asks_about_other_member: privacy, search_terms: keywordTerms(question) }, fallback: true };
}

// ---------- retrieval ----------
type Chunk = { chunk_id: string; doc_id: string; title: string; source_type: string; content: string; rank: number; source_id?: string | null };
type Scored = Chunk & { score: number };
async function retrieve(admin: DB, question: string, plan: Plan, opts: { privacy: boolean; askerName: string | null; otherTokens: string[] }) {
  const search = async (q: string, n: number): Promise<Chunk[]> => q.trim() ? ((await admin.rpc("search_knowledge", { q, limit_n: n })).data ?? []) : [];
  const terms = (plan.search_terms ?? []).map(s => String(s).trim()).filter(Boolean).slice(0, 15);
  const ladder = [terms.join(" or "), question, keywordTerms(question).join(" or ")];
  const seen = new Map<string, Chunk>();
  const searches = await Promise.all([...new Set(ladder)].map(q => search(q, 60)));
  for (const results of searches) for (const c of results) if (!seen.has(c.chunk_id) && seen.size < 60) seen.set(c.chunk_id, c);
  let cands = [...seen.values()].filter(c => c.source_type !== "brain");

  if (opts.privacy) {
    cands = cands.filter(c => c.source_type !== "call" || GROUP_CALL.test(c.title) || findNames(c.title, opts.otherTokens).length === 0
      && (opts.askerName ? c.title.toLowerCase().includes(opts.askerName.split(/\s+/)[0].toLowerCase()) : false));
    cands = cands.map(c => {
      let content = c.content;
      if (c.source_type === "whatsapp") content = content.split("\n").filter(l => /\]\s*You:/.test(l)).join("\n");
      return { ...c, title: redact(c.title, opts.otherTokens), content: redact(content, opts.otherTokens) };
    }).filter(c => c.content.trim().length > 40);
  }

  const { data: docs } = cands.length
    ? await admin.from("knowledge_docs").select("id, created_at, source_id").in("id", [...new Set(cands.map(c => c.doc_id))])
    : { data: [] };
  const docRows = (docs ?? []) as { id: string; created_at: string; source_id: string | null }[];
  const age = new Map<string, number>(docRows.map(d => [d.id, (Date.now() - Date.parse(d.created_at)) / 86400000]));
  const sourceId = new Map<string, string | null>(docRows.map(d => [d.id, d.source_id]));
  const typeBoost: Record<string, number> = { teaching: 4, transcript: 4, note: 2, whatsapp: 2, call: 0 };
  const lowerTerms = [...new Set([...terms, ...keywordTerms(question)].map(t => t.toLowerCase()))];
  const askerFull = opts.askerName?.trim().toLowerCase() || null;
  const askerFirst = askerFull?.split(/\s+/)[0] ?? null;
  const isOwn = (c: Chunk) => !!askerFirst && (c.source_type === "call" || c.source_type === "whatsapp")
    && new RegExp(`\\b${askerFirst.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(c.title);
  const scored: Scored[] = cands.map(c => {
    const lc = c.content.toLowerCase();
    const hits = lowerTerms.filter(t => lc.includes(t)).length;
    const days = age.get(c.doc_id) ?? 365;
    return { ...c, score: hits * 3 + (typeBoost[c.source_type] ?? 1) + Math.max(0, 1 - days / 365) + (isOwn(c) ? 10 : 0) };
  }).sort((a, b) => b.score - a.score);

  const words = (t: string) => new Set(t.toLowerCase().split(/\W+/).filter(w => w.length > 3));
  const picked: Scored[] = [];
  const perDoc = new Map<string, number>();
  for (const c of scored) {
    if (picked.length >= 12) break;
    if ((perDoc.get(c.doc_id) ?? 0) >= 2) continue;
    const w = words(c.content);
    const dup = picked.some(p => {
      const pw = words(p.content);
      let inter = 0; for (const x of w) if (pw.has(x)) inter++;
      return inter / Math.max(1, Math.min(w.size, pw.size)) > 0.6;
    });
    if (dup) continue;
    perDoc.set(c.doc_id, (perDoc.get(c.doc_id) ?? 0) + 1);
    picked.push(c);
  }
  return picked.map(c => ({ ...c, source_id: sourceId.get(c.doc_id) ?? null, content: relevantExcerpt(c.content, lowerTerms) }));
}

// ---------- the pipeline ----------
type PipelineInput = {
  admin: DB; question: string; history: Turn[]; catalogue: string; vaultSources: Record<string, string>;
  mode: "member" | "admin" | "test"; member: MemberInput | null | Promise<MemberInput | null>; memberId: string | null;
  clock: ReturnType<typeof timing>; status?: (status: string) => void;
  extraRules?: string; // self-test only: extra rules appended to the draft and checker prompts
};
async function answerPipeline(p: PipelineInput) {
  const issues: { type: string; note: string }[] = [];
  const privacy = p.mode !== "admin";
  const clock = p.clock;
  const planned = clock.measure("plan", () => runPlan(p.question, p.history, clock.data));
  const [brain, member, { data: allProfiles }, catalogue, { data: voice }] = await Promise.all([
    clock.measure("brain_load", () => loadBrain(p.admin)), p.member, p.admin.from("profiles").select("id, full_name, is_admin"), Promise.resolve(p.catalogue),
    p.admin.from("voice_profile").select("content").eq("slug", "default").maybeSingle(),
  ]);
  const voiceText = (voice as { content: string } | null)?.content?.trim() ? `\n\nDAN'S VOICE PROFILE (built from his real messages; match it):\n${(voice as { content: string }).content.trim().slice(0, 4000)}` : "";
  const askerName = member?.name ?? null;
  // Live progress for the member, naming what was actually read (their own data and counts only).
  const buildDone = (member?.extras?.build ?? []).filter(t => t.status === "approved").length;
  p.status?.(member
    ? `Read ${member.totals.length} month${member.totals.length === 1 ? "" : "s"} of your numbers, your Context Room${member.gate ? `, your ${member.gate} build list (${buildDone}/${member.extras?.build.length ?? 0} done)` : ""}${member.extras?.memory ? " and your history with Dan" : ""}`
    : "Loaded Dan's playbook");
  // Admins (Dan and Emily) aren't other members: "I'll flag it to Dan and Emily" is a normal reply, not a privacy leak.
  const otherNames = ((allProfiles ?? []) as { id: string; full_name: string | null; is_admin: boolean | null }[])
    .filter(x => x.id !== p.memberId && x.full_name && !x.is_admin).map(x => x.full_name ?? "");
  const tokens = nameTokens(otherNames, p.mode === "test" ? null : askerName);

  const block = member ? buildMemberBlock(member) : { text: "ABOUT THIS MEMBER: none (general answer, no member selected).", derived: null, hasContext: false, summary: "no member" };
  const { plan, fallback: planFallback } = await planned;
  p.status?.("Searching Dan's workshops, calls and notes…");
  // A build-task question searches Dan's knowledge for that task, not the words "what should I focus on".
  const taskTitle = plan.is_boundary || plan.asks_about_other_member ? null
    : buildTaskTitle(p.question) ?? (isFocusQuestion(p.question) ? nextBuildTask(member?.extras?.build ?? [])?.title ?? null : null);
  const searchPlan = taskTitle ? { ...plan, search_terms: [...keywordTerms(taskTitle), ...(plan.search_terms ?? [])] } : plan;
  const passages = await clock.measure("retrieval", () => retrieve(p.admin, taskTitle ? `${p.question} ${taskTitle}` : p.question, searchPlan, { privacy, askerName, otherTokens: tokens }));
  p.status?.(`Found ${passages.length} moments where Dan's covered this`);
  // Dan's own saved answers to similar questions go first: they're his exact words.
  const { data: saved } = await p.admin.rpc("search_saved_answers", { q: p.question, limit_n: 3 }).then((r: { data: unknown }) => r, () => ({ data: [] }));
  const savedText = ((saved ?? []) as { question: string; answer: string }[]).map(a => `[Dan's saved answer] Q: ${a.question}\n${a.answer}`).join("\n\n---\n\n");
  const passageText = [savedText, passages.map(c => `[${SOURCE_TAGS[c.source_type] ?? c.source_type}] ${c.title}\n${c.content}`).join("\n\n---\n\n")].filter(Boolean).join("\n\n---\n\n");

  const brainBlock: Block[] = brain.text ? [{ type: "text", text: `${BRAIN_HEADER}\n\n${brain.text}`, cache_control: { type: "ephemeral" } }] : [];
  const catalogueLines = p.catalogue.split("\n").map(l => l.trim()).filter(Boolean);
  const shortAnswer = !!plan.is_boundary || !!plan.asks_about_other_member;
  const recording = shortAnswer ? null : bestRecording(passages, catalogueLines, p.vaultSources);
  // The workshop for the member's real problem: their question plus what looks off in their numbers.
  const memberSignals = member && block.derived ? signals(member, block.derived) : [];
  const prescription = shortAnswer ? null : prescribe(`${p.question} ${memberSignals.map(x => `${x.problem} ${x.fix}`).join(" ")}`, catalogueLines);
  const guideText = shortAnswer ? "" : workshopGuideText(catalogueLines);
  const workshopText = shortAnswer ? "" : [
    guideText && `WORKSHOP GUIDE — what each recording fixes (pick the one that fixes the problem you diagnose):\n${guideText}`,
    recording && `BEST-MATCHING RECORDING (Dan's Drive transcripts cover this question best): ${recording}`,
    prescription && prescription !== recording && `PRESCRIBED FOR THEIR PROBLEM (from their question and what looks off): ${prescription}`,
  ].filter(Boolean).join("\n\n");
  // "Help me do this" on a build task: the task, Dan's proof ask and its module content, walked through as steps.
  const buildHelp = shortAnswer ? null : await loadBuildHelp(p.admin, p.question, member?.extras?.gate_number ?? null, member?.extras?.build ?? []);
  const focus = !!buildHelp && !buildTaskTitle(p.question);
  // "What should I focus on": Sonnet picks the one sub-step inside their next build task they haven't done,
  // from the task's training and their data, so the answer goes deep on that step instead of the whole task.
  let nextStep = null as { step?: string; why_first?: string; done_when?: string } | null;
  if (focus && buildHelp) {
    p.status?.("Working out your very next step…");
    try {
      nextStep = parseJson(await callAnthropic(SONNET, [{ type: "text", text: STEP_PROMPT }],
        [{ role: "user", content: `${buildHelp}\n\n=====\n\n${block.text}\n\n=====\n\nDAN'S KNOWLEDGE\n${passageText.slice(0, 6000)}` }], false, clock.data, "step")) as typeof nextStep;
    } catch (err) { console.error("next step pick failed", err); }
  }
  const stepText = nextStep?.step ? `THE ONE STEP TO ANSWER (picked from their data): ${nextStep.step}${nextStep.why_first ? `\nWhy this first: ${nextStep.why_first}` : ""}${nextStep.done_when ? `\nDone when: ${nextStep.done_when}` : ""}\nAnswer ONLY this step. Don't mention the later parts of the task.\n\n` : "";
  const buildText = buildHelp ? `${buildHelp}\n\n${stepText}${focus ? FOCUS_FORMAT : BUILD_HELP_FORMAT}\n\n=====\n\n` : "";
  // The shape comes from what they actually asked: one problem gets one fix, and a general business
  // question isn't forced through Dan's gates, roadmap or keyword rules.
  const general = !shortAnswer && !buildHelp && plan.program_related === false;
  // Dan's own answer and reasoning for the stuck point this question is about (playbook.ts).
  const situation = shortAnswer ? { text: "", keys: [] as string[] } : situationBlock(p.question);
  // A general business question keeps Dan's business rules (fees, discounts, scope) but not his gate/ad-ladder rules.
  const programRule = (r: { say: string }) => /\bgate\b|boost|awareness|lead gen|\bcpa\b|creatives|campaign/i.test(r.say);
  const must = shortAnswer ? [] : mustSay({
    question: p.question,
    gate: member?.extras?.gate_number ?? gateFromLabel(member?.gate),
    revenue: block.derived?.total_revenue_latest ?? block.derived?.mrr_latest ?? null,
    hasContext: block.hasContext, hasMember: !!member,
    costPerClient: block.derived?.cost_per_client ?? null, lowestPrice: block.derived?.lowest_retainer_price ?? null,
    fastTrack: !!member?.extras?.fast_track_lead_gen,
  }).filter(r => !general || !programRule(r));
  const mustText = must.length ? `MUST SAY — Dan's rules this question needs. Include every one (tighten other wording to fit, never drop these):\n${must.map(m => `- ${m.say}`).join("\n")}${must.length >= 4 ? "\nThere are more rules than points: pair related rules in one point (e.g. a gate step plus the ad rule), keeping each rule's exact numbers." : ""}\n\n=====\n\n` : "";
  // One point only when a single fix answers it and it doesn't carry several of Dan's rules.
  const oneShot = !shortAnswer && !buildHelp && plan.shape === "one" && must.length <= 1;
  const shapeText = shortAnswer || !plan.core_problem ? "" : `WHAT THEY'RE REALLY ASKING (read past the brain dump): ${plan.core_problem}\n${oneShot ? "ANSWER SHAPE: ONE. This is one problem with one fix. Stance line + exactly ONE point that is the fix, said plainly with the how. No extra points, no padding, no note unless their numbers are stale.\n" : ""}${general ? "This is a general business question, not about the gates, roadmap or build list. Answer the problem itself with Dan's own opinion. Don't bolt on gate steps, the ad ladder or trainings that don't fix it, but Dan's rules on business decisions (holding the fee, discounts, scope, ad spend on top of the fee) still apply.\n" : ""}\n=====\n\n`;
  const draftSystem: Block[] = [...brainBlock, { type: "text", text: draftPrompt([], "") + voiceText + (p.extraRules ? `\n\nEXTRA RULES:\n${p.extraRules}` : ""), cache_control: { type: "ephemeral" } }];
  const convo = p.history.map(t => `${t.role === "user" ? "MEMBER" : "DAN"}: ${t.content}`).join("\n\n") || "(none)";
  const userTurn = `RESOURCES YOU CAN POINT TO (exact line or null)\n${catalogue}\n\n${workshopText ? `${workshopText}\nResource = the recording that fixes the problem you diagnosed. Use one of the lines above unless another catalogue line clearly fits better.\n\n` : ""}${shapeText}${situation.text}${buildText}${mustText}${block.text}\n\n=====\n\nDAN'S KNOWLEDGE — real advice Dan has given (use for detail and phrasing; the Brain wins on conflict)\n\n${passageText || "(nothing matched)"}\n\n=====\n\nCONVERSATION SO FAR\n${convo}\n\n=====\n\nTHE MEMBER ASKED: ${p.question}`;

  // DRAFT (retry once on invalid JSON)
  p.status?.(memberSignals.length ? `Spotted ${memberSignals.length} thing${memberSignals.length === 1 ? "" : "s"} in your numbers. Writing your answer…` : "Writing your answer in Dan's words…");
  let draft: Answer | null = null;
  for (let i = 0; i < 2 && !draft; i++) draft = toAnswer(parseJson(await clock.measure(i ? "draft_retry" : "draft", () => callMain(draftSystem, [{ role: "user", content: userTurn + (i ? '\nReturn valid JSON only. Escape newlines inside strings. Use answer, points [{do, why}], note and resource.' : '') }], clock.data, "draft"))));
  if (!draft) {
    issues.push({ type: "guardrail", note: "Draft JSON invalid twice — flagged to Dan" });
    const final: Answer = { answer: FLAG_REPLY, points: [], note: null, resource: null };
    return { draft: final, final, pass: false, issues, plan, passages, brain, block, planFallback, member, timing: clock.finish(), recording, prescription, signals: memberSignals, must: must.map(m => m.short), next_step: nextStep };
  }

  // CHECK
  p.status?.(`Checking it like Dan would: privacy, your gate, his exact numbers${must.length ? ` and ${must.length} of his rules` : ""}…`);
  const checkSystem: Block[] = [...brainBlock, { type: "text", text: CHECKER_PROMPT + (p.extraRules ? `\n\nEXTRA RULES:\n${p.extraRules}` : ""), cache_control: { type: "ephemeral" } }];
  const checkBase = `RESOURCES\n${catalogue}\n\n${workshopText ? `${workshopText}\n\n` : ""}PASSAGES\n${passageText}\n\n${shapeText}${situation.text}${buildText}${mustText}${block.text}\n\n=====\n\nCONVERSATION SO FAR\n${convo}\n\n=====\n\nQUESTION\n${p.question}\n\n=====\n\nPLAN\n${JSON.stringify(plan)}`;
  const runCheck = async (current: Answer, extra = ""): Promise<{ final: Answer; pass: boolean; issues: { type: string; note: string }[] } | null> => {
    for (let i = 0; i < 2; i++) {
      try {
        const parsed = parseJson(await clock.measure(extra || i ? "check_retry" : "check", () => callMain(checkSystem, [{ role: "user", content: `${checkBase}\n\n=====\n\nDRAFT\n${JSON.stringify(current)}${extra ? `\n\n=====\n\nMUST FIX: ${extra}` : ""}` }], clock.data, "check")));
        const result = checkerResult(parsed, current, toAnswer);
        if (result) return result;
      } catch (err) { console.error("checker call failed", err); }
    }
    return null;
  };
  let pass = false;
  let final: Answer = draft;
  const checked = await runCheck(draft);
  if (checked) { final = checked.final; pass = checked.pass; issues.push(...checked.issues); }
  else { issues.push({ type: "guardrail", note: "Checker unavailable — safe fallback; unchecked draft withheld" }); final = { answer: FLAG_REPLY, points: [], note: null, resource: null }; }

  p.status?.("Final safety checks…");
  const guardStarted = performance.now();
  const retryBefore = clock.data.steps.check_retry ?? 0;
  // GUARDRAILS — deterministic repairs first; only privacy gets another checker call.
  const problems = (a: Answer) => {
    const text = fullText(a);
    const out: string[] = [];
    const names = privacy ? findNames(text, tokens) : [];
    if (names.length) out.push(`remove other member names (${names.join(", ")})`);
    const banned = findBanned(text);
    if (banned.length) out.push(`rewrite the lines containing banned phrases/swearing: ${banned.join(", ")}`);
    if (looksTruncated(a.answer)) out.push("the answer is cut off — finish it cleanly");
    const shortReply = shortAnswer;
    if (shortReply) {
      if (wordCount(text) < 15 || wordCount(text) > 60) out.push("boundary/privacy reply must be 15–60 words");
      if (a.points.length || a.note) out.push("boundary/privacy reply must be 1–2 short lines, no points or note");
    } else {
      if (buildHelp ? a.points.length < (focus ? 2 : 3) || a.points.length > 6 : oneShot ? a.points.length > 1 : a.points.length < 1 || a.points.length > 4) {
        out.push(buildHelp ? (focus ? "needs 2–6 points, all on this one step" : "needs 3–6 build steps, all on this one task") : oneShot ? "one problem, one fix: keep only the single point that answers what they asked" : "needs 1–4 dot points");
      }
      if (a.points.some(pt => !pt.why.trim())) out.push("each point needs one short reason");
      if (wordCount(a.answer) > 18) out.push("stance must be max ~15 words");
      if (wordCount(text) > (buildHelp ? (focus ? 340 : 320) : 130)) out.push(buildHelp ? `cut to under ~${focus ? 300 : 280} words total` : "cut to under ~110 words total");
    }
    // Ads/scaling/pricing questions must use the member's cost per client — only when it was actually computed.
    const cpc = block.derived?.cost_per_client;
    if (typeof cpc === "number" && Number.isFinite(cpc) && !shortReply) {
      if (plan.topic === "ads" && !hasCostPerClient(text, cpc)) {
        out.push(`use their cost per client in dollars (~$${Math.round(cpc)} a client) and say whether it's under half their first month's fee`);
      }
    }
    // Sequence rule: follow-up problem + allowed to scale → scaling must be conditional on speed to lead.
    if (/no (booked )?calls|not booking|aren'?t booking|slow (to )?repl|leads? but no|not calling|haven'?t called/i.test(p.question) && /\bscal/i.test(text) && !/15\s*[–-]\s*30/.test(text)) {
      out.push(`put follow-up first and make scaling conditional: "you can scale, but only once you're calling every lead within 15–30 mins"`);
    }
    return { out, names };
  };
  const shortReply = shortAnswer;
  const maximum = shortReply ? 60 : buildHelp ? (focus ? 320 : 300) : 115;
  const clean = (text: string) => findBanned(text).length ? text.split(/(?<=[.!?])\s+|\n+/).filter(line => !findBanned(line).length).join("\n") : text;
  final = {
    ...final,
    answer: clean(final.answer),
    points: final.points.map(pt => ({ do: clean(pt.do), why: clean(pt.why) })).filter(pt => pt.do),
    note: final.note ? clean(final.note) : null,
  };
  // Code may append only precomputed member facts or the exact fixed sequence rule, never invent coaching.
  const cpc = block.derived?.cost_per_client;
  if (checked && !shortReply && plan.topic === "ads" && typeof cpc === "number" && Number.isFinite(cpc) && !hasCostPerClient(fullText(final), cpc)) {
    final = repairCostPerClient(final, cpc, block.derived?.lowest_retainer_price);
  }
  const followupProblem = /no (booked )?calls|not booking|aren'?t booking|slow (to )?repl|leads? but no|not calling|haven'?t called/i.test(p.question);
  if (followupProblem && typeof block.derived?.cac_vs_first_month === "number" && block.derived.cac_vs_first_month < 50 && /\bscal/i.test(fullText(final))) {
    const fix = (s: string) => s.replace(/[^.!?\n]*\bscal[^.!?\n]*[.!?]?/gi, "You can scale, but only once you're calling every lead within 15–30 mins.");
    final = { ...final, answer: fix(final.answer), points: final.points.map(pt => ({ do: fix(pt.do), why: fix(pt.why) })) };
  }
  // Over the limit: the checker tightens the wording first, so trimming below never drops a rule, a computed number or the data nudge.
  if (checked && wordCount(fullText(final)) > maximum) {
    const target = shortReply ? 60 : buildHelp ? (focus ? 300 : 280) : 110;
    const tighter = await runCheck(final, `cut to under ~${target} words by tightening the wording of every line. Keep every point, number and rule of Dan's${must.length ? ` (especially the MUST SAY rules)` : ""}, and keep the note if it asks them to update their numbers or Context Room.`);
    if (tighter && wordCount(fullText(tighter.final)) < wordCount(fullText(final))) { final = tighter.final; issues.push(...tighter.issues); }
  }
  // Last resort for length: trim to the limit, keeping a data/Context Room nudge and the cost-per-client point.
  const trim = (input: Answer): Answer => {
    let final = input;
    if (wordCount(fullText(final)) > maximum) {
      if (shortReply) {
        const sentences = final.answer.split(/(?<=[.!?])\s+|\n+/);
        let kept = "";
        for (const sentence of sentences) { if (wordCount(kept + " " + sentence) > maximum) break; kept += (kept ? "\n" : "") + sentence; }
        if (kept) final = { ...final, answer: kept };
      } else {
        // Last resort: drop the lowest-priority points (and a plain note) until the total fits,
        // keeping a data/Context Room nudge and the point that carries their cost per client.
        let pts = [...final.points];
        let note = final.note;
        const over = () => wordCount(fullText({ ...final, points: pts, note })) > maximum;
        const dataNudge = !!note && /context room|latest totals|submit|90-day goal|also:/i.test(note);
        while (note && !dataNudge && over()) note = null;
        const carriesCost = (pt: Point) => typeof cpc === "number" && Number.isFinite(cpc) && hasCostPerClient(`${pt.do} ${pt.why}`, cpc);
        const carriesRule = (pt: Point) => must.some(r => r.test.test(`${pt.do} ${pt.why}`));
        while (pts.length > 2 && over()) {
          // Drop the lowest point carrying neither the cost per client nor a MUST SAY rule; if every point carries one, stop and let the hard cap shorten them.
          const drop = pts.map((pt, i) => ({ pt, i })).reverse().find(x => !carriesCost(x.pt) && !carriesRule(x.pt))?.i;
          if (drop == null) break;
          pts = pts.filter((_, i) => i !== drop);
        }
        final = { ...final, points: pts, note };
      }
    }
    return final;
  };
  final = trim(final);
  // Any MUST SAY rule still missing gets one rewrite that merges it in, within the word limit.
  const stillMissing = () => missingRules(must, fullText(final));
  if (checked && stillMissing().length) {
    const fix = await runCheck(final, `these rules of Dan's are missing and MUST appear inside the points (not the note): ${stillMissing().map(r => `"${r.short}"`).join("; ")}. Merge each into the point it fits (in its \"why\" if needed) or use a 4th point. Stay under ~110 words total by cutting filler words, never other rules or their numbers.`);
    if (fix && missingRules(must, fullText(fix.final)).length < stillMissing().length) { final = trim(fix.final); issues.push(...fix.issues); }
  }
  if (checked && !shortReply && member && !block.hasContext && !/context room/i.test(fullText(final))) {
    final = { ...final, note: "Fill in your Context Room so I can make this specific to you." };
  }
  // Close every visible line cleanly: stance, each point, and the note.
  const close = (s: string) => looksTruncated(s) && /[A-Za-z0-9]$/.test(s.trim()) ? s.trim() + "." : s;
  final = {
    ...final,
    answer: close(final.answer),
    points: final.points.map(pt => ({ do: close(pt.do), why: close(pt.why) })),
    note: final.note ? close(final.note) : null,
  };
  let probs = problems(final);
  if (checked && probs.out.length) {
    issues.push({ type: "guardrail", note: "Re-check unresolved guardrail violations" });
    const again = await runCheck(final, probs.out.join("; "));
    if (again) { final = again.final; issues.push(...again.issues); }
    if (!shortReply && plan.topic === "ads" && typeof cpc === "number" && Number.isFinite(cpc) && !hasCostPerClient(fullText(final), cpc)) {
      final = repairCostPerClient(final, cpc, block.derived?.lowest_retainer_price);
    }
    final = trim(final);
    probs = problems(final);
  }
  // Last resort: say the missing rules in Dan's words in the note, then trim points (not the note) to fit.
  const leftOut = checked ? stillMissing() : [];
  if (leftOut.length && final.answer !== FLAG_REPLY) {
    const line = leftOut.map(r => r.short).join("; ");
    const keep = final.note && /context room|latest totals|submit|90-day goal/i.test(final.note) ? `${final.note} ` : "";
    final = trim({ ...final, note: `${keep}Also: ${line}.` });
    issues.push({ type: "guardrail", note: `Added missing rules: ${leftOut.map(r => r.short).join("; ")}` });
    probs = problems(final);
  }
  // Hard cap so every answer stays inside the format: shorten the note to its first sentence, then drop it, then trim the last point's reason.
  const cap = shortReply ? 60 : buildHelp ? (focus ? 345 : 325) : 118;
  // An "Also:" note carries Dan's rules, so shortening it drops the lead-in sentence, never the rules.
  if (wordCount(fullText(final)) > cap && final.note) {
    const rules = final.note.search(/also:/i);
    final = { ...final, note: rules > 0 ? final.note.slice(rules) : rules === 0 ? final.note : final.note.split(/(?<=[.!?])\s+/)[0] };
  }
  if (wordCount(fullText(final)) > cap && final.note && !/(^|\. )also:/i.test(final.note)) final = { ...final, note: null };
  while (wordCount(fullText(final)) > cap && final.points.length) {
    const last = final.points[final.points.length - 1];
    const words = last.why.split(/\s+/);
    if (words.length <= 6) break;
    final = { ...final, points: [...final.points.slice(0, -1), { ...last, why: words.slice(0, words.length - (wordCount(fullText(final)) - cap)).join(" ").replace(/[,;:]$/, "") + "." }] };
  }
  // One problem, one fix: the first point is the fix, so anything after it is padding.
  if (oneShot && final.points.length > 1) final = { ...final, points: final.points.slice(0, 1) };
  // "bro" stays occasional: at most one, and none if either of Dan's last two answers in this thread used it.
  final = limitBro(final, !p.history.filter(t => t.role === "assistant").slice(-2).some(t => /\bbro\b/i.test(t.content)));
  // Length is fixed by trimming above, so only real problems (privacy, voice, a cut-off, a missing number) withhold the answer.
  probs = { ...probs, out: probs.out.filter(o => !/^cut to under/.test(o)) };
  if (probs.out.length || !final.answer.trim() || wordCount(fullText(final)) < (shortReply ? 15 : 30)) {
    // Never publish an answer still violating privacy, semantics, voice or the word limits.
    issues.push({ type: "guardrail", note: `Unsafe final withheld: ${probs.out.join("; ") || "length"}` });
    final = { answer: probs.names.length ? NAME_FALLBACK : FLAG_REPLY, points: [], note: null, resource: null };
    pass = false;
  }
  clock.data.steps.guardrails = Math.max(0, Math.round(performance.now() - guardStarted) - ((clock.data.steps.check_retry ?? 0) - retryBefore));
  // JSON parsed fine, so an unpunctuated ending is style, not a cut-off: close it.
  if (looksTruncated(final.answer) && /[A-Za-z0-9]$/.test(final.answer.trim())) final = { ...final, answer: final.answer.trim() + "." };
  const matched = matchResource(final.resource, catalogueLines);
  if (final.resource && !matched) issues.push({ type: "guardrail", note: `Resource "${final.resource}" not in catalogue — removed` });
  final = { ...final, resource: matched };
  // Every real answer ends on the recording that covers it, when Drive gave us one.
  const fallback = recording ?? prescription;
  if (!final.resource && fallback && final.answer !== FLAG_REPLY && final.answer !== NAME_FALLBACK) final = { ...final, resource: fallback };
  // Why watch it: the model's line when it's about this same session (the checker may drop it), else what the guide says the session covers.
  const modelWhy = final.resource && final.resource === matched
    ? final.resource_why ?? (matchResource(draft.resource, catalogueLines) === matched ? draft.resource_why ?? null : null)
    : null;
  const guide = final.resource ? guideFor(final.resource) : null;
  final = { ...final, resource_why: final.resource ? modelWhy ?? (guide ? `Covers ${guide.fixes.split(": ")[1] ?? guide.fixes}.` : null) : null };

  return { draft, final, pass, issues, plan, passages, brain, block, planFallback, member, timing: clock.finish(), recording, prescription, signals: memberSignals, must: must.map(m => m.short), next_step: nextStep };
}

/**
 * What the answer was built from, safe for the member to see: their own data and
 * counts only. Never passage titles (1:1 calls can name other members).
 */
function buildSources(r: Awaited<ReturnType<typeof answerPipeline>>) {
  const m = r.member;
  const short = !r.final.points.length;
  const byType: Record<string, number> = {};
  for (const p of r.passages) byType[p.source_type] = (byType[p.source_type] ?? 0) + 1;
  const build = m?.extras?.build ?? [];
  return {
    months: m?.totals.length ?? 0,
    latest_month: r.block.derived?.latest_month ?? null,
    gate: m?.gate ?? null,
    build: build.length ? { done: build.filter(t => t.status === "approved").length, total: build.length } : null,
    context_fields: r.block.derived?.context_room_filled ?? 0,
    memory: !!m?.extras?.memory,
    passages: r.passages.length,
    library: { workshops: (byType.teaching ?? 0) + (byType.transcript ?? 0), calls: byType.call ?? 0, notes: (byType.note ?? 0) + (byType.whatsapp ?? 0) },
    checks: r.issues.filter(i => i.type !== "guardrail").length,
    rules: r.must.length,
    noticed: short ? [] : r.signals.slice(0, 3).map(s => s.problem),
  };
}

function buildDebug(mode: string, memberId: string | null, member: MemberInput | null, r: Awaited<ReturnType<typeof answerPipeline>>) {
  return {
    mode, member_id: memberId, timing: r.timing, next_step: r.next_step ?? null,
    brain_loaded: r.brain.docs > 0, brain: { docs: r.brain.docs, words: r.brain.words },
    monthly_totals: { count: member?.totals.length ?? 0, months: (member?.totals ?? []).map(t => t.month) },
    data_freshness: r.block.derived?.data_freshness ?? "none",
    goal: r.block.derived?.goal_status ?? "none",
    context_room: { fields_filled: r.block.derived?.context_room_filled ?? 0, missing: r.block.derived?.context_room_missing ?? [] },
    derived: r.block.derived, about_member: r.block.text,
    context_used: r.block.hasContext,
    plan: r.plan, plan_fallback: r.planFallback,
    passages: r.passages.map(c => ({ title: c.title, source_type: c.source_type, score: Math.round(c.score * 10) / 10 })),
    checker_issues: r.issues.filter(i => i.type !== "guardrail"),
    guardrails: r.issues.filter(i => i.type === "guardrail"),
    signals: r.signals ?? [], recording: r.recording ?? null, prescription: r.prescription ?? null, must_say: r.must ?? [],
  };
}

/** A grade is usable only when it covers every criterion with a true/false pass (Sonnet sometimes drops the flag). */
function gradedOk(g: Record<string, unknown> | null, count: number): boolean {
  const c = g?.criteria;
  return Array.isArray(c) && c.length >= count && c.every(x => typeof (x as { pass?: unknown })?.pass === "boolean");
}

function codeChecks(a: Answer, catalogueLines: string[], tokens: string[], short = false) {
  const text = fullText(a);
  const wc = wordCount(text);
  const names = findNames(text, tokens);
  const banned = findBanned(text);
  const checks = [
    { check: "no swear words or banned phrases", pass: banned.length === 0, why: banned.join(", ") || "clean" },
    { check: "no real member names", pass: names.length === 0, why: names.join(", ") || "none" },
    short
      ? { check: "boundary/privacy reply 15–60 words", pass: wc >= 15 && wc <= 60, why: `${wc} words` }
      : { check: "total under ~110 words", pass: wc <= 120, why: `${wc} words` },
    ...(short ? [] : [
      { check: "stance line max ~15 words", pass: wordCount(a.answer) <= 18, why: `${wordCount(a.answer)} words` },
      { check: "1–4 dot points", pass: a.points.length >= 1 && a.points.length <= 4, why: `${a.points.length} points` },
      { check: "every point has one reason", pass: a.points.every(pt => pt.why.trim().length > 0), why: a.points.every(pt => pt.why.trim()) ? "all have why" : "missing why" },
    ]),
    { check: "ends cleanly", pass: !looksTruncated(a.points.length ? (a.note ?? (a.points[a.points.length - 1].why || a.points[a.points.length - 1].do)) : a.answer), why: a.answer.trim().slice(-30) },
    { check: "valid JSON", pass: true, why: "parsed" },
    { check: "resource null or exact catalogue title", pass: a.resource === null || catalogueLines.includes(a.resource), why: a.resource ?? "null" },
  ];
  return checks;
}

// ---------- self-test ----------
const VERSION = "2026-10-24.26";

async function sameSecret(a: string, b: string): Promise<boolean> {
  const h = async (x: string) => new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(x)));
  const [x, y] = await Promise.all([h(a), h(b)]);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}

/** Claude's test loop: version, data coverage, answers for real members or personas, graded tests (all read-only), plus building member memory. */
// deno-lint-ignore no-explicit-any
async function selfTest(admin: DB, body: any, clock: ReturnType<typeof timing>) {
  const catalogue = typeof body.catalogue === "string" && body.catalogue.trim() ? body.catalogue.slice(0, 20000) : "(none available)";
  const catalogueLines = catalogue.split("\n").map((l: string) => l.trim()).filter(Boolean);
  const vaultSources: Record<string, string> = body.vault_sources && typeof body.vault_sources === "object" ? body.vault_sources : {};
  const extraRules = typeof body.extra_rules === "string" ? body.extra_rules.slice(0, 4000) : undefined;
  const action = body.action ?? "version";

  if (action === "version") return { version: VERSION };

  if (action === "coverage") {
    const { data: profiles } = await admin.from("profiles").select("id, full_name, is_admin, archived_at, gate");
    const members = ((profiles ?? []) as { id: string; full_name: string | null; is_admin: boolean | null; archived_at: string | null; gate: string | null }[])
      .filter(p => !p.is_admin && !p.archived_at);
    const rows = [];
    for (const m of members) {
      const input = await loadMemberInput(admin, m.id);
      const x = input.extras;
      const block = buildMemberBlock(input);
      rows.push({
        id: m.id, name: m.full_name, gate: m.gate,
        context_room_fields: Object.values(input.answers).filter(v => Array.isArray(v) ? v.length : v != null && String(v).trim()).length,
        monthly_totals: input.totals.length, goal: !!input.goal,
        build_tasks: x?.build.length ?? 0, check_ins: x?.check_ins.length ?? 0, clients: x?.clients.count ?? 0, hot_list: x?.pipeline.total ?? 0,
        wins: x?.wins.length ?? 0, content_30d: x?.content_30d.posts ?? 0, ads: x?.ads.length ?? 0, audit: !!x?.audit, weak_modules: x?.weak_modules.length ?? 0,
        review: !!x?.review_focus, coach_notes: x?.coach_notes.length ?? 0, health: !!x?.health, questions: x?.recent_questions.length ?? 0,
        memory: !!x?.memory, instagram_posts: x?.instagram?.posts.length ?? 0, modules_done: x?.modules_done.length ?? 0,
        pages_viewed: x?.training_viewed.length ?? 0, financial_audit: !!x?.financial_audit, prospects: x?.prospects.total ?? 0,
        dm_campaign: x?.dm_campaign.total ?? 0, cash_menu: x?.cash_menu_done.length ?? 0, saved_ideas: x?.saved_ideas ?? 0,
        signals: block.derived ? signals(input, block.derived).map(s => s.problem) : [],
        block_words: block.text.split(/\s+/).length,
      });
    }
    const { data: docs } = await admin.from("knowledge_docs").select("source_type, created_at, source_id");
    const byType: Record<string, number> = {};
    let drive = 0, latest = "";
    for (const d of (docs ?? []) as { source_type: string; created_at: string; source_id: string | null }[]) {
      byType[d.source_type] = (byType[d.source_type] ?? 0) + 1;
      if (d.source_id) drive++;
      if (d.created_at > latest) latest = d.created_at;
    }
    const { count: chunks } = await admin.from("knowledge_chunks").select("id", { count: "exact", head: true });
    const { count: saved } = await admin.from("saved_answers").select("id", { count: "exact", head: true });
    const { data: sync } = await admin.from("drive_sync_state").select("*").limit(5);
    const vaultLines = catalogueLines.filter((l: string) => l.startsWith("Vault · "));
    const linked = new Set(Object.values(vaultSources));
    const driveIds = new Set(((docs ?? []) as { source_id: string | null }[]).map(d => d.source_id).filter(Boolean));
    return {
      version: VERSION, members: rows.length, rows,
      knowledge: { docs: (docs ?? []).length, by_type: byType, from_drive: drive, chunks, saved_answers: saved, latest_doc: latest, drive_sync: sync },
      vault: {
        recordings: vaultLines.length,
        with_guide: vaultLines.filter((l: string) => workshopGuideText([l])).length,
        transcript_in_knowledge: Object.entries(vaultSources).filter(([id]) => driveIds.has(id)).map(([, l]) => l),
        recording_not_in_knowledge: Object.entries(vaultSources).filter(([id]) => !driveIds.has(id)).map(([, l]) => l),
        lines_without_drive_id: vaultLines.filter((l: string) => !linked.has(l)),
      },
    };
  }

  if (action === "ask") {
    const question = String(body.question ?? "").slice(0, 4000);
    const memberId = typeof body.member_id === "string" ? body.member_id : null;
    const synthetic = body.member && typeof body.member === "object" ? { answers: {}, totals: [], goal: null, ...body.member } as MemberInput : null;
    const member = synthetic ?? (body.persona ? persona(String(body.persona)) : memberId ? await loadMemberInput(admin, memberId) : null);
    const mode = synthetic || body.persona ? "test" : body.mode === "admin" ? "admin" : "member";
    const r = await answerPipeline({ admin, question, history: [], catalogue, vaultSources, mode, member, memberId, clock, extraRules });
    const short = wordCount(fullText(r.final)) <= 60 && !r.final.points.length;
    return { version: VERSION, final: r.final, words: wordCount(fullText(r.final)), code_checks: codeChecks(r.final, catalogueLines, [], short), debug: buildDebug(mode, memberId, r.member, r), draft: r.draft };
  }

  if (action === "test") {
    const { data: test } = await admin.from("dan_ai_tests").select("*").eq("name", String(body.test_name ?? "")).maybeSingle();
    if (!test) return { error: "unknown test" };
    const member = persona(test.persona_key);
    const r = await answerPipeline({ admin, question: test.question, history: [], catalogue, vaultSources, mode: "test", member, memberId: null, clock, extraRules });
    const { data: allProfiles } = await admin.from("profiles").select("full_name").or("is_admin.is.null,is_admin.eq.false");
    const tokens = nameTokens(((allProfiles ?? []) as { full_name: string | null }[]).map(x => x.full_name ?? "").filter(Boolean), null);
    const short = !!r.plan.is_boundary || !!r.plan.asks_about_other_member;
    const checks = codeChecks(r.final, catalogueLines, tokens, short);
    let compare = "";
    if (test.name === "ADS_5_DAYS_SCALE" && typeof body.compare_answer === "string") compare = `\n\n=====\n\nTEST 9 ANSWER (for comparison)\n${body.compare_answer}`;
    const brain = await loadBrain(admin);
    const criteria = [...(test.must_include as string[]).map(c => `include: ${c}`), ...(test.must_not as string[]).map(c => `must_not: ${c}`)].join("\n");
    const sys: Block[] = [{ type: "text", text: `${BRAIN_HEADER}\n\n${brain.text}`, cache_control: { type: "ephemeral" } }, { type: "text", text: GRADER_PROMPT }];
    const msg = `${buildMemberBlock(member!).text}\n\nTOTAL WORD COUNT (computed in code, use for length criteria): ${wordCount(fullText(r.final))} across stance + points + note. Do not count resource.\n\n=====\n\nQUESTION\n${test.question}\n\n=====\n\nANSWER\n${JSON.stringify(r.final)}${compare}\n\n=====\n\nCRITERIA\n${criteria}`;
    let graded: Record<string, unknown> | null = null;
    for (let i = 0; i < 3 && !gradedOk(graded, criteria.split("\n").length); i++) graded = parseJson(await callAnthropic(SONNET, sys, [{ role: "user", content: msg }]));
    const crit = Array.isArray(graded?.criteria) ? graded?.criteria as { pass: boolean }[] : [];
    const pass = crit.length > 0 && crit.every(c => c.pass === true) && checks.every(c => c.pass);
    return { version: VERSION, name: test.name, question: test.question, pass, criteria: crit, code_checks: checks, final: r.final, debug: buildDebug("test", null, member, r) };
  }

  if (action === "refresh_memory") {
    const ids: string[] = Array.isArray(body.member_ids) ? body.member_ids.filter((x: unknown) => typeof x === "string").slice(0, 8) : [];
    const results = [];
    for (const id of ids) results.push({ id, ...(await refreshMemory(admin, id, true)) });
    return { results };
  }

  if (action === "jobs") {
    const { data } = await admin.from("transcription_jobs").select("title, status, error, provider, created_at, submitted_at, completed_at, transcript_chars, drive_file_id").order("created_at", { ascending: false }).limit(25);
    const { data: mem } = await admin.from("member_memory").select("user_id, refreshed_at, dirty_at, instagram_handle, instagram_fetched_at, summary").limit(100);
    return { jobs: data ?? [], memory_rows: ((mem ?? []) as { user_id: string; refreshed_at: string | null; dirty_at: string; instagram_handle: string | null; summary: string }[]).map(m => ({ ...m, summary: m.summary?.slice(0, 80) })) };
  }

  if (action === "vault_check") {
    // Per Vault entry: which of its Drive files are in the knowledge base, and any doc whose title names it or its date.
    const items: { line: string; ids: string[]; name: string; date: string | null }[] = Array.isArray(body.items) ? body.items.slice(0, 60) : [];
    const { data: docs } = await admin.from("knowledge_docs").select("id, title, source_id, source_type, word_count");
    const rows = (docs ?? []) as { id: string; title: string; source_id: string | null; source_type: string; word_count: number | null }[];
    const norm = (x: string) => x.toLowerCase().replace(/[™®]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
    return {
      items: items.map(it => {
        const byId = rows.filter(r => r.source_id && it.ids.includes(r.source_id));
        const byName = it.name.length >= 5 ? rows.filter(r => norm(r.title).includes(norm(it.name))) : [];
        const byDate = it.date ? rows.filter(r => r.title.includes(it.date!)) : [];
        const found = [...new Map([...byId, ...byName, ...byDate].map(r => [r.id, r])).values()];
        return { line: it.line, found: found.map(r => `${r.source_type}: ${r.title} (${r.word_count ?? "?"} words)`) };
      }),
    };
  }

  if (action === "ingest_text") {
    // Text Claude pulled from a workbook or doc the Drive sync can't reach, chunked like drive-sync does.
    const title = String(body.title ?? "").slice(0, 300), sourceId = String(body.source_id ?? "").slice(0, 200), content = String(body.content ?? "");
    const type = ["teaching", "note", "transcript", "call"].includes(body.source_type) ? body.source_type : "teaching";
    if (!title || !sourceId || content.trim().length < 200) return { error: "title, source_id and content (200+ chars) required" };
    const { data: existing } = await admin.from("knowledge_docs").select("id").eq("source_id", sourceId).maybeSingle();
    if (existing && !body.replace) return { skipped: "already in knowledge", id: existing.id };
    if (existing) await admin.from("knowledge_docs").delete().eq("id", existing.id);
    const clean = content.replace(/\r\n/g, "\n").trim();
    const chunks: string[] = [];
    for (let start = 0; start < clean.length;) {
      let end = Math.min(start + 1400, clean.length);
      if (end < clean.length) { const br = clean.lastIndexOf("\n\n", end); if (br > start + 700) end = br; }
      const piece = clean.slice(start, end).trim();
      if (piece) chunks.push(piece);
      if (end >= clean.length) break;
      start = Math.max(end - 200, start + 1);
    }
    const { data: doc, error } = await admin.from("knowledge_docs").insert({ title, source_type: type, source_id: sourceId, source_url: body.source_url ?? null, word_count: clean.split(/\s+/).length }).select("id").single();
    if (error || !doc) return { error: error?.message ?? "insert failed" };
    for (let i = 0; i < chunks.length; i += 100) {
      const { error: e } = await admin.from("knowledge_chunks").insert(chunks.slice(i, i + 100).map((c, j) => ({ doc_id: doc.id, chunk_index: i + j, content: c })));
      if (e) return { error: e.message };
    }
    return { ingested: title, chunks: chunks.length };
  }

  if (action === "set_live") {
    // Opens Dan AI to members (or closes it) once the verification loop passes.
    const { error } = await admin.from("admin_settings").upsert({ key: "dan_ai_members_live", value: body.live === true ? "true" : "false", updated_at: new Date().toISOString() }, { onConflict: "key" });
    return error ? { error: error.message } : { live: body.live === true };
  }

  if (action === "list_tests") {
    const { data } = await admin.from("dan_ai_tests").select("name, category, persona_key, question, must_include, must_not, position").eq("active", true).order("position");
    return { tests: data ?? [] };
  }
  return { error: "unknown action" };
}

// ---------- handler ----------
Deno.serve(async (req) => {
  const clock = timing();
  const authStart = performance.now();
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  try {
    // Scheduled memory rebuild (pg_cron), authenticated by the database's cron token instead of a user.
    const cronAdmin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    if (await isCronCall(cronAdmin, req)) {
      const body = await req.json().catch(() => ({}));
      const admin = cronAdmin;
      const { data: rows } = await admin.from("member_memory").select("user_id, dirty_at, refreshed_at").order("dirty_at", { ascending: false }).limit(200);
      const due = ((rows ?? []) as { user_id: string; dirty_at: string; refreshed_at: string | null }[])
        .filter(r => !r.refreshed_at || r.dirty_at > r.refreshed_at).slice(0, Math.min(Number(body.limit) || 10, 25));
      const results = [];
      for (const r of due) results.push({ user_id: r.user_id, ...(await refreshMemory(admin, r.user_id)) });
      return json({ refreshed: results.length, results });
    }

    // Self-test (Claude's verification loop), authenticated by the DAN_AI_TEST_KEY secret. Off when the secret isn't set.
    const testKey = Deno.env.get("DAN_AI_TEST_KEY");
    const givenKey = req.headers.get("x-dan-ai-test-key");
    if (testKey && givenKey && await sameSecret(testKey, givenKey)) {
      const admin = cronAdmin;
      const body = await req.json().catch(() => ({}));
      return json(await selfTest(admin, body, clock));
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
    const scoped = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
    const { data: userData } = await scoped.auth.getUser();
    if (!userData?.user) return json({ error: "Unauthorized" }, 401);
    const userId = userData.user.id;
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: isAdminRaw } = await admin.rpc("is_admin", { _user_id: userId });
    const isAdmin = isAdminRaw === true;

    clock.data.steps.auth = Math.round(performance.now() - authStart);
    const body = await req.json().catch(() => ({}));
    const uuidRe = /^[0-9a-f-]{36}$/i;
    const catalogue = typeof body.catalogue === "string" && body.catalogue.trim() ? body.catalogue.slice(0, 20000) : "(none available)";
    const catalogueLines = catalogue.split("\n").map((l: string) => l.trim()).filter(Boolean);
    // Drive file id -> Vault catalogue line, so transcripts can point back at their recording.
    const vaultSources: Record<string, string> = body.vault_sources && typeof body.vault_sources === "object"
      ? Object.fromEntries(Object.entries(body.vault_sources as Record<string, unknown>).filter(([k, v]) => /^[\w-]{10,100}$/.test(k) && typeof v === "string").slice(0, 300) as [string, string][])
      : {};

    // ----- TEST actions (admin only) -----
    if (body.action) {
      if (!isAdmin) return json({ error: "Admins only" }, 403);

      if (body.action === "refresh_memory") {
        if (!uuidRe.test(body.member_id ?? "")) return json({ error: "member_id required" }, 400);
        const result = await refreshMemory(admin, body.member_id, true);
        const { data } = await admin.from("member_memory").select("memory, summary, refreshed_at").eq("user_id", body.member_id).maybeSingle();
        return json({ ...result, ...data });
      }

      if (body.action === "start_run") {
        const { data, error } = await admin.from("dan_ai_test_runs").insert({ round: Number(body.round) || 1 }).select("id").single();
        if (error || !data) return json({ error: "Could not start a test run" }, 500);
        return json({ run_id: data.id });
      }

      if (body.action === "test") {
        if (!uuidRe.test(body.run_id ?? "") || !uuidRe.test(body.test_id ?? "")) return json({ error: "run_id and test_id required" }, 400);
        const { data: test } = await admin.from("dan_ai_tests").select("*").eq("id", body.test_id).single();
        const member = persona(test.persona_key);
        if (!member) return json({ error: `Unknown persona ${test.persona_key}` }, 400);
        const r = await answerPipeline({ admin, question: test.question, history: [], catalogue, vaultSources, mode: "test", member, memberId: null, clock });
        const { data: allProfiles } = await admin.from("profiles").select("full_name").or("is_admin.is.null,is_admin.eq.false");
        const tokens = nameTokens(((allProfiles ?? []) as { full_name: string | null }[]).map(x => x.full_name ?? "").filter(Boolean), null);
        const short = !!r.plan.is_boundary || !!r.plan.asks_about_other_member;
        const checks = codeChecks(r.final, catalogueLines, tokens, short);
        const debug = buildDebug("test", null, member, r);
        await admin.from("dan_ai_test_results").upsert({ run_id: body.run_id, test_id: test.id, answer: r.final, debug, code_checks: checks, criteria: [], pass: null }, { onConflict: "run_id,test_id" });
        await admin.from("dan_ai_checks").insert({ user_id: userId, question: `[TEST ${test.name}] ${test.question}`, draft: r.draft, final: r.final, pass: r.pass, issues: r.issues, timing: r.timing });
        return json({ ok: true, answer: r.final, code_checks: checks });
      }

      if (body.action === "grade") {
        const { data: res } = await admin.from("dan_ai_test_results").select("*, dan_ai_tests(*)").eq("run_id", body.run_id).eq("test_id", body.test_id).single();
        if (!res) return json({ error: "No result to grade" }, 404);
        const test = res.dan_ai_tests;
        const brain = await loadBrain(admin);
        const member = persona(test.persona_key);
        if (!member) return json({ error: "Unknown persona" }, 400);
        let compare = "";
        if (test.name === "ADS_5_DAYS_SCALE") {
          const { data: t9 } = await admin.from("dan_ai_test_results").select("answer, dan_ai_tests!inner(name)").eq("run_id", body.run_id).eq("dan_ai_tests.name", "ADS_5_DAYS_EARLY").maybeSingle();
          compare = `\n\n=====\n\nTEST 9 ANSWER (for comparison)\n${t9?.answer ? fullText(t9.answer as Answer) : "(missing)"}`;
        }
        const criteria = [
          ...(test.must_include as string[]).map(c => `include: ${c}`),
          ...(test.must_not as string[]).map(c => `must_not: ${c}`),
        ].join("\n");
        const sys: Block[] = [{ type: "text", text: `${BRAIN_HEADER}\n\n${brain.text}`, cache_control: { type: "ephemeral" } }, { type: "text", text: GRADER_PROMPT }];
const counted = wordCount(res.answer ? fullText(res.answer as Answer) : "");
        const msg = `${buildMemberBlock(member).text}\n\nTOTAL WORD COUNT (computed in code, use for length criteria): ${counted} across stance + points + note. Do not count resource.\n\n=====\n\nQUESTION\n${test.question}\n\n=====\n\nANSWER\n${JSON.stringify(res.answer)}${compare}\n\n=====\n\nCRITERIA\n${criteria}`;
        let graded: Record<string, unknown> | null = null;
        for (let i = 0; i < 3 && !gradedOk(graded, criteria.split("\n").length); i++) graded = parseJson(await callAnthropic(SONNET, sys, [{ role: "user", content: msg }]));
        const crit = Array.isArray(graded?.criteria) ? graded?.criteria as { pass: boolean }[] : [];
        const codeOk = (res.code_checks as { pass: boolean }[]).every(c => c.pass);
        const pass = crit.length > 0 && crit.every(c => c.pass === true) && codeOk;
        await admin.from("dan_ai_test_results").update({ criteria: crit, pass }).eq("id", res.id);
        return json({ ok: true, pass, criteria: crit });
      }

      if (body.action === "finalize") {
        const { data: rows } = await admin.from("dan_ai_test_results").select("pass, criteria, code_checks, answer, debug, dan_ai_tests(name, category, position)").eq("run_id", body.run_id);
        const list = (rows ?? []) as unknown as { pass: boolean | null; criteria: { pass: boolean }[]; code_checks: { pass: boolean }[]; dan_ai_tests: { name: string; category: string; position: number } }[];
        const critTotal = list.reduce((n, r) => n + r.criteria.length, 0);
        const critPass = list.reduce((n, r) => n + r.criteria.filter(c => c.pass).length, 0);
        const summary = {
          tests_total: list.length, tests_passed: list.filter(r => r.pass).length,
          criteria_total: critTotal, criteria_passed: critPass,
          failed: list.filter(r => !r.pass).map(r => r.dan_ai_tests.name),
          privacy_boundary_pass: list.filter(r => ["privacy", "boundary"].includes(r.dan_ai_tests.category)).every(r => r.pass),
        };
        await admin.from("dan_ai_test_runs").update({ summary, results: list }).eq("id", body.run_id);
        return json({ summary });
      }
      return json({ error: "Unknown action" }, 400);
    }

    // ----- chat -----
    const question = typeof body.question === "string" ? body.question.trim().slice(0, 4000) : "";
    if (!question) return json({ error: "Ask a question first" }, 400);
    const threadId = typeof body.thread_id === "string" && uuidRe.test(body.thread_id) ? body.thread_id : crypto.randomUUID();

    let mode: "member" | "admin" = "member";
    let memberId: string | null = userId;
    // Admin command centre: one question across every active client.
    const allClients = isAdmin && body.member_id === "all";
    if (allClients) {
      const runRoster = async (status?: (status: string) => void) => {
        status?.("Reading every client's numbers, gates and memory…");
        const [{ data: past }, roster, brain] = await Promise.all([
          admin.from("dan_ai_messages").select("role, content").eq("user_id", userId).eq("thread_id", threadId).order("created_at", { ascending: false }).limit(10),
          loadRoster(admin), loadBrain(admin),
        ]);
        const history = ((past ?? []) as Turn[]).reverse().map(m => {
          const a = m.role === "assistant" ? toAnswer(parseJson(m.content)) : null;
          return `${m.role === "user" ? "DAN" : "ANALYST"}: ${a ? fullText(a) : m.content}`;
        }).join("\n\n") || "(none)";
        status?.(`Cross-checking ${roster.clients} clients against Dan's playbook…`);
        const sys: Block[] = [
          ...(brain.text ? [{ type: "text" as const, text: `${BRAIN_HEADER}\n\n${brain.text}`, cache_control: { type: "ephemeral" as const } }] : []),
          { type: "text", text: ROSTER_PROMPT },
        ];
        let answer: Answer | null = null;
        for (let i = 0; i < 2 && !answer; i++) {
          answer = toAnswer(parseJson(await clock.measure(i ? "draft_retry" : "draft", () => callMain(sys, [{ role: "user", content: `${roster.text}\n\n=====\n\nCONVERSATION SO FAR\n${history}\n\n=====\n\nDAN ASKS: ${question}${i ? "\nReturn valid JSON only." : ""}` }], clock.data, "draft"))));
        }
        const final: Answer = answer ? { ...answer, points: answer.points.slice(0, 8), resource: null } : { answer: "Couldn't read the client list just now — try again.", points: [], note: null, resource: null };
        await admin.from("dan_ai_messages").insert([
          { user_id: userId, thread_id: threadId, role: "user", content: question },
          { user_id: userId, thread_id: threadId, role: "assistant", content: JSON.stringify({ ...final, all_clients: true }) },
        ]);
        return { ...final, thread_id: threadId, all_clients: true, sources: { clients: roster.clients }, debug: { mode: "all_clients", member_id: null, timing: clock.finish(), roster_clients: roster.clients, roster_words: roster.text.split(/\s+/).length } };
      };
      if (body.stream === true) {
        const encoder = new TextEncoder();
        const stream = new ReadableStream({ start(controller) {
          let connected = true;
          const emit = (event: string, data: unknown) => { if (connected) { try { controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)); } catch { connected = false; } } };
          runRoster(status => emit("status", { status })).then(result => emit("answer", result)).catch(() => emit("error", { error: "Could not read your clients — try again" })).finally(() => { if (connected) controller.close(); });
        } });
        return new Response(stream, { headers: { ...corsHeaders, "Content-Type": "text/event-stream", "Cache-Control": "no-cache" } });
      }
      return json(await runRoster());
    }
    if (isAdmin) {
      mode = "admin";
      memberId = typeof body.member_id === "string" && uuidRe.test(body.member_id) ? body.member_id : null;
    } else if (body.member_id && body.member_id !== userId) {
      return json({ error: "Admins only" }, 403);
    }

    const memberPromise = clock.measure("context_load", () => memberId ? loadMemberInput(admin, memberId) : Promise.resolve(null));
    const execute = async (status?: (status: string) => void) => {
    status?.("Reading your numbers…");
    // Numbers over 35 days old (or none yet): send them to the Monthly Check-In first, then they come back
    // for advice built on where they really are. Help with a named build task doesn't depend on numbers.
    // "stale" = over 35 days since the end of their latest month (see derive in context.ts).
    if (mode === "member" && !buildTaskTitle(question)) {
      const m = await memberPromise;
      const d = m ? buildMemberBlock(m).derived : null;
      if (d && d.data_freshness !== "fresh") {
        const [y, mo] = (d.latest_month ?? "").split("-").map(Number);
        const month = new Date(Date.UTC(y, mo - 1, 15)).toLocaleDateString("en-AU", { month: "long", timeZone: "UTC" });
        const final: Answer = {
          answer: d.data_freshness === "none"
            ? "Submit your first Monthly Check-In, then come back and I'll map out your next move off your real numbers."
            : `Your latest numbers are from ${month}. Submit your Monthly Check-In, then come back and I'll build your next move off where you're really at.`,
          points: [], note: null, resource: null,
        };
        const cta = { label: "Submit your Monthly Check-In", href: "/submissions/monthly" };
        await admin.from("dan_ai_messages").insert([
          { user_id: userId, thread_id: threadId, role: "user", content: question },
          { user_id: userId, thread_id: threadId, role: "assistant", content: JSON.stringify({ ...final, context_used: true, cta }) },
        ]);
        return { ...final, thread_id: threadId, context_used: true, cta };
      }
    }
    const { data: past } = await admin.from("dan_ai_messages").select("role, content").eq("user_id", userId).eq("thread_id", threadId)
      .order("created_at", { ascending: false }).limit(10);
    const history: Turn[] = (past ?? []).reverse().map((m: Turn) => {
      const a = m.role === "assistant" ? toAnswer(parseJson(m.content)) : null;
      return { role: m.role, content: a ? fullText(a) : m.content };
    });
    const r = await answerPipeline({ admin, question, history, catalogue, vaultSources, mode, member: memberPromise, memberId, clock, status });
    const member = r.member;
    const sources = buildSources(r);
    await Promise.all([
      admin.from("dan_ai_checks").insert({ user_id: userId, question, draft: r.draft, final: r.final, pass: r.pass, issues: r.issues, timing: r.timing }),
      admin.from("dan_ai_messages").insert([
        { user_id: userId, thread_id: threadId, role: "user", content: question },
        { user_id: userId, thread_id: threadId, role: "assistant", content: JSON.stringify({ ...r.final, context_used: r.block.hasContext, sources }) },
      ]),
      admin.from("client_questions").insert({ user_id: userId, question, answer: r.final.answer, next_steps: r.final.points.map(pt => pt.why ? `${pt.do} — ${pt.why}` : pt.do), resource: r.final.resource }),
    ]);

    if (memberId && mode === "member") refreshInBackground(admin, memberId, member);
    return {
      ...r.final, thread_id: threadId, context_used: r.block.hasContext, sources,
      ...(isAdmin ? { debug: buildDebug(mode, memberId, member, r) } : {}),
    };
    };
    if (body.stream === true) {
      const encoder = new TextEncoder();
      const stream = new ReadableStream({ start(controller) {
        let connected = true;
        const emit = (event: string, data: unknown) => { if (connected) { try { controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)); } catch { connected = false; } } };
        execute(status => emit("status", { status })).then(result => emit("answer", result)).catch(() => emit("error", { error: "Could not get a checked answer — try again" })).finally(() => { if (connected) controller.close(); });
      } });
      return new Response(stream, { headers: { ...corsHeaders, "Content-Type": "text/event-stream", "Cache-Control": "no-cache" } });
    }
    return json(await execute());
  } catch (err) {
    console.error("ask-dan error", err);
    return json({ error: err instanceof Error ? err.message : "Unexpected error" }, 500);
  }
});

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
import { loadExtras } from "./dossier.ts";
import { IG_REFRESH_MS, cleanHandle, fetchRecentPosts } from "./instagram.ts";
import { persona } from "./testPersonas.ts";
import { BRAIN_HEADER, CHECKER_PROMPT, FLAG_REPLY, GRADER_PROMPT, MEMORY_PROMPT, NAME_FALLBACK, PLAN_PROMPT, draftPrompt } from "./prompts.ts";
import { findBanned, findNames, hasCostPerClient, looksTruncated, matchResource, nameTokens, redact, repairCostPerClient, wordCount } from "./guardrails.ts";

const SONNET = "claude-sonnet-5-5";
const HAIKU = "claude-haiku-5-5";
const SOURCE_TAGS: Record<string, string> = {
  teaching: "Workshop/Q&A", transcript: "Training", note: "Note", whatsapp: "Dan in WhatsApp", call: "1:1 call",
};
const GROUP_CALL = /momentum|q&a|q & a|workshop|hot seat|powerup|power up|pay to play|edit flow/i;

type Point = { do: string; why: string };
type Answer = { answer: string; points: Point[]; note: string | null; resource: string | null };
type Turn = { role: "user" | "assistant"; content: string };
type Block = { type: "text"; text: string; cache_control?: { type: "ephemeral" } };
type Plan = { topic?: string; is_boundary?: boolean; asks_about_other_member?: boolean; search_terms?: string[]; member_facts_needed?: string[]; gate_relevant?: boolean };
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
    body: JSON.stringify({ model, max_tokens: stage === "plan" ? 400 : stage === "other" ? 4000 : 1200, thinking: { type: "disabled" }, system, messages }),
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
      .select("month, mrr, mrr_manual, total_revenue, oneoff_revenue, expenses, new_clients, leads_generated, booked_calls, calls_showed, offers_made, ad_spend, content_posts")
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
  const { data: row } = await admin.from("member_memory").select("memory, refreshed_at, dirty_at, refresh_started_at, instagram_handle, instagram_fetched_at").eq("user_id", memberId).maybeSingle();
  const now = Date.now();
  if (!force && row?.refresh_started_at && now - Date.parse(row.refresh_started_at) < 2 * 60 * 1000) return { ok: true, skipped: "in progress" };
  if (!force && row?.refreshed_at && row.dirty_at <= row.refreshed_at) return { ok: true, skipped: "up to date" };
  const startedAt = new Date().toISOString();
  await admin.from("member_memory").upsert({ user_id: memberId, refresh_started_at: startedAt }, { onConflict: "user_id" });
  // Their Instagram: pulled at most every 2 days (or when the handle changes), cached on the memory row.
  const { data: room } = await admin.from("context_rooms").select("answers").eq("user_id", memberId).maybeSingle();
  const handle = cleanHandle((room?.answers as Record<string, unknown> | null)?.instagram_handle);
  if (handle && (handle !== row?.instagram_handle || !row?.instagram_fetched_at || now - Date.parse(row.instagram_fetched_at) > IG_REFRESH_MS)) {
    try {
      const posts = await fetchRecentPosts(handle);
      if (posts) await admin.from("member_memory").update({ instagram: posts, instagram_handle: handle, instagram_fetched_at: new Date().toISOString() }).eq("user_id", memberId);
    } catch (err) { console.error("instagram pull failed", handle, err); }
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
  const timeout = setTimeout(() => controller.abort(), 4000);
  try {
    const parsed = parseJson(await callAnthropic(HAIKU, [{ type: "text", text: PLAN_PROMPT, cache_control: { type: "ephemeral" } }],
      [{ role: "user", content: `RECENT CONVERSATION: ${convo}\nQUESTION: ${question}` }], false, metrics, "plan", controller.signal)) as Plan | null;
    if (parsed && Array.isArray(parsed.search_terms)) return { plan: parsed, fallback: false };
  } catch {
    metrics.calls.push({ stage: "plan", model: HAIKU, ms: 4000, input_tokens: 0, cache_read_input_tokens: 0, cache_creation_input_tokens: 0, output_tokens: 0, retry: false, error: controller.signal.aborted ? "4s deadline; keyword fallback" : "plan failed; keyword fallback" });
  } finally { clearTimeout(timeout); }
  // Classification remains conservative; the full draft/checker still adjudicates boundaries from the question.
  const boundary = /(?:ProfitX.*(?:bill|paus|cancel|refund|invoice)|(?:paus|cancel|refund|invoice).*ProfitX|mental health|legal|personal crisis)/i.test(question);
  const privacy = /(?:what.*(?:making|revenue)|who.*gate|other members?)/i.test(question);
  return { plan: { topic: boundary ? "boundary" : privacy ? "privacy" : /ads?|campaign|leads?|scal/i.test(question) ? "ads" : "other", is_boundary: boundary, asks_about_other_member: privacy, search_terms: keywordTerms(question) }, fallback: true };
}

// ---------- retrieval ----------
type Chunk = { chunk_id: string; doc_id: string; title: string; source_type: string; content: string; rank: number };
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
    ? await admin.from("knowledge_docs").select("id, created_at").in("id", [...new Set(cands.map(c => c.doc_id))])
    : { data: [] };
  const age = new Map<string, number>((docs ?? []).map((d: { id: string; created_at: string }) => [d.id, (Date.now() - Date.parse(d.created_at)) / 86400000]));
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
  return picked.map(c => ({ ...c, content: relevantExcerpt(c.content, lowerTerms) }));
}

// ---------- the pipeline ----------
type PipelineInput = {
  admin: DB; question: string; history: Turn[]; catalogue: string;
  mode: "member" | "admin" | "test"; member: MemberInput | null | Promise<MemberInput | null>; memberId: string | null;
  clock: ReturnType<typeof timing>; status?: (status: string) => void;
};
async function answerPipeline(p: PipelineInput) {
  const issues: { type: string; note: string }[] = [];
  const privacy = p.mode !== "admin";
  const clock = p.clock;
  const planned = clock.measure("plan", () => runPlan(p.question, p.history, clock.data));
  const [brain, member, { data: allProfiles }, catalogue] = await Promise.all([
    clock.measure("brain_load", () => loadBrain(p.admin)), p.member, p.admin.from("profiles").select("id, full_name"), Promise.resolve(p.catalogue),
  ]);
  const askerName = member?.name ?? null;
  p.status?.("Thinking…");
  const otherNames = ((allProfiles ?? []) as { id: string; full_name: string | null }[])
    .filter(x => x.id !== p.memberId && x.full_name).map(x => x.full_name ?? "");
  const tokens = nameTokens(otherNames, p.mode === "test" ? null : askerName);

  const block = member ? buildMemberBlock(member) : { text: "ABOUT THIS MEMBER: none (general answer, no member selected).", derived: null, hasContext: false, summary: "no member" };
  const { plan, fallback: planFallback } = await planned;
  const passages = await clock.measure("retrieval", () => retrieve(p.admin, p.question, plan, { privacy, askerName, otherTokens: tokens }));
  const passageText = passages.map(c => `[${SOURCE_TAGS[c.source_type] ?? c.source_type}] ${c.title}\n${c.content}`).join("\n\n---\n\n");

  const brainBlock: Block[] = brain.text ? [{ type: "text", text: `${BRAIN_HEADER}\n\n${brain.text}`, cache_control: { type: "ephemeral" } }] : [];
  const catalogueLines = p.catalogue.split("\n").map(l => l.trim()).filter(Boolean);
  const draftSystem: Block[] = [...brainBlock, { type: "text", text: draftPrompt([], ""), cache_control: { type: "ephemeral" } }];
  const convo = p.history.map(t => `${t.role === "user" ? "MEMBER" : "DAN"}: ${t.content}`).join("\n\n") || "(none)";
  const userTurn = `RESOURCES YOU CAN POINT TO (exact line or null)\n${catalogue}\n\n${block.text}\n\n=====\n\nDAN'S KNOWLEDGE — real advice Dan has given (use for detail and phrasing; the Brain wins on conflict)\n\n${passageText || "(nothing matched)"}\n\n=====\n\nCONVERSATION SO FAR\n${convo}\n\n=====\n\nTHE MEMBER ASKED: ${p.question}`;

  // DRAFT (retry once on invalid JSON)
  let draft: Answer | null = null;
  for (let i = 0; i < 2 && !draft; i++) draft = toAnswer(parseJson(await clock.measure(i ? "draft_retry" : "draft", () => callMain(draftSystem, [{ role: "user", content: userTurn + (i ? '\nReturn valid JSON only. Escape newlines inside strings. Use answer, points [{do, why}], note and resource.' : '') }], clock.data, "draft"))));
  if (!draft) {
    issues.push({ type: "guardrail", note: "Draft JSON invalid twice — flagged to Dan" });
    const final: Answer = { answer: FLAG_REPLY, points: [], note: null, resource: null };
    return { draft: final, final, pass: false, issues, plan, passages, brain, block, planFallback, member, timing: clock.finish() };
  }

  // CHECK
  p.status?.("Checking with Dan's playbook…");
  const checkSystem: Block[] = [...brainBlock, { type: "text", text: CHECKER_PROMPT, cache_control: { type: "ephemeral" } }];
  const checkBase = `RESOURCES\n${catalogue}\n\nPASSAGES\n${passageText}\n\n${block.text}\n\n=====\n\nCONVERSATION SO FAR\n${convo}\n\n=====\n\nQUESTION\n${p.question}\n\n=====\n\nPLAN\n${JSON.stringify(plan)}`;
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
    const shortReply = !!plan.is_boundary || !!plan.asks_about_other_member;
    if (shortReply) {
      if (wordCount(text) < 15 || wordCount(text) > 60) out.push("boundary/privacy reply must be 15–60 words");
      if (a.points.length || a.note) out.push("boundary/privacy reply must be 1–2 short lines, no points or note");
    } else {
      if (a.points.length < 2 || a.points.length > 4) out.push("needs 2–4 dot points");
      if (a.points.some(pt => !pt.why.trim())) out.push("each point needs one short reason");
      if (wordCount(a.answer) > 18) out.push("stance must be max ~15 words");
      if (wordCount(text) > 130) out.push("cut to under ~110 words total");
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
  const shortReply = !!plan.is_boundary || !!plan.asks_about_other_member;
  const maximum = shortReply ? 60 : 115;
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
  if (wordCount(fullText(final)) > maximum) {
    if (shortReply) {
      const sentences = final.answer.split(/(?<=[.!?])\s+|\n+/);
      let kept = "";
      for (const sentence of sentences) { if (wordCount(kept + " " + sentence) > maximum) break; kept += (kept ? "\n" : "") + sentence; }
      if (kept) final = { ...final, answer: kept };
    } else {
      // Drop the lowest-priority points (and the note) until the total fits.
      let pts = [...final.points];
      let note = final.note;
      while (note && wordCount(fullText({ ...final, points: pts, note })) > maximum) note = null;
      while (pts.length > 2 && wordCount(fullText({ ...final, points: pts, note })) > maximum) pts = pts.slice(0, -1);
      final = { ...final, points: pts, note };
    }
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
    probs = problems(final);
  }
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

  return { draft, final, pass, issues, plan, passages, brain, block, planFallback, member, timing: clock.finish() };
}

function buildDebug(mode: string, memberId: string | null, member: MemberInput | null, r: Awaited<ReturnType<typeof answerPipeline>>) {
  return {
    mode, member_id: memberId, timing: r.timing,
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
  };
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
      { check: "2–4 dot points", pass: a.points.length >= 2 && a.points.length <= 4, why: `${a.points.length} points` },
      { check: "every point has one reason", pass: a.points.every(pt => pt.why.trim().length > 0), why: a.points.every(pt => pt.why.trim()) ? "all have why" : "missing why" },
    ]),
    { check: "ends cleanly", pass: !looksTruncated(a.points.length ? (a.note ?? (a.points[a.points.length - 1].why || a.points[a.points.length - 1].do)) : a.answer), why: a.answer.trim().slice(-30) },
    { check: "valid JSON", pass: true, why: "parsed" },
    { check: "resource null or exact catalogue title", pass: a.resource === null || catalogueLines.includes(a.resource), why: a.resource ?? "null" },
  ];
  return checks;
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
        const r = await answerPipeline({ admin, question: test.question, history: [], catalogue, mode: "test", member, memberId: null, clock });
        const { data: allProfiles } = await admin.from("profiles").select("full_name");
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
        for (let i = 0; i < 2 && !graded; i++) graded = parseJson(await callAnthropic(SONNET, sys, [{ role: "user", content: msg }]));
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
    if (isAdmin) {
      mode = "admin";
      memberId = typeof body.member_id === "string" && uuidRe.test(body.member_id) ? body.member_id : null;
    } else if (body.member_id && body.member_id !== userId) {
      return json({ error: "Admins only" }, 403);
    }

    const memberPromise = clock.measure("context_load", () => memberId ? loadMemberInput(admin, memberId) : Promise.resolve(null));
    const execute = async (status?: (status: string) => void) => {
    status?.("Reading your numbers…");
    const { data: past } = await admin.from("dan_ai_messages").select("role, content").eq("user_id", userId).eq("thread_id", threadId)
      .order("created_at", { ascending: false }).limit(10);
    const history: Turn[] = (past ?? []).reverse().map((m: Turn) => {
      const a = m.role === "assistant" ? toAnswer(parseJson(m.content)) : null;
      return { role: m.role, content: a ? fullText(a) : m.content };
    });
    const r = await answerPipeline({ admin, question, history, catalogue, mode, member: memberPromise, memberId, clock, status });
    const member = r.member;
    await Promise.all([
      admin.from("dan_ai_checks").insert({ user_id: userId, question, draft: r.draft, final: r.final, pass: r.pass, issues: r.issues, timing: r.timing }),
      admin.from("dan_ai_messages").insert([
        { user_id: userId, thread_id: threadId, role: "user", content: question },
        { user_id: userId, thread_id: threadId, role: "assistant", content: JSON.stringify({ ...r.final, context_used: r.block.hasContext }) },
      ]),
      admin.from("client_questions").insert({ user_id: userId, question, answer: r.final.answer, next_steps: r.final.points.map(pt => pt.why ? `${pt.do} — ${pt.why}` : pt.do), resource: r.final.resource }),
    ]);

    if (memberId && mode === "member") refreshInBackground(admin, memberId, member);
    return {
      ...r.final, thread_id: threadId, context_used: r.block.hasContext,
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

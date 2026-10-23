// Dan AI — answers like Dan, for the member asking.
// Pipeline: auth/mode → Brain (cached) → member context + DERIVED (code) → PLAN (Haiku)
//   → RETRIEVE (scored, privacy-filtered) → DRAFT (Sonnet) → CHECK (Sonnet) → code GUARDRAILS.
// Modes: MEMBER (asker), ADMIN (optional "Context from" member), TEST (admin + synthetic persona).
// Debug is returned to admins only. Test actions: test / grade / finalize (admin only).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { joinChunks, fetchStyleExamples } from "../_shared/danBrain.ts";
import type { ContextAnswers } from "../_shared/contextRoom.ts";
import { buildMemberBlock, type MemberInput } from "./context.ts";
import { persona } from "./testPersonas.ts";
import { BRAIN_HEADER, CHECKER_PROMPT, FLAG_REPLY, GRADER_PROMPT, NAME_FALLBACK, PLAN_PROMPT, draftPrompt } from "./prompts.ts";
import { findBanned, findNames, looksTruncated, matchResource, nameTokens, redact, wordCount } from "./guardrails.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SONNET = "claude-sonnet-5";
const HAIKU = "claude-haiku-5-5";
const SOURCE_TAGS: Record<string, string> = {
  teaching: "Workshop/Q&A", transcript: "Training", note: "Note", whatsapp: "Dan in WhatsApp", call: "1:1 call",
};
const GROUP_CALL = /momentum|q&a|q & a|workshop|hot seat|powerup|power up|pay to play|edit flow/i;

type Answer = { answer: string; next_steps: string[]; resource: string | null };
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
  return {
    answer,
    next_steps: Array.isArray(o.next_steps) ? o.next_steps.map(String).filter(Boolean).slice(0, 3) : [],
    resource: o.resource && o.resource !== "null" ? String(o.resource) : null,
  };
}

// ---------- model calls ----------
async function callAnthropic(model: string, system: Block[], messages: Turn[], retried = false): Promise<string> {
  const key = Deno.env.get("ANTHROPIC_API_KEY");
  if (!key) throw new Error("No Anthropic key");
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model, max_tokens: 4000, system, messages }),
  });
  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const text = (data.content ?? []).filter((b: { type: string }) => b.type === "text").map((b: { text: string }) => b.text).join("");
  if (data.stop_reason === "max_tokens" && !retried) {
    return callAnthropic(model, system, [...messages, { role: "assistant", content: text || "(cut off)" }, { role: "user", content: "Be shorter. Return the complete JSON." }], true);
  }
  if (!text) throw new Error(`Claude returned no content (stop_reason: ${data.stop_reason ?? "unknown"})`);
  return text;
}
async function callGemini(system: Block[], messages: Turn[], retried = false): Promise<string> {
  const key = Deno.env.get("LOVABLE_API_KEY");
  if (!key) throw new Error("No AI key configured");
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash", max_tokens: 4000,
      messages: [{ role: "system", content: system.map(b => b.text).join("\n\n") }, ...messages],
    }),
  });
  if (!res.ok) throw new Error(`Lovable gateway ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const text = data.choices?.[0]?.message?.content ?? "";
  if (data.choices?.[0]?.finish_reason === "length" && !retried) {
    return callGemini(system, [...messages, { role: "assistant", content: text || "(cut off)" }, { role: "user", content: "Be shorter. Return the complete JSON." }], true);
  }
  if (!text) throw new Error("Gateway returned no content");
  return text;
}
/** Sonnet, falling back to Gemini if Anthropic fails. */
async function callMain(system: Block[], messages: Turn[]): Promise<string> {
  try { return await callAnthropic(SONNET, system, messages); }
  catch (err) {
    if (!Deno.env.get("LOVABLE_API_KEY")) throw err;
    console.error("Claude failed, falling back to Gemini:", err);
    return await callGemini(system, messages);
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
  const [{ data: profile }, { data: room }, { data: totals }, { data: goal }] = await Promise.all([
    admin.from("profiles").select("full_name, business_overview, gate, gate_key_task, gate_move_up").eq("id", memberId).maybeSingle(),
    admin.from("context_rooms").select("answers").eq("user_id", memberId).maybeSingle(),
    admin.from("monthly_totals")
      .select("month, mrr, mrr_manual, total_revenue, oneoff_revenue, expenses, new_clients, leads_generated, booked_calls, calls_showed, offers_made, ad_spend, content_posts")
      .eq("user_id", memberId).order("month", { ascending: false }).limit(3),
    admin.from("goals").select("starting_mrr, target_mrr, target_date, retainer_tier_1, retainer_tier_2, retainer_tier_3").eq("user_id", memberId).maybeSingle(),
  ]);
  const answers = { ...((room?.answers ?? {}) as ContextAnswers) };
  delete (answers as Record<string, unknown>).anything_else;
  return {
    name: profile?.full_name ?? null, business_overview: profile?.business_overview ?? null,
    gate: profile?.gate ?? null, gate_key_task: profile?.gate_key_task ?? null, gate_move_up: profile?.gate_move_up ?? null,
    answers, totals: totals ?? [], goal: goal ?? null,
  };
}

// ---------- plan ----------
const STOP = new Set("the and for with that this what how should does have from your about just into they them then than when will would could i'm i've my me you are can get got its it's".split(" "));
function keywordTerms(q: string) {
  return [...new Set(q.toLowerCase().replace(/[^a-z0-9$\s]/g, " ").split(/\s+/).filter(w => w.length > 2 && !STOP.has(w)))].slice(0, 12);
}
async function runPlan(question: string, history: Turn[], summary: string): Promise<{ plan: Plan; fallback: boolean }> {
  const convo = history.slice(-4).map(t => `${t.role === "user" ? "MEMBER" : "DAN"}: ${t.content.slice(0, 500)}`).join("\n") || "(none)";
  const msg: Turn[] = [{ role: "user", content: `MEMBER SUMMARY: ${summary}\n\nRECENT CONVERSATION:\n${convo}\n\nQUESTION: ${question}` }];
  const sys: Block[] = [{ type: "text", text: PLAN_PROMPT }];
  for (const model of [HAIKU, SONNET]) {
    try {
      const p = parseJson(await callAnthropic(model, sys, msg)) as Plan | null;
      if (p && Array.isArray(p.search_terms)) return { plan: p, fallback: false };
    } catch (err) { console.error(`plan via ${model} failed`, err); }
  }
  return { plan: { topic: "other", search_terms: keywordTerms(question) }, fallback: true };
}

// ---------- retrieval ----------
type Chunk = { chunk_id: string; doc_id: string; title: string; source_type: string; content: string; rank: number };
type Scored = Chunk & { score: number };
async function retrieve(admin: DB, question: string, plan: Plan, opts: { privacy: boolean; askerName: string | null; otherTokens: string[] }) {
  const search = async (q: string, n: number): Promise<Chunk[]> => q.trim() ? ((await admin.rpc("search_knowledge", { q, limit_n: n })).data ?? []) : [];
  const terms = (plan.search_terms ?? []).map(s => String(s).trim()).filter(Boolean).slice(0, 15);
  const ladder = [terms.join(" or "), question, keywordTerms(question).join(" or ")];
  const seen = new Map<string, Chunk>();
  for (const q of ladder) {
    if (seen.size >= 60) break;
    for (const c of await search(q, 60)) if (!seen.has(c.chunk_id) && seen.size < 60) seen.set(c.chunk_id, c);
  }
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
    if (picked.length >= 20) break;
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
  return picked;
}

// ---------- the pipeline ----------
type PipelineInput = {
  admin: DB; question: string; history: Turn[]; catalogue: string;
  mode: "member" | "admin" | "test"; member: MemberInput | null; memberId: string | null;
};
async function answerPipeline(p: PipelineInput) {
  const issues: { type: string; note: string }[] = [];
  const privacy = p.mode !== "admin";
  const [brain, styleExamples, { data: allProfiles }] = await Promise.all([
    loadBrain(p.admin), fetchStyleExamples(p.admin, 30), p.admin.from("profiles").select("id, full_name"),
  ]);
  const askerName = p.member?.name ?? null;
  const otherNames = ((allProfiles ?? []) as { id: string; full_name: string | null }[])
    .filter(x => x.id !== p.memberId && x.full_name).map(x => x.full_name!);
  const tokens = nameTokens(otherNames, p.mode === "test" ? null : askerName);

  const block = p.member ? buildMemberBlock(p.member) : { text: "ABOUT THIS MEMBER: none (general answer, no member selected).", derived: null, hasContext: false, summary: "no member" };
  const { plan, fallback: planFallback } = await runPlan(p.question, p.history, block.summary);
  const passages = await retrieve(p.admin, p.question, plan, { privacy, askerName, otherTokens: tokens });
  const passageText = passages.map(c => `[${SOURCE_TAGS[c.source_type] ?? c.source_type}] ${c.title}\n${c.content}`).join("\n\n---\n\n");

  const brainBlock: Block[] = brain.text ? [{ type: "text", text: `${BRAIN_HEADER}\n\n${brain.text}`, cache_control: { type: "ephemeral" } }] : [];
  const catalogueLines = p.catalogue.split("\n").map(l => l.trim()).filter(Boolean);
  const draftSystem: Block[] = [...brainBlock, { type: "text", text: draftPrompt(styleExamples, p.catalogue) }];
  const convo = p.history.map(t => `${t.role === "user" ? "MEMBER" : "DAN"}: ${t.content}`).join("\n\n") || "(none)";
  const userTurn = `${block.text}\n\n=====\n\nDAN'S KNOWLEDGE — real advice Dan has given (use for detail and phrasing; the Brain wins on conflict)\n\n${passageText || "(nothing matched)"}\n\n=====\n\nCONVERSATION SO FAR\n${convo}\n\n=====\n\nTHE MEMBER ASKED: ${p.question}`;

  // DRAFT (retry once on invalid JSON)
  let draft: Answer | null = null;
  for (let i = 0; i < 2 && !draft; i++) draft = toAnswer(parseJson(await callMain(draftSystem, [{ role: "user", content: userTurn }])));
  if (!draft) {
    issues.push({ type: "guardrail", note: "Draft JSON invalid twice — flagged to Dan" });
    const final = { answer: FLAG_REPLY, next_steps: [], resource: null };
    return { draft: final, final, pass: false, issues, plan, passages, brain, block, planFallback };
  }

  // CHECK
  const checkSystem: Block[] = [...brainBlock, { type: "text", text: CHECKER_PROMPT }];
  const checkBase = `${block.text}\n\n=====\n\nCONVERSATION SO FAR\n${convo}\n\n=====\n\nQUESTION\n${p.question}\n\n=====\n\nPLAN\n${JSON.stringify(plan)}`;
  const runCheck = async (current: Answer, extra = ""): Promise<{ final: Answer; pass: boolean; issues: { type: string; note: string }[] } | null> => {
    for (let i = 0; i < 2; i++) {
      try {
        const parsed = parseJson(await callMain(checkSystem, [{ role: "user", content: `${checkBase}\n\n=====\n\nDRAFT\n${JSON.stringify(current)}${extra ? `\n\n=====\n\nMUST FIX: ${extra}` : ""}` }]));
        const fin = toAnswer(parsed?.final);
        if (parsed && fin) return { final: fin, pass: parsed.pass === true, issues: Array.isArray(parsed.issues) ? parsed.issues as { type: string; note: string }[] : [] };
      } catch (err) { console.error("checker call failed", err); }
    }
    return null;
  };
  let pass = false;
  let final: Answer = draft;
  const checked = await runCheck(draft);
  if (checked) { final = checked.final; pass = checked.pass; issues.push(...checked.issues); }
  else { issues.push({ type: "guardrail", note: "Checker returned invalid JSON twice — using draft with code checks" }); }

  // GUARDRAILS — collect problems, send back to the checker once.
  const problems = (a: Answer) => {
    const text = [a.answer, ...a.next_steps].join("\n");
    const out: string[] = [];
    const names = privacy ? findNames(text, tokens) : [];
    if (names.length) out.push(`remove other member names (${names.join(", ")})`);
    const banned = findBanned(text);
    if (banned.length) out.push(`rewrite the lines containing banned phrases/swearing: ${banned.join(", ")}`);
    if (looksTruncated(a.answer)) out.push("the answer is cut off — finish it cleanly");
    const shortReply = !!plan.is_boundary || !!plan.asks_about_other_member;
    if (wordCount(a.answer) > (shortReply ? 60 : 220)) out.push(shortReply ? "cut to under 60 words" : "cut to under 170 words");
    // Ads/scaling/pricing questions must use the member's cost per client — only when it was actually computed.
    const cpc = block.derived?.cost_per_client;
    if (typeof cpc === "number" && Number.isFinite(cpc) && !shortReply) {
      if (["ads", "pricing", "sales", "offer"].includes(String(plan.topic)) && !/\$\s?\d/.test(a.answer.replace(/\$(15|20)\b/g, ""))) {
        out.push(`use their cost per client in dollars (~$${Math.round(cpc)} a client vs their lowest retainer${block.derived?.lowest_retainer_price ? ` $${block.derived.lowest_retainer_price}` : ""}) and say whether it's under half`);
      } else if (plan.topic === "ads" && !a.answer.includes(String(Math.round(cpc)))) {
        out.push(`use their cost per client in dollars (~$${Math.round(cpc)} a client) and say whether it's under half their first month's fee`);
      }
    }
    // Sequence rule: follow-up problem + allowed to scale → scaling must be conditional on speed to lead.
    if (/no (booked )?calls|not booking|aren'?t booking|slow (to )?repl|leads? but no|not calling|haven'?t called/i.test(p.question) && /\bscal/i.test(a.answer) && !/15\s*[–-]\s*30/.test(a.answer)) {
      out.push(`put follow-up first and make scaling conditional: "you can scale, but only once you're calling every lead within 15–30 mins"`);
    }
    return { out, names };
  };
  let probs = problems(final);
  if (probs.out.length) {
    issues.push({ type: "guardrail", note: `Sent back to checker: ${probs.out.join("; ")}` });
    const again = await runCheck(final, probs.out.join("; "));
    if (again) { final = again.final; issues.push(...again.issues.map(x => ({ ...x, note: `(round 2) ${x.note}` }))); }
    probs = problems(final);
    if (probs.names.length) {
      issues.push({ type: "guardrail", note: "Member names still present — replaced with the privacy reply" });
      final = { answer: NAME_FALLBACK, next_steps: [], resource: null };
    } else if (probs.out.length) {
      issues.push({ type: "guardrail", note: `Still failing after rewrite: ${probs.out.join("; ")}` });
    }
    pass = false;
  }
  // JSON parsed fine, so an unpunctuated ending is style, not a cut-off: close it.
  if (looksTruncated(final.answer) && /[A-Za-z0-9]$/.test(final.answer.trim())) final = { ...final, answer: final.answer.trim() + "." };
  const matched = matchResource(final.resource, catalogueLines);
  if (final.resource && !matched) issues.push({ type: "guardrail", note: `Resource "${final.resource}" not in catalogue — removed` });
  final = { ...final, resource: matched };

  return { draft, final, pass, issues, plan, passages, brain, block, planFallback };
}

function buildDebug(mode: string, memberId: string | null, member: MemberInput | null, r: Awaited<ReturnType<typeof answerPipeline>>) {
  return {
    mode, member_id: memberId,
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
  const text = [a.answer, ...a.next_steps].join("\n");
  const wc = wordCount(a.answer);
  const names = findNames(text, tokens);
  const banned = findBanned(text);
  const [min, max] = short ? [15, 60] : [40, 220];
  return [
    { check: "no swear words or banned phrases", pass: banned.length === 0, why: banned.join(", ") || "clean" },
    { check: "no real member names", pass: names.length === 0, why: names.join(", ") || "none" },
    { check: `answer ${min}–${max} words`, pass: wc >= min && wc <= max, why: `${wc} words` },
    { check: "ends cleanly", pass: !looksTruncated(a.answer), why: a.answer.trim().slice(-30) },
    { check: "valid JSON", pass: true, why: "parsed" },
    { check: "resource null or exact catalogue title", pass: a.resource === null || catalogueLines.includes(a.resource), why: a.resource ?? "null" },
  ];
}

// ---------- handler ----------
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
    const scoped = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
    const { data: userData } = await scoped.auth.getUser();
    if (!userData?.user) return json({ error: "Unauthorized" }, 401);
    const userId = userData.user.id;
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: isAdminRaw } = await admin.rpc("is_admin", { _user_id: userId });
    const isAdmin = isAdminRaw === true;

    const body = await req.json().catch(() => ({}));
    const uuidRe = /^[0-9a-f-]{36}$/i;
    const catalogue = typeof body.catalogue === "string" && body.catalogue.trim() ? body.catalogue.slice(0, 20000) : "(none available)";
    const catalogueLines = catalogue.split("\n").map((l: string) => l.trim()).filter(Boolean);

    // ----- TEST actions (admin only) -----
    if (body.action) {
      if (!isAdmin) return json({ error: "Admins only" }, 403);

      if (body.action === "start_run") {
        const { data } = await admin.from("dan_ai_test_runs").insert({ round: Number(body.round) || 1 }).select("id").single();
        return json({ run_id: data.id });
      }

      if (body.action === "test") {
        if (!uuidRe.test(body.run_id ?? "") || !uuidRe.test(body.test_id ?? "")) return json({ error: "run_id and test_id required" }, 400);
        const { data: test } = await admin.from("dan_ai_tests").select("*").eq("id", body.test_id).single();
        const member = persona(test.persona_key);
        if (!member) return json({ error: `Unknown persona ${test.persona_key}` }, 400);
        const r = await answerPipeline({ admin, question: test.question, history: [], catalogue, mode: "test", member, memberId: null });
        const { data: allProfiles } = await admin.from("profiles").select("full_name");
        const tokens = nameTokens(((allProfiles ?? []) as { full_name: string | null }[]).map(x => x.full_name ?? "").filter(Boolean), null);
        const short = !!r.plan.is_boundary || !!r.plan.asks_about_other_member;
        const checks = codeChecks(r.final, catalogueLines, tokens, short);
        const debug = buildDebug("test", null, member, r);
        await admin.from("dan_ai_test_results").upsert({ run_id: body.run_id, test_id: test.id, answer: r.final, debug, code_checks: checks, criteria: [], pass: null }, { onConflict: "run_id,test_id" });
        await admin.from("dan_ai_checks").insert({ user_id: userId, question: `[TEST ${test.name}] ${test.question}`, draft: r.draft, final: r.final, pass: r.pass, issues: r.issues });
        return json({ ok: true, answer: r.final, code_checks: checks });
      }

      if (body.action === "grade") {
        const { data: res } = await admin.from("dan_ai_test_results").select("*, dan_ai_tests(*)").eq("run_id", body.run_id).eq("test_id", body.test_id).single();
        if (!res) return json({ error: "No result to grade" }, 404);
        const test = res.dan_ai_tests;
        const brain = await loadBrain(admin);
        const member = persona(test.persona_key)!;
        let compare = "";
        if (test.name === "ADS_5_DAYS_SCALE") {
          const { data: t9 } = await admin.from("dan_ai_test_results").select("answer, dan_ai_tests!inner(name)").eq("run_id", body.run_id).eq("dan_ai_tests.name", "ADS_5_DAYS_EARLY").maybeSingle();
          compare = `\n\n=====\n\nTEST 9 ANSWER (for comparison)\n${t9?.answer?.answer ?? "(missing)"}`;
        }
        const criteria = [
          ...(test.must_include as string[]).map(c => `include: ${c}`),
          ...(test.must_not as string[]).map(c => `must_not: ${c}`),
        ].join("\n");
        const sys: Block[] = [{ type: "text", text: `${BRAIN_HEADER}\n\n${brain.text}`, cache_control: { type: "ephemeral" } }, { type: "text", text: GRADER_PROMPT }];
        const msg = `${buildMemberBlock(member).text}\n\n=====\n\nQUESTION\n${test.question}\n\n=====\n\nANSWER\n${JSON.stringify(res.answer)}${compare}\n\n=====\n\nCRITERIA\n${criteria}`;
        let graded: Record<string, unknown> | null = null;
        for (let i = 0; i < 2 && !graded; i++) graded = parseJson(await callAnthropic(SONNET, sys, [{ role: "user", content: msg }]));
        const crit = Array.isArray(graded?.criteria) ? graded!.criteria as { pass: boolean }[] : [];
        const codeOk = (res.code_checks as { pass: boolean }[]).every(c => c.pass);
        const pass = crit.length > 0 && crit.every(c => c.pass === true) && codeOk;
        await admin.from("dan_ai_test_results").update({ criteria: crit, pass }).eq("id", res.id);
        return json({ ok: true, pass, criteria: crit });
      }

      if (body.action === "finalize") {
        const { data: rows } = await admin.from("dan_ai_test_results").select("pass, criteria, code_checks, answer, debug, dan_ai_tests(name, category, position)").eq("run_id", body.run_id);
        const list = (rows ?? []) as { pass: boolean | null; criteria: { pass: boolean }[]; code_checks: { pass: boolean }[]; dan_ai_tests: { name: string; category: string; position: number } }[];
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

    const { data: past } = await admin.from("dan_ai_messages").select("role, content").eq("user_id", userId).eq("thread_id", threadId)
      .order("created_at", { ascending: false }).limit(10);
    const history: Turn[] = (past ?? []).reverse().map((m: Turn) => {
      if (m.role === "assistant") { const a = toAnswer(parseJson(m.content)); return { role: "assistant", content: a ? a.answer : m.content }; }
      return { role: "user", content: m.content };
    });

    const member = memberId ? await loadMemberInput(admin, memberId) : null;
    const r = await answerPipeline({ admin, question, history, catalogue, mode, member, memberId });

    await Promise.all([
      admin.from("dan_ai_checks").insert({ user_id: userId, question, draft: r.draft, final: r.final, pass: r.pass, issues: r.issues }),
      admin.from("dan_ai_messages").insert([
        { user_id: userId, thread_id: threadId, role: "user", content: question },
        { user_id: userId, thread_id: threadId, role: "assistant", content: JSON.stringify({ ...r.final, context_used: r.block.hasContext }) },
      ]),
      admin.from("client_questions").insert({ user_id: userId, question, answer: r.final.answer, next_steps: r.final.next_steps, resource: r.final.resource }),
    ]);

    return json({
      ...r.final, thread_id: threadId, context_used: r.block.hasContext,
      ...(isAdmin ? { debug: buildDebug(mode, memberId, member, r) } : {}),
    });
  } catch (err) {
    console.error("ask-dan error", err);
    return json({ error: err instanceof Error ? err.message : "Unexpected error" }, 500);
  }
});

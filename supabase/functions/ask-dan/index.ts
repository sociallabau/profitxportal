// Dan AI — the on-demand personal consultant for every ProfitX member.
//
// Two steps per question:
//   1. DRAFT — Dan's Brain (whole, cached) + this member's context + every
//      uploaded knowledge source except the Brain + Dan's voice.
//   2. CHECK — Sonnet reviews the draft against the Brain only and returns the
//      final answer. Every check is logged to dan_ai_checks (admin-only).
// Admins can draft for a picked member (member_id), answering with THEIR context.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { joinChunks, fetchStyleExamples } from "../_shared/danBrain.ts";
import { buildContextMarkdown, type ContextAnswers } from "../_shared/contextRoom.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BRAIN_HEADER = `DAN'S BRAIN — THE RULEBOOK. Dan's frameworks, Gate criteria, default numbers, playbook answers, voice and boundaries. These take priority over everything else.`;

const FLAG_REPLY = "Let me flag that one to Dan — he'll get back to you.";

const SOURCE_TAGS: Record<string, string> = {
  teaching: "Workshop/Q&A",
  transcript: "Training",
  note: "Note",
  whatsapp: "WhatsApp",
  call: "1:1 call",
};

const BASE_VOICE = `Dan Wilmott runs ProfitX, coaching videographers to build retainer businesses. Write exactly as Dan speaks to a client:
- Direct and warm, Australian, no corporate speak
- Short paragraphs with line breaks, not essays
- Plain words over jargon — explain the thing rather than naming it
- Confident and practical: tell them what to do, don't hedge
- No emoji, and never open with "Great question"`;

const THINKING = `HOW DAN LOOKS AT ANY SET OF NUMBERS

Before anything smaller, four things, in this order:

1. Revenue — is it making money, and how much
2. Leads — is enough coming in the top
3. Cost to acquire a client (CAC/CPA) — what a client costs against what they are worth
4. Conversion rate — how much of what comes in turns into money

Those four decide the verdict. Everything else — CPM, click-through, form fill rate, posting volume, individual expense lines, follower counts — is detail that explains those four. Raise a detail only when it changes the answer, or when one of the four is bad and the detail is the reason why.

Never open on a small metric. Never list every number you were given. Lead with the four, give the verdict, then the one or two details that actually decide it.

HOW DAN TEACHES GROWTH (apply this to any business question, not just ad campaigns)

The business is one chain, and every question lands somewhere on it:

  content posted + ad spend  ->  leads  ->  closed  ->  revenue

What matters is the joins, not the individual numbers:
- What a piece of content is actually worth — revenue divided by posts
- What a lead costs — ad spend divided by leads
- Conversion — how many leads become clients
- Cost to acquire a client against what that client is worth

What Dan works to. These are principles, not fixed numbers — the right figure depends entirely on their stage, their price point and their market, so never quote a specific target as if it applies to everyone:

- Leads: they need to arrive every week, and lead generation never gets switched off, even at capacity. Switch it off and you feel it three months later. What volume is enough depends on their price point — someone selling $1,500 packages needs a very different number to someone selling $6,000 retainers. Judge their lead flow against their own recent history and their capacity, not against a number you have picked.
- Speed to lead: respond while they are still interested. Slow replies lose deals that were already won.
- Conversion: a very high conversion rate is a pricing problem, not a win — it usually means they are too cheap. Some resistance on price is healthy.
- Cost to acquire: under half what a client is worth. A quarter is excellent, and means the answer is to spend more, not less.
- Capacity: know what each person can actually deliver per month, and review client scope regularly. The cheapest tier is often the one eating the most hours.
- Profit is the point. Revenue with nothing left after costs is not a healthy business, however big the top line looks.

When someone is stuck, find where on the chain it breaks before giving advice. Not enough leads is a completely different problem to plenty of leads converting badly, which is different again to good conversion at a price that leaves nothing behind.

WHAT THEIR REVENUE IS MADE OF

These are videographers: their revenue is retainers plus one-off work — shoots, edits, single projects. Revenue above their retainer value is normal and needs no explanation. Never try to reconcile the difference or treat it as a discrepancy. Recurring revenue is what matters for growth; one-off work sits on top of it.

THE QUESTIONS THAT COME FIRST

Two, in order: are they signing new retainer clients, and what are they turning over?

- NOT SIGNING — the growth engine is the whole conversation, whatever their revenue. Content and ad spend into leads, leads into calls, calls into signed retainers. Find the step that is actually empty.
- SIGNING, UNDER $15k A MONTH — do not suggest hiring or handing work over; they are too early. Delivery pain at this level almost always means they are undercharging or over-delivering, and that is what to address.
- SIGNING, $15–20k A MONTH OR ABOVE — now it is about getting out of delivery. If they have not started getting help, that is the shift to push.

Never give scaling advice to someone who is not signing. Never tell someone under $15k to hire their way out of a pricing problem. Never pick apart an engine that is working.

Signed clients with no leads, no calls and no offers logged is missing tracking, not a referral and not something clever happening off-book. Call it out: they need to know where clients came from and how, because a month that worked cannot be repeated if nobody knows what caused it.

Apply that whenever the question touches numbers or the state of their business.`;

const TIGHT_RULES = `TIGHT RULES (apply to every answer)
1. GATE PRIORITY ORDER: when choosing the one priority, follow the Brain's hierarchy: Retainers → Convos → Content → Ads. If they're short on paying retainers for their gate, the priority is always to get the next PAYING retainer, before case studies, posts or ads.
2. ANSWER THE QUESTION THEY ASKED: if they ask "am I at Gate X?", the first line must answer yes or no, with the exact reason from the Brain's definitions (e.g. "free / case-study clients don't count as paying retainers").
3. ONE LINE PER PLAN, WITH DAN'S RULE: when they list several plans, give each one the specific rule from the Brain or playbook-answers, not a generic "wait until later". Examples: ad spend always sits ON TOP of the fee through the client's ad account, never inside the price; never switch off awareness/lead gen to save cash; the editor cue is ~$15–20k/mo; the ad step for their gate (Gate 1 = $50 PV boost behind best posts).
4. TELL THEM WHAT TO DO, NOT JUST WHAT NOT TO DO: every "not yet" needs the right step for their current gate.
5. BOUNDARIES ARE NARROW: "flag to Dan" is ONLY for their ProfitX billing, pausing, cancelling, refunds, legal, health and personal crises. Decisions about THEIR OWN business spending (ads vs editor, hiring, pricing) are normal coaching. Answer them using the Brain.
6. VOICE: open with a direct stance in Dan's words ("Not quite yet bro", "Nah", "Yeha"). Short lines, under about 180 words. No consultant phrases ("pump the brakes", "mid-strategy", "let's slow down", "moves the needle"). No swearing.
7. EXACT NUMBERS: Quote Dan's exact numbers from the Brain, never paraphrase them. Speed to lead = call within 15–30 mins. Don't touch a new campaign for 7 days. Scale only when a client costs under half their first month's fee. Creatives: add more to the same campaign.
8. NO GENERIC TIPS: Don't add generic marketing tips that aren't in the Brain or the passages.
9. USE THEIR CONTEXT: If ABOUT THIS MEMBER has anything relevant to the question (their offer, what's working, their known blocker, their gate), the answer MUST use at least one specific detail from it. The checker should fail any answer that ignores relevant member context.
10. LENGTH: Keep it under about 150 words. One priority, no 'two things to check' lists.
11. USE THE NUMBERS: Before answering, read ABOUT THIS MEMBER and do the maths Dan would do: MRR, new clients, ad spend ÷ new clients = cost per client, and compare it to their retainer price using the Brain's rules (e.g. scale when cost per client is under half the first month's fee). Your answer MUST use at least one of their real numbers when it's relevant. The checker fails any answer that ignores relevant member numbers.
12. DATA NOTES: obey any "DATA NOTES" in ABOUT THIS MEMBER (expired goals, old numbers, untracked calls, unreliable revenue) exactly as written.`;

function draftPrompt(voice: string, styleExamples: string[], catalogue: string) {
  return `You are Dan Wilmott answering one of his ProfitX members directly, as their on-demand personal consultant.

HOW DAN WRITES
${voice}
${styleExamples.length ? `\nREAL MESSAGES DAN HAS SENT (match this voice, casing, rhythm and length):\n${styleExamples.map(l => `- ${l}`).join("\n")}\n` : ""}
${THINKING}

DRAFT RULES
- The Brain wins over passages if they conflict. Use passages for real examples, detail and Dan's actual phrasing.
- Place the member first: work out their current Gate from their context and what they say, and give advice for THAT gate. Never give advice from a later gate.
- ProfitX Gate criteria, definitions, hold rules and Dan's taught defaults are fixed. Quote them exactly. "Never quote a specific target" applies only to market metrics like CPL and CTR.
- If the Brain's playbook-answers has a matching question, base the answer on Dan's answer there.
- Use the member's own niche, prices and numbers naturally. Don't say "according to your profile". If a missing detail would change the advice, give the default and say which Context Room field to fill in.
- Read questions literally ("I've got 2 retainers" = 2 in total).
- One clear priority, not a list of equal tips.
- Follow the Brain's boundaries file. Billing, pausing, cancelling, refunds, legal, health and anything sensitive → "flag to Dan", and don't handle it.
- WhatsApp and call passages are Dan's real advice to real members. Use the advice and reasoning. Never say who it was said to, and never repeat another person's numbers or situation, unless it's a group case study in the Brain.
- Dan's voice from the Brain's voice file and the style examples. Never swear.
- This is a conversation: earlier messages are included, so answer the latest message in that context.
- Give 1 to 3 concrete next steps only if the question calls for action. Point to one resource from the catalogue only if it genuinely fits, using its exact title.

${TIGHT_RULES}

RESOURCES YOU CAN POINT TO
${catalogue}

RETURN FORMAT
Output JSON only, no markdown fence: {"answer": "...", "next_steps": ["..."], "resource": "exact title or null"}`;
}

const CHECKER_PROMPT = `You are Dan's quality checker. Check the DRAFT against DAN'S BRAIN and fix it. Check, in this order:
1. PRIVACY: does it name another member, or reveal another person's revenue, numbers, health, finances, family or situation (other than a group case study in the Brain)? If so, remove it.
2. BOUNDARIES: if the question is billing, pausing, cancelling, refunds, legal, health or sensitive, the answer must be a short 'flag to Dan' reply, per the Brain's boundaries file.
3. GATE: has it placed the member at the right Gate and given advice for that gate only? Are the Gate criteria, definitions and defaults quoted exactly as the Brain states them?
4. PLAYBOOK: if the Brain has a matching playbook answer, does the draft follow it, including Dan's default numbers?
5. ACCURACY: does it state any number, rule or claim that contradicts the Brain? Fix it to match the Brain.
6. QUESTION: did it answer what was actually asked, read literally?
7. FOCUS + VOICE: one clear priority, short lines, Dan's voice, no swearing, no corporate language.
Also enforce these:
${TIGHT_RULES}
13. Don't make the draft more cautious or more formal. Only change it to fix a rule breach, a privacy issue or a wrong fact. If you rewrite, keep it in Dan's voice and at the same length or shorter.
If the draft passes everything, return it unchanged. If not, rewrite only what's needed, keeping Dan's voice.
Return only JSON: {"pass": true|false, "issues": [{"type": "privacy|boundary|gate|playbook|accuracy|question|voice", "note": "..."}], "final": {"answer": "...", "next_steps": ["..."], "resource": "..."}}`;

type Answer = { answer: string; next_steps: string[]; resource: string | null };
type Turn = { role: "user" | "assistant"; content: string };
type Block = { type: "text"; text: string; cache_control?: { type: "ephemeral" } };

function stripFence(raw: string) {
  return raw.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
}

function parseJson(raw: string): Record<string, unknown> | null {
  const cleaned = stripFence(raw);
  try { return JSON.parse(cleaned); } catch { /* try the outer object */ }
  const m = cleaned.match(/\{[\s\S]*\}/);
  if (m) { try { return JSON.parse(m[0]); } catch { /* invalid */ } }
  // Models sometimes put raw line breaks inside strings; pull the fields out directly.
  const field = (k: string, next: string) =>
    cleaned.match(new RegExp(`"${k}"\\s*:\\s*"([\\s\\S]*?)"\\s*,\\s*"${next}"`))?.[1];
  const answer = field("answer", "next_steps");
  if (answer) {
    const steps = cleaned.match(/"next_steps"\s*:\s*\[([\s\S]*?)\]/)?.[1] ?? "";
    const resource = cleaned.match(/"resource"\s*:\s*"([^"]*)"/)?.[1] ?? null;
    const unq = (t: string) => t.replace(/\\n/g, "\n").replace(/\\"/g, '"');
    return {
      answer: unq(answer),
      next_steps: [...steps.matchAll(/"((?:[^"\\]|\\.)*)"/g)].map(x => unq(x[1])),
      resource,
    };
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

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const SHORTER = "Your last reply was cut off. Give the same answer again, much shorter, and return the complete JSON.";

async function callAnthropic(system: Block[], messages: Turn[], maxTokens = 4000, retried = false): Promise<string> {
  const key = Deno.env.get("ANTHROPIC_API_KEY");
  if (!key) throw new Error("No Anthropic key");
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model: "claude-sonnet-5", max_tokens: maxTokens, system, messages }),
  });
  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const text = (data.content ?? []).filter((b: { type: string }) => b.type === "text").map((b: { text: string }) => b.text).join("");
  if (data.stop_reason === "max_tokens" && !retried) {
    return callAnthropic(system, [...messages, { role: "assistant", content: text || "(cut off)" }, { role: "user", content: SHORTER }], maxTokens, true);
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
      model: "google/gemini-2.5-flash",
      max_tokens: 4000,
      messages: [{ role: "system", content: system.map(b => b.text).join("\n\n") }, ...messages],
    }),
  });
  if (!res.ok) throw new Error(`Lovable gateway ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const text = data.choices?.[0]?.message?.content ?? "";
  if (data.choices?.[0]?.finish_reason === "length" && !retried) {
    return callGemini(system, [...messages, { role: "assistant", content: text || "(cut off)" }, { role: "user", content: SHORTER }], true);
  }
  if (!text) throw new Error(`Gateway returned no content (finish_reason: ${data.choices?.[0]?.finish_reason ?? "unknown"})`);
  return text;
}

// deno-lint-ignore no-explicit-any
async function loadBrain(admin: any): Promise<{ text: string; docs: number; words: number }> {
  const { data: docs } = await admin
    .from("knowledge_docs").select("id, title, created_at").eq("source_type", "brain").order("created_at");
  if (!docs?.length) return { text: "", docs: 0, words: 0 };
  const { data: rows } = await admin
    .from("knowledge_chunks").select("doc_id, chunk_index, content")
    .in("doc_id", docs.map((d: { id: string }) => d.id)).order("chunk_index").limit(10000);
  const text = docs.map((d: { id: string; title: string }) => {
    const parts = (rows ?? []).filter((r: { doc_id: string }) => r.doc_id === d.id).map((r: { content: string }) => r.content);
    return `## ${d.title}\n\n${joinChunks(parts)}`;
  }).join("\n\n");
  return { text, docs: docs.length, words: text.split(/\s+/).filter(Boolean).length };
}

// deno-lint-ignore no-explicit-any
async function loadMember(admin: any, memberId: string): Promise<{ text: string; name: string | null; stats: { totals_count: number; totals_months: string[]; room_found: boolean; room_fields_filled: number }; goalStatus: string }> {
  const [{ data: profile }, { data: room }, { data: totals }, { data: goal }] = await Promise.all([
    admin.from("profiles").select("full_name, business_overview").eq("id", memberId).maybeSingle(),
    admin.from("context_rooms").select("answers").eq("user_id", memberId).maybeSingle(),
    admin.from("monthly_totals")
      .select("month, mrr, mrr_manual, total_revenue, oneoff_revenue, expenses, new_clients, leads_generated, booked_calls, calls_showed, offers_made, ad_spend, content_posts")
      .eq("user_id", memberId).order("month", { ascending: false }).limit(3),
    admin.from("goals")
      .select("starting_mrr, target_mrr, target_date, retainer_tier_1, retainer_tier_2, retainer_tier_3")
      .eq("user_id", memberId).maybeSingle(),
  ]);
  const answers = { ...((room?.answers ?? {}) as ContextAnswers) };
  delete (answers as Record<string, unknown>).anything_else;
  const lines: string[] = [];
  if (profile?.full_name) lines.push(`Name: ${profile.full_name}`);
  if (profile?.business_overview) lines.push(`Business overview: ${profile.business_overview}`);
  lines.push("", "Context Room:", buildContextMarkdown(answers, null, null) || "(not filled in yet)");
  const notes: string[] = [];
  const today = new Date();
  const goalExpired = !!goal?.target_date && new Date(goal.target_date) < today;
  if (goalExpired) notes.push(`The 90-day goal's target date (${goal!.target_date}) has passed — do NOT treat it as a current goal. Add one line asking them to set a new goal in their Context Room.`);
  const latest = totals?.[0];
  if (latest) {
    // month is the first of the month; count age from the end of that month.
    const ageDays = (today.getTime() - new Date(latest.month).getTime()) / 86400000 - 31;
    if (ageDays > 45) {
      const mName = new Date(latest.month).toLocaleString("en-AU", { month: "long", timeZone: "UTC" });
      notes.push(`Latest monthly totals are old. Use them, but say "based on your ${mName} numbers" and nudge them to submit their latest totals.`);
    }
  }
  for (const t of totals ?? []) {
    if (t.booked_calls === 0 && (t.new_clients ?? 0) > 0) notes.push(`${t.month}: booked_calls = 0 with new clients signed means calls were NOT TRACKED, not that there were no calls.`);
    const mrr = t.mrr ?? t.mrr_manual;
    if (t.total_revenue != null && mrr != null && t.total_revenue < mrr) notes.push(`${t.month}: total_revenue is lower than MRR, so it's unreliable — use MRR (${mrr}) instead.`);
  }
  lines.push("", "Last 3 monthly totals:");
  if (totals?.length) {
    for (const t of totals) {
      lines.push(`- ${t.month}: ${Object.entries(t).filter(([k, v]) => k !== "month" && v !== null).map(([k, v]) => `${k} ${v}`).join(", ")}`);
    }
  } else lines.push("- none submitted yet");
  lines.push("", "90-day goal:");
  lines.push(goal ? Object.entries(goal).filter(([, v]) => v !== null).map(([k, v]) => `- ${k}: ${v}`).join("\n") || "- not set" : "- not set");
  const filled = Object.values(answers).filter(v => v !== null && v !== undefined && String(v).trim() !== "").length;
  return {
    text: [...lines, ...(notes.length ? ["", "DATA NOTES:", ...notes.map(n => `- ${n}`)] : [])].join("\n"), name: profile?.full_name ?? null,
    goalStatus: !goal?.target_date ? "not set" : goalExpired ? "expired" : "current",
    stats: { totals_count: totals?.length ?? 0, totals_months: (totals ?? []).map((t: { month: string }) => t.month), room_found: !!room, room_fields_filled: filled },
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
    const scoped = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await scoped.auth.getUser();
    if (!userData?.user) return json({ error: "Unauthorized" }, 401);
    const userId = userData.user.id;

    const body = await req.json().catch(() => ({}));
    const question = typeof body.question === "string" ? body.question.trim().slice(0, 4000) : "";
    if (!question) return json({ error: "Ask a question first" }, 400);
    const uuidRe = /^[0-9a-f-]{36}$/i;
    const threadId = typeof body.thread_id === "string" && uuidRe.test(body.thread_id) ? body.thread_id : crypto.randomUUID();
    const catalogue = typeof body.catalogue === "string" && body.catalogue.trim() ? body.catalogue.slice(0, 6000) : "(none available)";

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Admin draft mode: answer as the picked member, with their context.
    let memberId = userId;
    let draftMode = false;
    const { data: isAdmin } = await admin.rpc("is_admin", { _user_id: userId });
    if (typeof body.member_id === "string" && uuidRe.test(body.member_id) && body.member_id !== userId) {
      if (!isAdmin) return json({ error: "Admins only" }, 403);
      memberId = body.member_id;
      draftMode = true;
    }

    // Conversation history for this thread (last 10 messages).
    const { data: past } = await admin.from("dan_ai_messages")
      .select("role, content").eq("user_id", userId).eq("thread_id", threadId)
      .order("created_at", { ascending: false }).limit(10);
    const history: Turn[] = (past ?? []).reverse().map((m: Turn) => {
      if (m.role === "assistant") {
        const a = toAnswer(parseJson(m.content));
        return { role: "assistant", content: a ? a.answer : m.content };
      }
      return { role: "user", content: m.content };
    });

    // C. All knowledge except the Brain — same search ladder, limit 30.
    const search = async (q: string, n = 80) => (await admin.rpc("search_knowledge", { q, limit_n: n })).data ?? [];
    let chunks = await search(question);
    if (!chunks.length) {
      const anyOf = question.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((w: string) => w.length > 2).join(" or ");
      if (anyOf) chunks = await search(anyOf);
    }
    if (!chunks.length) {
      const longest = question.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((w: string) => w.length > 3).sort((a: string, b: string) => b.length - a.length)[0];
      if (longest) chunks = await search(longest, 40);
    }
    chunks = chunks.filter((c: { source_type: string }) => c.source_type !== "brain");

    const [brain, member, { data: voice }, styleExamples, { data: allProfiles }] = await Promise.all([
      loadBrain(admin),
      loadMember(admin, memberId),
      admin.from("voice_profile").select("content").eq("slug", "default").maybeSingle(),
      fetchStyleExamples(admin, 30),
      admin.from("profiles").select("id, full_name"),
    ]);

    // Other members' names, for scrubbing and the fallback privacy check.
    const others = ((allProfiles ?? []) as { id: string; full_name: string | null }[])
      .filter(p => p.id !== memberId && p.full_name && p.full_name.trim().length > 2)
      .map(p => p.full_name!.trim());
    const ownNames = new Set((member.name ?? "").toLowerCase().split(/\s+/).filter(Boolean));
    const scrub = (text: string) => {
      let out = text;
      for (const full of others) out = out.replace(new RegExp(`\\b${escapeRe(full)}\\b`, "gi"), "a member");
      for (const full of others) {
        const first = full.split(/\s+/)[0];
        if (first.length < 3 || ownNames.has(first.toLowerCase())) continue;
        out = out.replace(new RegExp(`\\b${escapeRe(first)}\\b`, "gi"), "a member");
      }
      return out;
    };

    // Passage quality: <=2 per doc, <=6 1:1 calls, preference order, member-mode call privacy.
    {
      const own = (member.name ?? "").toLowerCase().split(/\s+/).filter(w => w.length > 2);
      const groupCall = /workshop|group|q&a|q & a|hot seat|momentum/i;
      const pref: Record<string, number> = { teaching: 0, transcript: 1, whatsapp: 2, note: 3, call: 4 };
      const pool = (chunks as { doc_id: string; title: string; source_type: string }[]).filter(c => {
        if (c.source_type !== "call" || draftMode || groupCall.test(c.title)) return true;
        const t = c.title.toLowerCase();
        return own.length > 0 && own.some(w => t.includes(w));
      });
      const ordered = pool.map((c, i) => ({ c, i }))
        .sort((a, b) => ((pref[a.c.source_type] ?? 3) - (pref[b.c.source_type] ?? 3)) || a.i - b.i).map(x => x.c);
      const perDoc = new Map<string, number>();
      let calls = 0;
      const picked: typeof pool = [];
      for (const c of ordered) {
        if (picked.length >= 30) break;
        const n = perDoc.get(c.doc_id) ?? 0;
        if (n >= 2) continue;
        if (c.source_type === "call") { if (calls >= 6) continue; calls++; }
        perDoc.set(c.doc_id, n + 1);
        picked.push(c);
      }
      chunks = picked;
    }

    const passages = (chunks as { title: string; source_type: string; content: string }[]).map(c => {
      const tag = SOURCE_TAGS[c.source_type] ?? c.source_type;
      const sensitive = c.source_type === "whatsapp" || c.source_type === "call";
      const content = !draftMode && sensitive ? scrub(c.content) : c.content;
      const title = !draftMode && sensitive ? scrub(c.title) : c.title;
      return `[${tag}] ${title}\n${content}`;
    }).join("\n\n---\n\n");

    const brainBlock: Block[] = brain.text
      ? [{ type: "text", text: `${BRAIN_HEADER}\n\n${brain.text}`, cache_control: { type: "ephemeral" } }]
      : [];
    const voiceText = voice?.content ? `${BASE_VOICE}\n\n${voice.content}` : BASE_VOICE;
    const draftSystem: Block[] = [...brainBlock, { type: "text", text: draftPrompt(voiceText, styleExamples, catalogue) }];

    const userTurn = `ABOUT THIS MEMBER\n${member.text}\n\n=====\n\nDAN'S KNOWLEDGE: real advice Dan has given\n\n${passages || "(nothing matched)"}\n\n=====\n\nTHE MEMBER ASKED:\n${question}\n\nAnswer them.`;

    // Step one: the draft.
    let draftRaw = "";
    try {
      draftRaw = await callAnthropic(draftSystem, [...history, { role: "user", content: userTurn }]);
    } catch (err) {
      if (!Deno.env.get("LOVABLE_API_KEY")) throw err;
      console.error("Claude draft failed, falling back to Gemini:", err);
      draftRaw = await callGemini(draftSystem, [...history, { role: "user", content: userTurn }]);
    }
    const draft = toAnswer(parseJson(draftRaw)) ?? { answer: stripFence(draftRaw), next_steps: [], resource: null };
    if (!draft.answer) return json({ error: "The model returned an empty answer — try again" }, 502);

    // Step two: the check, against the Brain only.
    let final: Answer;
    let pass = false;
    let issues: unknown[] = [];
    try {
      const checkSystem: Block[] = [...brainBlock, { type: "text", text: CHECKER_PROMPT }];
      const convo = history.map(t => `${t.role === "user" ? "MEMBER" : "DAN"}: ${t.content}`).join("\n\n") || "(none)";
      const checkRaw = await callAnthropic(checkSystem, [{
        role: "user",
        content: `ABOUT THIS MEMBER\n${member.text}\n\n=====\n\nCONVERSATION SO FAR\n${convo}\n\n=====\n\nQUESTION\n${question}\n\n=====\n\nDRAFT\n${JSON.stringify(draft)}`,
      }], 4000);
      const parsed = parseJson(checkRaw);
      const checked = toAnswer(parsed?.final);
      if (!parsed || !checked) throw new Error("Checker returned invalid JSON");
      final = checked;
      pass = parsed.pass === true;
      issues = Array.isArray(parsed.issues) ? parsed.issues : [];
    } catch (err) {
      console.error("Checker failed, using the code check:", err);
      const lower = draft.answer.toLowerCase();
      const leaked = others.some(n => new RegExp(`\\b${escapeRe(n.toLowerCase())}\\b`).test(lower));
      final = leaked ? { answer: FLAG_REPLY, next_steps: [], resource: null } : draft;
      pass = false;
      issues = [{ type: leaked ? "privacy" : "question", note: `Checker failed (${err instanceof Error ? err.message : "unknown"}); code check ${leaked ? "blocked a member name" : "found no member names"}.` }];
    }

    await Promise.all([
      admin.from("dan_ai_checks").insert({ user_id: userId, question, draft, final, pass, issues }),
      admin.from("dan_ai_messages").insert([
        { user_id: userId, thread_id: threadId, role: "user", content: question },
        { user_id: userId, thread_id: threadId, role: "assistant", content: JSON.stringify(final) },
      ]),
      admin.from("client_questions").insert({
        user_id: userId, question, answer: final.answer, next_steps: final.next_steps, resource: final.resource,
      }),
    ]);

    const debug = isAdmin === true ? {
      about_member: member.text || "none loaded",
      member_id: memberId,
      brain: { docs: brain.docs, words: brain.words },
      goal: member.goalStatus,
      monthly_totals: { count: member.stats.totals_count, months: member.stats.totals_months },
      context_room: { found: member.stats.room_found, fields_filled: member.stats.room_fields_filled },
      passage_titles: (chunks as { title: string; source_type: string }[]).map(c => `[${SOURCE_TAGS[c.source_type] ?? c.source_type}] ${c.title}`),
    } : undefined;
    return json({ ...final, thread_id: threadId, ...(debug ? { debug } : {}) });
  } catch (err) {
    console.error("ask-dan error", err);
    return json({ error: err instanceof Error ? err.message : "Unexpected error" }, 500);
  }
});

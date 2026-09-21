// Dan AI — answers a client question using only Dan's own words.
//
// Retrieval is full-text over knowledge_chunks (training transcripts, call
// transcripts, WhatsApp exports), plus any answer Dan has already approved.
// Admin-only: Dan and Emily.
//
// Uses ANTHROPIC_API_KEY when set, otherwise falls back to the Lovable AI
// gateway the other functions already use.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `You ARE Dan Wilmott, replying to a client in ProfitX (a coaching program for videographers building retainer businesses). You are not an assistant writing "as" Dan — the message you produce gets pasted straight into the chat and must be indistinguishable from Dan typing it on his phone.

HOW DAN LOOKS AT ANY SET OF NUMBERS

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

Apply that whenever the question touches numbers or the state of a business.

RULES

1. Answer from the context provided below. It is drawn from Dan's own trainings, coaching calls and messages.

   Always give the closest answer the context supports. If it covers the question directly, answer directly. If it only covers it partly — a related situation, the same principle applied elsewhere — give Dan's closest thinking and keep it general rather than inventing specifics. The person reading your answer can see exactly which calls and trainings it came from, listed beside it, so they can check it before sending.

   Never reply that you cannot answer, and never tell them to add more material. Never invent a framework, price, process or result Dan has not said.

2. HOW DAN ACTUALLY TYPES — copy this exactly. It matters more than sounding polished:
   - Short. Most replies are 1-4 lines. He fires off thoughts, he doesn't write essays.
   - Lowercase-leaning, casual. Sentences often start lowercase. No full stops on short lines — he just stops.
   - Aussie mate energy: "bro", "my bro", "mate", "sweet", "nice one", "love it", "yeah", "yeh", "nah", "legend", "boys", "sick". Use "bro" naturally, not in every message.
   - Typos and shorthand are normal and make it real: "yeha", "hahaha", "ahaha", "idk", "tbh", "def", "prob", "gonna", "wanna". Drop one in occasionally — never so many it looks sloppy.
   - No em dashes with fancy spacing; he uses a simple hyphen " - " to tack a thought on.
   - Clipped imperatives: "just do x", "don't overthink", "send it", "keep it broad", "rip into it", "get it out".
   - He breaks a thought into consecutive short lines rather than one long sentence. Use separate lines.
   - No corporate speak, no "furthermore", "additionally", "I'd recommend", "it's important to note", no bullet-point lectures, no headings, no bold, no numbered frameworks unless he genuinely lists steps — and then they're short lines, not formatted lists.
   - No emoji unless the context shows Dan using them.
   - Never open with "Great question", never sign off, never explain what you're about to say. Just say it.
   - Confident and decisive. He gives the call, not options. "I'd just...", "Nah not worth", "That'll be sweet".

3. Length: match a real WhatsApp reply. A few short lines. Only go longer if the question genuinely needs steps, and even then keep each line tight.

4. Never mention another client by name, or repeat another client's numbers, revenue or private situation. The context contains real client calls — use the thinking, never the identifying details.

5. Output the message itself, ready to paste. Nothing else.`;

// Real Dan lines pulled from the WhatsApp exports, used as live style examples so
// the model mirrors how he's typing lately rather than a description of it.
async function fetchStyleExamples(supabase: any): Promise<string[]> {
  const { data } = await supabase
    .from("knowledge_chunks")
    .select("content, knowledge_docs!inner(source_type)")
    .eq("knowledge_docs.source_type", "whatsapp")
    .limit(40);

  const lines: string[] = [];
  for (const row of (data ?? []) as { content: string }[]) {
    for (const raw of row.content.split("\n")) {
      const m = raw.match(/\]\s*You:\s*(.+)$/);
      if (!m) continue;
      const line = m[1].trim();
      if (line.length < 8 || line.length > 220) continue;
      if (/^https?:/i.test(line) || /omitted|deleted/i.test(line)) continue;
      lines.push(line);
    }
  }
  // Spread the sample across the whole export instead of the first chat only.
  const step = Math.max(1, Math.floor(lines.length / 60));
  return lines.filter((_, i) => i % step === 0).slice(0, 60);
}


async function callAnthropic(apiKey: string, prompt: string): Promise<string> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-5",
      max_tokens: 1500,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.content?.[0]?.text ?? "";
}

async function callLovable(apiKey: string, prompt: string): Promise<string> {
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-2.5-pro",
      // Without a budget this reasoning model can spend it all on thinking and
      // return empty content.
      max_tokens: 1500,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: prompt },
      ],
    }),
  });
  if (!res.ok) throw new Error(`Lovable gateway ${res.status}: ${await res.text()}`);

  const data = await res.json();
  const text = data.choices?.[0]?.message?.content ?? "";
  if (!text) {
    throw new Error(
      `Gateway returned no content (finish_reason: ${data.choices?.[0]?.finish_reason ?? "unknown"})`,
    );
  }
  return text;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Unauthorized" }, 401);
    }

    // Scoped to the caller, so RLS decides what they can read.
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData?.user) return json({ error: "Unauthorized" }, 401);

    const { data: profile } = await supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", userData.user.id)
      .single();
    if (!profile?.is_admin) return json({ error: "Admins only" }, 403);

    const { question } = await req.json();
    if (!question || typeof question !== "string" || !question.trim()) {
      return json({ error: "A question is required" }, 400);
    }

    // Postgres full-text ANDs every word together, so a whole question rarely
    // matches a single passage. Try the exact phrasing first, then fall back to
    // a ranked any-of match, which is what actually finds the relevant material.
    const anyOf = question
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter(w => w.length > 2)
      .join(" or ");

    let [{ data: chunks }, { data: saved }] = await Promise.all([
      supabase.rpc("search_knowledge", { q: question, limit_n: 24 }),
      supabase.rpc("search_saved_answers", { q: question, limit_n: 3 }),
    ]);

    let approximate = false;
    if ((!chunks || chunks.length === 0) && anyOf) {
      approximate = true;
      const [broadChunks, broadSaved] = await Promise.all([
        supabase.rpc("search_knowledge", { q: anyOf, limit_n: 24 }),
        supabase.rpc("search_saved_answers", { q: anyOf, limit_n: 3 }),
      ]);
      chunks = broadChunks.data;
      if (!saved || saved.length === 0) saved = broadSaved.data;
    }

    // Last resort: the single most distinctive word. Across a knowledge base
    // this size that almost always returns something, which is the point —
    // an approximate answer with its sources beats refusing to answer.
    if (!chunks || chunks.length === 0) {
      const longest = question
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, " ")
        .split(/\s+/)
        .filter(w => w.length > 3)
        .sort((a, b) => b.length - a.length)[0];

      if (longest) {
        approximate = true;
        const { data: lastResort } = await supabase.rpc("search_knowledge", {
          q: longest,
          limit_n: 16,
        });
        chunks = lastResort;
      }
    }

    if ((!chunks || chunks.length === 0) && (!saved || saved.length === 0)) {
      return json({
        answer:
          "No material in the knowledge base matches that at all. Either the knowledge base is still empty, or the question uses wording that appears nowhere in Dan's calls and trainings — try rephrasing it the way a client would actually ask.",
        sources: [],
        empty: true,
      });
    }

    const contextBlocks = (chunks ?? []).map(
      (c: { title: string; source_type: string; content: string }) =>
        `[${c.source_type} — ${c.title}]\n${c.content}`,
    );

    const approvedBlocks = (saved ?? []).map(
      (s: { question: string; answer: string }) =>
        `[Dan already approved this answer]\nQ: ${s.question}\nA: ${s.answer}`,
    );

    const styleExamples = await fetchStyleExamples(supabase);

    const prompt = [
      styleExamples.length
        ? `REAL MESSAGES DAN HAS SENT (this is exactly how he types — match this voice, casing, rhythm and length):\n\n${styleExamples.map(l => `- ${l}`).join("\n")}`
        : "",
      approvedBlocks.length
        ? `ANSWERS DAN HAS ALREADY APPROVED — if one of these fits, reuse its wording almost exactly:\n\n${approvedBlocks.join("\n\n")}`
        : "",
      `CONTEXT FROM DAN'S OWN TRAININGS, CALLS AND MESSAGES:\n\n${contextBlocks.join("\n\n---\n\n")}`,
      approximate
        ? `THE CLIENT ASKED:\n${question}\n\nThe context above is the closest material in Dan's knowledge base — it may not address this exact question. Give the closest answer his thinking supports, typed the way he types. Do not mention that the match was approximate.`
        : `THE CLIENT ASKED:\n${question}\n\nReply as Dan. Short, casual, decisive — like the real messages above.`,
    ]
      .filter(Boolean)
      .join("\n\n=====\n\n");


    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
    const lovableKey = Deno.env.get("LOVABLE_API_KEY");

    let answer = "";
    let model = "";

    if (anthropicKey) {
      try {
        answer = await callAnthropic(anthropicKey, prompt);
        model = "claude-sonnet-5";
      } catch (err) {
        // Fall back rather than taking the tool down with Claude.
        if (!lovableKey) throw err;
        console.error("Claude call failed, falling back to the gateway:", err);
      }
    }

    if (!answer && lovableKey) {
      answer = await callLovable(lovableKey, prompt);
      model = "gemini-2.5-pro";
    }

    if (!answer) {
      return json({ error: "No AI key configured" }, 500);
    }

    const sources = (chunks ?? []).slice(0, 6).map(
      (c: { title: string; source_type: string; content: string }) => ({
        title: c.title,
        source_type: c.source_type,
        snippet: c.content.slice(0, 220),
      }),
    );

    return json({
      answer,
      sources,
      model,
      approximate,
      reusedApproved: (saved ?? []).length > 0,
    });
  } catch (err) {
    console.error("dan-ai error", err);
    return json({ error: err instanceof Error ? err.message : "Unexpected error" }, 500);
  }
});

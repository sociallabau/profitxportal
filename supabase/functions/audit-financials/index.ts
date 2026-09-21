// Audits an uploaded P&L or paid ad tracking sheet and writes the feedback
// the way Dan would give it on a call.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BASE_VOICE = `Dan Wilmott runs ProfitX, coaching videographers to build retainer businesses. Write as Dan speaks to a client: direct and warm, Australian, no corporate speak, short paragraphs, plain words over jargon, confident and practical. No emoji. Never open with "Great question".`;

const PNL_BRIEF = `You are looking at a client's profit and loss, exactly as they sent it.

Read the document first and work out how it is laid out — the line items, the periods, and any totals or percentages it already calculates. Use its own labels and figures. Do not restructure it into a format you prefer.

Then: state revenue, total costs, and gross and net margin. Find the actual problem. For a videographer it is nearly always one of four things — what they pay editors and contractors, ad spend, software creep, or what they take out themselves — so say which, with the number.

Compare against what Dan teaches about margins for their stage. Be straight about it: if they are keeping 8% of what they bill, say so and say what it should be.

Finish with the two or three things that would move the number most, in order of impact.`;

const ADS_BRIEF = `You are reading Dan's paid ad tracking sheet. He has a specific way of reading it. Follow it exactly.

READ IT IN THIS ORDER

1. Go straight to the far right — revenue and return. That is the only question that matters first: is this making money? Say the spend, the revenue and the return, and give the verdict in a sentence.

2. If it IS making money, go to cost per acquisition and compare it to the offer price. Under half the offer price is good. Around a quarter is excellent, and means the answer is to turn the budget up.

3. Only then work backwards through the funnel — to confirm why it is working, not to hunt for faults.

4. If it is NOT making money, that is when you work forwards from the start: click-through rate, then form fill, then call bookings, then show rate, then close rate. Find the step where it actually breaks and name it.

WHAT DAN TREATS AS NORMAL
- CPM: under $30 is fine
- Click-through rate: 1% or higher is good. 2% means the creatives are working.
- Clicks to leads (form fill): often only 3-5%, and a low number here is NOT a problem by itself
- Leads to call bookings: around 50% is good
- Call bookings to calls taken (show rate): 90%+ is the number that actually matters
- Close rate: 20% is bang on
- Cost per acquisition: under half the offer price is the line; a quarter is excellent

THE JUDGEMENT THAT MATTERS MOST

A low form fill rate with a strong show rate and close rate is a healthy funnel, not a broken one. The form is doing the qualifying — it weeds out people who do not really want it. If only 3% of clicks fill in the form but 90% of the people who book actually show up and a fifth of them buy, that proves the ones filling it in genuinely want the thing.

So never flag a low form fill as a problem when the downstream numbers are strong. Say plainly why it is fine. The same goes for any single percentage that looks off while the money at the end is good.

PENDING CLOSES
If the sheet separates closed from pending, say so. Most people only count the definite ones, so work on the basis that roughly half the pending will come through, and say what that does to the return.

SCALING
When cost per acquisition is under half the offer price, the advice is: turn the budget up, push more creatives in, and leave it a week or two so cost per client can stabilise before judging it. As volume goes up the percentages shrink and cost per client usually climbs — that is expected. Cost per client and the return are what to watch, not the percentages in the middle.

LENGTH
Keep it tight. Do not walk every column or flag every number slightly out of range. Lead with the money, give the verdict, explain the one or two things that actually decide it, then finish with what to do next.`;

async function callModel(prompt: string, system: string): Promise<string> {
  const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (anthropicKey) {
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": anthropicKey,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: "claude-sonnet-5",
          max_tokens: 2500,
          system,
          messages: [{ role: "user", content: prompt }],
        }),
      });
      if (!res.ok) throw new Error(`Anthropic ${res.status}: ${await res.text()}`);
      const text = (await res.json()).content?.[0]?.text ?? "";
      if (!text) throw new Error("Claude returned no content");
      return text;
    } catch (err) {
      // Keep working if Claude is unreachable or out of credit, rather
      // than taking the whole feature down with it.
      if (!Deno.env.get("LOVABLE_API_KEY")) throw err;
      console.error("Claude call failed, falling back to the gateway:", err);
    }
  }

  const lovableKey = Deno.env.get("LOVABLE_API_KEY");
  if (!lovableKey) throw new Error("No AI key configured");
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${lovableKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      max_tokens: 2500,
      messages: [
        { role: "system", content: system },
        { role: "user", content: prompt },
      ],
    }),
  });
  if (!res.ok) throw new Error(`Lovable gateway ${res.status}: ${await res.text()}`);

  const data = await res.json();
  const text = data.choices?.[0]?.message?.content ?? "";
  if (!text) {
    // A reasoning model with no token budget burns it all on thinking and
    // returns empty content, so surface the reason rather than "".
    throw new Error(
      `Gateway returned no content (finish_reason: ${data.choices?.[0]?.finish_reason ?? "unknown"})`,
    );
  }
  return text;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const scoped = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData } = await scoped.auth.getUser();
    if (!userData?.user) return json({ error: "Unauthorized" }, 401);

    const { kind, filename, period, text } = await req.json();
    if (!text || typeof text !== "string" || text.trim().length < 40) {
      return json({ error: "That file looks empty — export it as CSV and try again" }, 400);
    }

    const auditKind = kind === "ads" ? "ads" : "pnl";

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Ground the feedback in what Dan actually teaches about these numbers.
    const topic = auditKind === "ads"
      ? "ad spend cost per lead booked calls close rate campaign budget"
      : "margin profit expenses pricing retainer editors contractors wage";
    const { data: chunks } = await admin.rpc("search_knowledge_public", {
      q: topic, limit_n: 12,
    });

    const { data: voice } = await admin
      .from("voice_profile").select("content").eq("slug", "default").maybeSingle();

    const teaching = (chunks as { title: string; content: string }[] | null)?.length
      ? `WHAT DAN TEACHES ABOUT THIS:\n\n${(chunks as { title: string; content: string }[])
          .map(c => c.content).join("\n\n---\n\n")}\n\n=====\n\n`
      : "";

    const system = `${BASE_VOICE}${voice?.content ? `\n\n${voice.content}` : ""}

${auditKind === "ads" ? ADS_BRIEF : PNL_BRIEF}

Rules:
- Use only the numbers in the data, and prefer the sheet's own calculated figures over your own arithmetic. If a column is empty or obviously broken, say so rather than filling the gap with an assumption.
- If something needed is missing entirely, say what to send next time rather than guessing.
- Use the benchmarks above. Do not invent others.
- Write it as a message to them. Plain text, no markdown headings, no tables, no column-by-column walkthrough.
- Talk about the money before anything else, every time.`;

    const audit = (await callModel(
      `${teaching}THEIR ${auditKind === "ads" ? "AD TRACKING" : "P&L"}${period ? ` (${period})` : ""}:\n\n${text.slice(0, 60_000)}\n\nGive them your read on it.`,
      system,
    )).trim();

    if (!audit) return json({ error: "The model returned nothing — try again" }, 502);

    const { data: saved, error } = await admin.from("financial_audits").insert({
      user_id: userData.user.id,
      kind: auditKind,
      filename: filename ?? null,
      period: period ?? null,
      source_text: text.slice(0, 60_000),
      audit,
    }).select("id, created_at").single();

    if (error) throw error;

    return json({ audit, id: saved?.id, created_at: saved?.created_at });
  } catch (err) {
    console.error("audit-financials error", err);
    return json({ error: err instanceof Error ? err.message : "Unexpected error" }, 500);
  }
});

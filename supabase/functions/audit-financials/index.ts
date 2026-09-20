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

const ADS_BRIEF = `You are looking at a client's paid ad tracking sheet.

This is Dan's own tracking sheet, and it defines the metrics that matter. Read the column headers first and work out exactly what it tracks — it will carry things like spend, impressions, reach, CPM, clicks, CTR, CPC, leads, follow through %, CPL, call bookings, leads to call %, calls taken, show rate, cost per show, signed up, conversion rate, leads to close %, revenue, CPA and ROI.

Use the sheet's own metric names and its own definitions. Work with the numbers it already calculates rather than inventing your own, and only calculate something yourself where the sheet leaves it blank or the figure is clearly wrong. If the sheet contains target or benchmark rows, judge performance against those targets specifically.

Then find where the funnel actually breaks. Follow it in the order the sheet lays out, and be precise about the step: a cheap lead that never books is a completely different problem from an expensive lead that closes well. Quote the dates or rows where it turns.

Finish with the two or three changes worth making next, in order of impact. Be specific — which day, which campaign, which step of the funnel.`;

async function callModel(prompt: string, system: string): Promise<string> {
  const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (anthropicKey) {
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
    return (await res.json()).content?.[0]?.text ?? "";
  }

  const lovableKey = Deno.env.get("LOVABLE_API_KEY");
  if (!lovableKey) throw new Error("No AI key configured");
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${lovableKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-2.5-pro",
      messages: [
        { role: "system", content: system },
        { role: "user", content: prompt },
      ],
    }),
  });
  if (!res.ok) throw new Error(`Lovable gateway ${res.status}: ${await res.text()}`);
  return (await res.json()).choices?.[0]?.message?.content ?? "";
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
- Never invent a benchmark. If Dan's teaching below gives one, use it; otherwise reason from their own numbers.
- Write it as a message to them. Plain text, no markdown headings, no tables.`;

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

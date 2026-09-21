// Reads a client's monthly numbers and writes two things: a short round-up
// for them, and a full breakdown for Dan.
//
// The client's version is encouraging but honest and ends with one focus.
// Dan's version is the call prep: what changed, what is at risk, what to raise.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const VOICE = `Dan Wilmott runs ProfitX, coaching videographers to build retainer businesses. Write as Dan speaks: direct and warm, Australian, no corporate speak, short paragraphs, plain words over jargon, confident and practical. No emoji. Never open with "Great question" or "Great work".`;

const METHOD = `HOW DAN READS A CLIENT'S MONTH

WHAT THE MONEY IS MADE OF

These are videographers. Their revenue is retainers plus one-off work — shoots, edits, single projects. Total revenue being higher than their retainers × their fee is completely normal and needs no explanation. Never try to reconcile the difference, never speculate about where extra money came from, and never treat it as a discrepancy.

What matters for growth is the recurring side. A client saying they signed two clients at $2k a month on six-month contracts has locked in $4k of monthly recurring revenue — that is the headline. Everything else that month is one-off work on top.

THE DECISION THAT DRIVES EVERYTHING

There is one question to answer first: are they signing new retainer clients?

- If NO — go deep on the growth engine. Content posted and ad spend into leads, leads into calls, calls into signed retainers. Find the step that is actually empty and say so. This is the whole conversation.
- If YES — leave the growth engine alone and move to scale: getting them out of delivery. Who is doing the work, what is it costing in hours and margin, what has to be handed over for the next tier of clients to be possible.

Do not give scaling advice to someone who is not signing clients, and do not pick apart a lead engine that is clearly working.

THE LEAD ENGINE

When you do look at it, tie the leads back to what produced them: how much content did they post, how much did they spend on ads, and how many leads came out. Little content and little spend producing few leads is not a mystery — say that plainly and move on. Leads are the input to everything else, so a thin top is the whole story.

WHEN THE NUMBERS CONTRADICT EACH OTHER

Clients closing with zero calls booked and zero offers made does not mean something clever is happening. It means they are not tracking. Say that directly — they cannot make good decisions on numbers they are not keeping — and do not theorise about how they might have closed.

WHAT ELSE IS TRUE

Judge them against their own previous months, never a target you have picked. A very high conversion rate is a pricing problem rather than a win. Cost to acquire should sit under half what a client is worth. Profit is the point: revenue with nothing left after costs is not a healthy business. A one-off expense like gear is fine, and worth saying so rather than treating a dented margin as a crisis.`;

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
      if (!Deno.env.get("LOVABLE_API_KEY")) throw err;
      console.error("Claude call failed, falling back to the gateway:", err);
    }
  }

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${Deno.env.get("LOVABLE_API_KEY")}`,
      "Content-Type": "application/json",
    },
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
  if (!text) throw new Error(`Gateway returned no content (${data.choices?.[0]?.finish_reason ?? "unknown"})`);
  return text;
}

type MonthRow = Record<string, number | string | null>;

/** A month's numbers, written the way Dan would read them out. */
function describe(row: MonthRow, label: string): string {
  const n = (key: string) => Number(row[key] ?? 0);
  const revenue = n("total_revenue") || (n("mrr_manual") || n("mrr")) + n("oneoff_revenue");
  const expenses = n("expenses");
  const leads = n("leads_generated");
  const clients = n("new_clients");
  const adSpend = n("ad_spend");
  const clientValue = n("new_clients_total_value");

  const margin = revenue > 0 ? Math.round(((revenue - expenses) / revenue) * 100) : null;
  const conversion = leads > 0 ? Math.round((clients / leads) * 1000) / 10 : null;
  const cac = clients > 0 && adSpend > 0 ? Math.round(adSpend / clients) : null;
  const perClient = clients > 0 && clientValue > 0 ? Math.round(clientValue / clients) : null;

  return [
    `${label}:`,
    `  revenue $${revenue.toLocaleString()}, expenses $${expenses.toLocaleString()}${margin !== null ? `, net margin ${margin}%` : ""}`,
    `  content posted ${n("content_posts")}, ad spend $${adSpend.toLocaleString()}`,
    `  leads ${leads}, calls booked ${n("booked_calls")}, calls showed ${n("calls_showed")}, offers made ${n("offers_made")}`,
    `  new clients ${clients}${conversion !== null ? `, conversion ${conversion}% of leads` : ""}`,
    cac !== null ? `  cost to acquire $${cac}${perClient ? ` against a client worth $${perClient}` : ""}` : "",
    row.expense_contractors != null ? `  editors/contractors $${Number(row.expense_contractors).toLocaleString()}` : "",
    row.expense_owner_pay != null ? `  paid themselves $${Number(row.expense_owner_pay).toLocaleString()}` : "",
    row.biggest_win ? `  their biggest win: ${row.biggest_win}` : "",
    row.needs_this_month ? `  what they said they are working on: ${row.needs_this_month}` : "",
    row.business_confidence != null ? `  confidence ${row.business_confidence}/10` : "",
  ].filter(Boolean).join("\n");
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

    const { data: profile } = await scoped
      .from("profiles").select("is_admin").eq("id", userData.user.id).single();

    const body = await req.json().catch(() => ({}));
    // A client can only ever generate their own; an admin can regenerate anyone's.
    const targetUser: string = profile?.is_admin && body?.userId ? body.userId : userData.user.id;

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: history } = await admin
      .from("monthly_totals")
      .select("*")
      .eq("user_id", targetUser)
      .order("month", { ascending: false })
      .limit(6);

    if (!history?.length) {
      return json({ error: "No submissions to review yet" }, 400);
    }

    const latest = history[0] as MonthRow;
    const month = String(latest.month);

    const { data: person } = await admin
      .from("profiles").select("full_name, tier").eq("id", targetUser).single();

    const { data: voice } = await admin
      .from("voice_profile").select("content").eq("slug", "default").maybeSingle();

    const timeline = history
      .map((row, i) => describe(row as MonthRow, i === 0 ? "This month" : `${i} month${i === 1 ? "" : "s"} earlier`))
      .join("\n\n");

    const system = `${VOICE}${voice?.content ? `\n\n${voice.content}` : ""}

${METHOD}

You are reviewing ${person?.full_name || "a client"}'s month. Write two things.

1. THE CLIENT'S ROUND-UP. Four or five sentences. Honest about what the numbers say, warm about what they got right, ending with the single thing to focus on next month. No lists, no headings, no dumping numbers at them. This is what they read, so it must sound exactly like a message from Dan.

2. DAN'S BREAKDOWN. Under 250 words, in three short paragraphs, written for Dan before a call:
   - The month: retainers signed and what that locks in, revenue, margin, and whether it moved.
   - The engine: content and ad spend against leads produced, and either where it breaks in one sentence, or a note that it is working and the conversation is about scale instead.
   - What to raise: two or three specific things, each one a sentence.

   Be blunt and concrete. No reverse-engineering the numbers, no speculating about what might have happened, no walking every metric. If something they wrote contradicts what they logged, say so in a line. They never see this.

3. FOCUS. One short line, under 12 words, naming the single priority.

Return only JSON, no markdown fence:
{"client_summary": "...", "admin_breakdown": "...", "focus": "..."}`;

    const raw = await callModel(`THEIR NUMBERS, most recent first:\n\n${timeline}`, system);

    const cleaned = raw.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
    let parsed: { client_summary?: string; admin_breakdown?: string; focus?: string };
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      const match = cleaned.match(/\{[\s\S]*\}/);
      if (!match) return json({ error: "Could not read the model's answer — try again" }, 502);
      parsed = JSON.parse(match[0]);
    }

    if (!parsed.client_summary || !parsed.admin_breakdown) {
      return json({ error: "The review came back incomplete — try again" }, 502);
    }

    const { error } = await admin.from("monthly_reviews").upsert({
      user_id: targetUser,
      month,
      client_summary: parsed.client_summary.trim(),
      admin_breakdown: parsed.admin_breakdown.trim(),
      focus: parsed.focus?.trim() ?? null,
    }, { onConflict: "user_id,month" });

    if (error) throw error;

    // A client never gets the breakdown back, even in the response body.
    return json(
      profile?.is_admin
        ? { month, ...parsed }
        : { month, client_summary: parsed.client_summary, focus: parsed.focus ?? null },
    );
  } catch (err) {
    console.error("monthly-review error", err);
    return json({ error: err instanceof Error ? err.message : "Unexpected error" }, 500);
  }
});

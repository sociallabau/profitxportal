// A short admin-only summary of one client for the Client Health panel:
// who they are, where their numbers sit, and what matters from their Context
// Room, plus a few dot points of what they said in their latest check-in.
//
// Deliberately small and fast. It reads the portal's own data only and is
// never member-readable (stored in client_care, which is admin-only).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { buildContextMarkdown, type ContextAnswers } from "../_shared/contextRoom.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM = `You write the quick summary Dan Wilmott (ProfitX, coaching videographers to build retainer businesses) reads before he messages a client. Australian, plain words, no emoji, no corporate speak.

Return ONLY JSON: {"summary": string, "checkin_bullets": string[]}

summary: two sentences maximum, 45 words maximum.
- Sentence one: who they are (what they do, where they sit) and their current money position: MRR and which way it is heading.
- Sentence two: the one thing from their Context Room or latest check-in that changes how Dan should talk to them. Skip it if nothing stands out.
- Never mention the hot list, roadmap, modules, build list, gate tasks or how much of the program they have finished.
- No advice, no filler, no adjectives like "strong" unless the numbers prove it. Only use facts you were given.

checkin_bullets: up to 4 short dot points (14 words maximum each) of what they said in their latest check-in (biggest win, what they are working on). Paraphrase tightly and keep their own wording where you can. Return [] if they wrote nothing.`;

async function callModel(prompt: string): Promise<string> {
  const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (anthropicKey) {
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "x-api-key": anthropicKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
        body: JSON.stringify({ model: "claude-haiku-5-5", max_tokens: 600, system: SYSTEM, messages: [{ role: "user", content: prompt }] }),
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
    headers: { Authorization: `Bearer ${Deno.env.get("LOVABLE_API_KEY")}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash", max_tokens: 600,
      messages: [{ role: "system", content: SYSTEM }, { role: "user", content: prompt }],
    }),
  });
  if (!res.ok) throw new Error(`Lovable gateway ${res.status}: ${await res.text()}`);
  const text = (await res.json()).choices?.[0]?.message?.content ?? "";
  if (!text) throw new Error("Gateway returned no content");
  return text;
}

type Row = Record<string, number | string | null>;

/** One month on one line, so the model reads the trend without a wall of numbers. */
function line(row: Row): string {
  const n = (k: string) => Number(row[k] ?? 0);
  const revenue = n("total_revenue") || (n("mrr_manual") || n("mrr")) + n("oneoff_revenue");
  const mrr = n("mrr_manual") || n("mrr");
  const bits = [
    `${String(row.month).slice(0, 7)}: revenue $${revenue.toLocaleString()}`,
    mrr ? `MRR $${mrr.toLocaleString()}` : "",
    row.active_retainers != null ? `${n("active_retainers")} retainers` : "",
    `expenses $${n("expenses").toLocaleString()}`,
    n("new_clients") ? `${n("new_clients")} new clients` : "",
    row.business_confidence != null ? `confidence ${row.business_confidence}/10` : "",
  ];
  return bits.filter(Boolean).join(", ");
}

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
    const { data: caller } = await scoped.from("profiles").select("is_admin").eq("id", userData.user.id).single();
    if (!caller?.is_admin) return json({ error: "Admin access required" }, 403);

    const body = await req.json().catch(() => ({}));
    const userId = String(body?.userId ?? "");
    if (!/^[0-9a-f-]{36}$/i.test(userId)) return json({ error: "userId required" }, 400);

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const [{ data: profile }, { data: room }, { data: months }, { data: goal }] = await Promise.all([
      admin.from("profiles").select("full_name, business_overview, gate, created_at").eq("id", userId).maybeSingle(),
      admin.from("context_rooms").select("answers").eq("user_id", userId).maybeSingle(),
      admin.from("monthly_totals").select("*").eq("user_id", userId).order("month", { ascending: false }).limit(4),
      admin.from("goals").select("starting_mrr, target_mrr, target_date").eq("user_id", userId).maybeSingle(),
    ]);
    if (!profile) return json({ error: "Client not found" }, 404);

    const answers = { ...((room?.answers ?? {}) as ContextAnswers) };
    delete (answers as Record<string, unknown>).anything_else; // personal disclosures stay out of AI context
    const latest = (months?.[0] ?? null) as Row | null;
    const context = buildContextMarkdown(answers, latest as never, goal as never);

    const prompt = [
      `CLIENT: ${profile.full_name ?? "Client"}`,
      `JOINED: ${profile.created_at ? String(profile.created_at).slice(0, 10) : "unknown"}   TODAY: ${new Date().toISOString().slice(0, 10)}`,
      profile.business_overview ? `BUSINESS: ${profile.business_overview}` : "",
      goal?.target_mrr ? `GOAL: $${Number(goal.target_mrr).toLocaleString()} MRR${goal.target_date ? ` by ${goal.target_date}` : ""}` : "",
      `\nLAST CHECK-INS (newest first):\n${(months ?? []).map(m => line(m as Row)).join("\n") || "(none yet)"}`,
      `\nCONTEXT ROOM:\n${context || "(empty)"}`,
      `\nLATEST CHECK-IN, IN THEIR WORDS:\nBiggest win: ${latest?.biggest_win ?? "(nothing written)"}\nWorking on next: ${latest?.needs_this_month ?? "(nothing written)"}`,
    ].filter(Boolean).join("\n");

    const raw = await callModel(prompt);
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return json({ error: "Could not read the model's answer — try again" }, 502);
    let parsed: { summary?: unknown; checkin_bullets?: unknown };
    try { parsed = JSON.parse(match[0]); } catch { return json({ error: "Could not read the model's answer — try again" }, 502); }
    const summary = typeof parsed.summary === "string" ? parsed.summary.trim().slice(0, 600) : "";
    if (!summary) return json({ error: "The model returned no summary — try again" }, 502);
    const bullets = Array.isArray(parsed.checkin_bullets)
      ? parsed.checkin_bullets.filter((b): b is string => typeof b === "string" && b.trim().length > 0).map(b => b.trim().replace(/^[•\-*]\s*/, "").slice(0, 160)).slice(0, 4)
      : [];

    const row = {
      client_id: userId, snapshot: summary, checkin_bullets: bullets,
      snapshot_month: latest?.month ? String(latest.month).slice(0, 10) : null,
      snapshot_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    };
    // Upsert only these columns so the cadence and Dan's read are left alone.
    const { error } = await admin.from("client_care").upsert(row, { onConflict: "client_id" });
    if (error) throw error;
    return json({ snapshot: row.snapshot, checkin_bullets: row.checkin_bullets, snapshot_month: row.snapshot_month, snapshot_at: row.snapshot_at });
  } catch (err) {
    console.error("client-snapshot failed", err);
    return json({ error: err instanceof Error ? err.message : "Could not build the summary" }, 500);
  }
});

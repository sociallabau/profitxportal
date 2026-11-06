// Talking points for a client's 30-minute quarterly call. Admin-only.
// The facts (numbers since the last call, last quarter's goals) are worked out
// in the portal; this adds three questions worth asking, from the client's own
// Context Room and latest check-ins. Nothing is stored.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { buildContextMarkdown, type ContextAnswers } from "../_shared/contextRoom.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM = `You prepare Dan Wilmott (ProfitX, coaching videographers to build retainer businesses) for a 30-minute quarterly call with one client. Australian, plain words, no emoji.

Return ONLY JSON: {"points": string[]}

Give exactly 3 talking points, each one sentence of 25 words maximum, each worth raising on this call. Prefer: a goal from last quarter that was missed or is still open, a number that moved a lot, and something from their Context Room (blocker, what they want help with, 90-day focus). Do not mention the hot list, roadmap, modules or build list. No generic coaching advice. Only use facts you were given. If there are too few facts, give fewer points.`;

async function callModel(prompt: string): Promise<string> {
  const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (anthropicKey) {
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "x-api-key": anthropicKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
        body: JSON.stringify({ model: "claude-haiku-5-5", max_tokens: 500, system: SYSTEM, messages: [{ role: "user", content: prompt }] }),
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
    body: JSON.stringify({ model: "google/gemini-2.5-flash", max_tokens: 500, messages: [{ role: "system", content: SYSTEM }, { role: "user", content: prompt }] }),
  });
  if (!res.ok) throw new Error(`Lovable gateway ${res.status}: ${await res.text()}`);
  const text = (await res.json()).choices?.[0]?.message?.content ?? "";
  if (!text) throw new Error("Gateway returned no content");
  return text;
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
    const [{ data: profile }, { data: room }, { data: months }, { data: goals }, { data: goalRow }] = await Promise.all([
      admin.from("profiles").select("full_name, business_overview").eq("id", userId).maybeSingle(),
      admin.from("context_rooms").select("answers").eq("user_id", userId).maybeSingle(),
      admin.from("monthly_totals").select("month, total_revenue, mrr, mrr_manual, oneoff_revenue, expenses, active_retainers, retainers_lost, new_clients, business_confidence").eq("user_id", userId).order("month", { ascending: false }).limit(6),
      admin.from("client_goals").select("goal, status, set_on").eq("client_id", userId).order("set_on", { ascending: false }).limit(6),
      admin.from("goals").select("target_mrr, target_date").eq("user_id", userId).maybeSingle(),
    ]);
    if (!profile) return json({ error: "Client not found" }, 404);

    const answers = { ...((room?.answers ?? {}) as ContextAnswers) };
    delete (answers as Record<string, unknown>).anything_else; // personal disclosures stay out of AI context
    const line = (m: Record<string, number | string | null>) => {
      const n = (k: string) => Number(m[k] ?? 0);
      const revenue = n("total_revenue") || (n("mrr_manual") || n("mrr")) + n("oneoff_revenue");
      return `${String(m.month).slice(0, 7)}: revenue $${revenue.toLocaleString()}, expenses $${n("expenses").toLocaleString()}, ${m.active_retainers ?? "?"} retainers${n("retainers_lost") ? ` (lost ${n("retainers_lost")})` : ""}, ${n("new_clients")} new clients${m.business_confidence != null ? `, confidence ${m.business_confidence}/10` : ""}`;
    };
    const prompt = [
      `CLIENT: ${profile.full_name ?? "Client"}`,
      profile.business_overview ? `BUSINESS: ${profile.business_overview}` : "",
      goalRow?.target_mrr ? `THEIR MRR TARGET: $${Number(goalRow.target_mrr).toLocaleString()}${goalRow.target_date ? ` by ${goalRow.target_date}` : ""}` : "",
      `\nCHECK-INS (newest first):\n${(months ?? []).map(m => line(m as Record<string, number | string | null>)).join("\n") || "(none)"}`,
      `\nGOALS FROM PREVIOUS CALLS:\n${(goals ?? []).map(g => `- ${g.set_on}: ${g.goal} [${g.status}]`).join("\n") || "(none set yet)"}`,
      `\nCONTEXT ROOM:\n${buildContextMarkdown(answers) || "(empty)"}`,
    ].filter(Boolean).join("\n");

    const raw = await callModel(prompt);
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return json({ error: "Could not read the model's answer — try again" }, 502);
    let parsed: { points?: unknown };
    try { parsed = JSON.parse(match[0]); } catch { return json({ error: "Could not read the model's answer — try again" }, 502); }
    const points = Array.isArray(parsed.points)
      ? parsed.points.filter((p): p is string => typeof p === "string" && p.trim().length > 0).map(p => p.trim().replace(/^[•\-*\d.]+\s*/, "").slice(0, 220)).slice(0, 3)
      : [];
    if (!points.length) return json({ error: "No talking points came back — try again" }, 502);
    return json({ points });
  } catch (err) {
    console.error("quarterly-prep failed", err);
    return json({ error: err instanceof Error ? err.message : "Could not build the prep" }, 500);
  }
});

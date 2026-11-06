// The Monday "who do I talk to this week" list for Dan and Emily.
//
// Called three ways:
//   - by the Monday cron job (x-cron-secret). If DIGEST_WEBHOOK_URL is set the
//     digest is also POSTed there as { text, items }, so Zapier/Make can turn it
//     into a WhatsApp, Slack or email message. The portal has no email provider.
//   - by an admin in the portal ("Weekly digest" button), which just gets it back.
// The portal never sends a client anything from here: it is for the team only.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { isCronCall } from "../_shared/cron.ts";
import {
  attention, computeMomentum, daysBetween, describeQuarterly, effectiveStatus, formatShortDate,
  lastContact, quarterly, touchEveryDays, STATUS_STYLE, type DanRead, type Touchpoint,
} from "../_shared/clientCare.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};
const TOP = 10;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  try {
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const cron = await isCronCall(admin, req);
    if (!cron) {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
      const scoped = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
      const { data: userData } = await scoped.auth.getUser();
      if (!userData?.user) return json({ error: "Unauthorized" }, 401);
      const { data: caller } = await scoped.from("profiles").select("is_admin").eq("id", userData.user.id).single();
      if (!caller?.is_admin) return json({ error: "Admin access required" }, 403);
    }

    const now = new Date();
    const [people, totals, touches, care, rooms] = await Promise.all([
      admin.from("profiles").select("id, full_name, created_at").is("archived_at", null).or("is_admin.is.null,is_admin.eq.false"),
      admin.from("monthly_totals").select("user_id, month, created_at, total_revenue, mrr, mrr_manual, oneoff_revenue, business_confidence, retainers_lost, active_retainers, expenses").order("month", { ascending: false }).limit(1500),
      admin.from("client_touchpoints").select("client_id, kind, occurred_at").order("occurred_at", { ascending: false }).limit(10000),
      admin.from("client_care").select("client_id, touch_every_days, dan_read"),
      admin.from("context_rooms").select("user_id, cadence:answers->>check_in_cadence"),
    ]);
    for (const r of [people, totals, touches, care, rooms]) if (r.error) throw r.error;

    const group = <T extends Record<string, unknown>>(rows: T[] | null, key: string) =>
      (rows ?? []).reduce<Record<string, T[]>>((acc, r) => ((acc[String(r[key])] ??= []).push(r), acc), {});
    const totalsBy = group(totals.data as Record<string, unknown>[], "user_id");
    const touchesBy = group(touches.data as Record<string, unknown>[], "client_id");
    const careBy = Object.fromEntries((care.data ?? []).map(c => [c.client_id, c]));
    const cadenceBy = Object.fromEntries(((rooms.data ?? []) as unknown as { user_id: string; cadence: string | null }[]).map(r => [r.user_id, r.cadence]));

    const items = (people.data ?? []).map(p => {
      const months = (totalsBy[p.id] ?? []) as Record<string, number | string | null>[];
      const num = (r: Record<string, number | string | null>) =>
        Number(r.total_revenue) || (Number(r.mrr_manual || r.mrr || 0) + Number(r.oneoff_revenue || 0));
      const lastCheckin = months[0]?.created_at ? daysBetween(new Date(String(months[0].created_at)), now) : null;
      const momentum = computeMomentum({
        revenueSeries: months.map(num),
        confidenceSeries: months.map(r => (r.business_confidence as number | null) ?? null),
        retainersLostSeries: months.map(r => (r.retainers_lost as number | null) ?? null),
        activeRetainersSeries: months.map(r => (r.active_retainers as number | null) ?? null),
        expensesSeries: months.map(r => (r.expenses as number | null) ?? null),
        daysSinceCheckin: lastCheckin,
        daysSinceJoined: p.created_at ? daysBetween(new Date(p.created_at), now) : null,
      });
      const c = careBy[p.id];
      const { status } = effectiveStatus(momentum, (c?.dan_read ?? null) as DanRead | null);
      const tps = (touchesBy[p.id] ?? []) as unknown as Touchpoint[];
      const contact = lastContact(tps, now);
      const q = quarterly(tps, p.created_at, now);
      const attn = attention({ status, contact, quarterly: q, touchEveryDays: touchEveryDays(c?.touch_every_days, cadenceBy[p.id]), isNew: momentum.status === "new" });
      return { id: p.id, name: p.full_name ?? "Unnamed", status: STATUS_STYLE[status].label, quarterly: q, attention: attn };
    });

    const todo = items.filter(i => i.attention.priority > 0).sort((a, b) => b.attention.priority - a.attention.priority);
    const soon = items.filter(i => i.quarterly.state === "soon" || i.quarterly.state === "overdue")
      .sort((a, b) => (a.quarterly.daysUntil ?? 0) - (b.quarterly.daysUntil ?? 0));

    const heading = `ProfitX weekly — ${now.toLocaleDateString("en-AU", { weekday: "long", day: "numeric", month: "short", timeZone: "Australia/Sydney" })}`;
    const lines = [heading, `${items.length} clients · ${todo.length} need a message or call`, ""];
    if (todo.length) {
      lines.push(`TALK TO NEXT${todo.length > TOP ? ` (top ${TOP} of ${todo.length})` : ""}`);
      for (const i of todo.slice(0, TOP)) lines.push(`• ${i.name} (${i.status}) — ${i.attention.reasons.join(" · ")}`);
    } else lines.push("Nobody needs a message or call this week.");
    if (soon.length) {
      lines.push("", "QUARTERLY CALLS");
      for (const i of soon.slice(0, TOP)) lines.push(`• ${i.name} — ${describeQuarterly(i.quarterly)} (due ${formatShortDate(i.quarterly.dueAt)})`);
    }
    const text = lines.join("\n");
    const payload = { text, items: todo.slice(0, TOP).map(i => ({ client: i.name, status: i.status, reasons: i.attention.reasons })) };

    let webhook: "sent" | "failed" | "not set" = "not set";
    const url = Deno.env.get("DIGEST_WEBHOOK_URL");
    if (cron && url) {
      try {
        const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
        webhook = res.ok ? "sent" : "failed";
        if (!res.ok) console.error("digest webhook returned", res.status);
      } catch (err) { webhook = "failed"; console.error("digest webhook failed", err); }
    }
    return json({ ...payload, webhook });
  } catch (err) {
    console.error("weekly-digest failed", err);
    return json({ error: err instanceof Error ? err.message : "Could not build the digest" }, 500);
  }
});

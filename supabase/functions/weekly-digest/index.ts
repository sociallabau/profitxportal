// The Monday "who do I talk to this week" list for Dan and Emily.
//
// Called two ways:
//   - by the Monday cron job (x-cron-secret). It saves this week's snapshot, so next Monday can
//     say who got worse, and, if DIGEST_WEBHOOK_URL is set, POSTs { text, items } there so
//     Zapier/Make can turn it into a WhatsApp, Slack or email message. The portal has no
//     email provider.
//   - by an admin in the portal ("Weekly digest" button), which just gets it back and saves nothing.
// The portal never sends a client anything from here: it is for the team only.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { isCronCall } from "../_shared/cron.ts";
import {
  assessClient, BUCKET_SEVERITY, BUCKET_STYLE, describeQuarterly, formatShortDate,
  type Bucket, type DanRead, type MonthInput, type Touchpoint,
} from "../_shared/clientCare.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};
const TOP = 10;

type Row = Record<string, number | string | null>;

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
    const today = now.toLocaleDateString("en-CA", { timeZone: "Australia/Sydney" });
    // The planned-date column arrives with the latest migration: until then, read the care table without it.
    const readCare = async () => {
      const full = await admin.from("client_care").select("client_id, touch_every_days, dan_read, dan_read_note, quarterly_due_on");
      return full.error ? await admin.from("client_care").select("client_id, touch_every_days, dan_read, dan_read_note") : full;
    };
    const [people, totals, touches, care, rooms, overview, previous] = await Promise.all([
      admin.from("profiles").select("id, full_name, created_at").is("archived_at", null).or("is_admin.is.null,is_admin.eq.false"),
      admin.from("monthly_totals").select("user_id, month, total_revenue, mrr, mrr_manual, oneoff_revenue, business_confidence, nps, retainers_lost, active_retainers, expenses").order("month", { ascending: false }).limit(1500),
      admin.from("client_touchpoints").select("client_id, kind, occurred_at").order("occurred_at", { ascending: false }).limit(10000),
      readCare(),
      admin.from("context_rooms").select("user_id, cadence:answers->>check_in_cadence"),
      admin.from("admin_client_overview").select("id, days_since_submission, days_since_last_login"),
      admin.from("client_status_log").select("client_id, snapshot_on, bucket").lt("snapshot_on", today).order("snapshot_on", { ascending: false }).limit(5000),
    ]);
    for (const r of [people, totals, touches, care, rooms, overview]) if (r.error) throw r.error;
    // The snapshot table may not exist yet if the latest migration has not run: skip "what changed" rather than fail.
    const previousRows = previous.error ? [] : previous.data ?? [];

    const group = <T extends Record<string, unknown>>(rows: T[] | null, key: string) =>
      (rows ?? []).reduce<Record<string, T[]>>((acc, r) => ((acc[String(r[key])] ??= []).push(r), acc), {});
    const totalsBy = group(totals.data as Row[], "user_id");
    const touchesBy = group(touches.data as Row[], "client_id");
    const careBy = Object.fromEntries((care.data ?? []).map(c => [c.client_id, c]));
    const cadenceBy = Object.fromEntries(((rooms.data ?? []) as unknown as { user_id: string; cadence: string | null }[]).map(r => [r.user_id, r.cadence]));
    const overviewBy = Object.fromEntries((overview.data ?? []).map(o => [o.id, o]));
    // The most recent earlier snapshot per client.
    const previousBucket: Record<string, Bucket> = {};
    for (const r of previousRows) if (!(r.client_id in previousBucket)) previousBucket[r.client_id] = r.bucket as Bucket;

    const items = (people.data ?? []).map(p => {
      const months: MonthInput[] = ((totalsBy[p.id] ?? []) as Row[]).map(m => ({
        revenue: Number(m.total_revenue) || (Number(m.mrr_manual || m.mrr || 0) + Number(m.oneoff_revenue || 0)),
        confidence: (m.business_confidence as number | null) ?? null,
        nps: (m.nps as number | null) ?? null,
        retainersLost: (m.retainers_lost as number | null) ?? null,
        activeRetainers: (m.active_retainers as number | null) ?? null,
        expenses: (m.expenses as number | null) ?? null,
      }));
      const c = careBy[p.id];
      const o = overviewBy[p.id];
      const a = assessClient({
        joinedAt: p.created_at, months,
        daysSinceCheckin: o?.days_since_submission ?? null,
        daysSinceLogin: o?.days_since_last_login ?? null,
        touchpoints: (touchesBy[p.id] ?? []) as unknown as Touchpoint[],
        danRead: (c?.dan_read ?? null) as DanRead | null, danReadNote: c?.dan_read_note ?? null,
        touchEveryExplicit: c?.touch_every_days, contextCadence: cadenceBy[p.id], quarterlyPlannedOn: (c as { quarterly_due_on?: string | null } | undefined)?.quarterly_due_on,
      }, now);
      return { id: p.id, name: p.full_name ?? "Unnamed", ...a };
    });

    const inBucket = (b: Bucket) => items.filter(i => i.attention.bucket === b).sort((x, y) => y.attention.priority - x.attention.priority);
    const act = inBucket("act");
    const reach = inBucket("reach");
    const quarterlyList = inBucket("quarterly");
    const doingWell = items.filter(i => i.attention.bucket === "good" || i.attention.bucket === "new").length;
    const worse = items
      .filter(i => previousBucket[i.id] && BUCKET_SEVERITY[i.attention.bucket] > BUCKET_SEVERITY[previousBucket[i.id]])
      .sort((x, y) => y.attention.priority - x.attention.priority);

    const line = (i: (typeof items)[number], extra = "") => `• ${i.name} — ${i.attention.reasons.slice(0, 3).join(" · ")}${extra}`;
    const lines = [
      `ProfitX weekly — ${now.toLocaleDateString("en-AU", { weekday: "long", day: "numeric", month: "short", timeZone: "Australia/Sydney" })}`,
      `${act.length + reach.length} need you this week · ${doingWell} doing well`,
    ];
    if (worse.length) {
      lines.push("", "GOT WORSE SINCE LAST WEEK");
      for (const i of worse.slice(0, TOP)) lines.push(line(i, ` (was ${BUCKET_STYLE[previousBucket[i.id]].label.toLowerCase()}, now ${BUCKET_STYLE[i.attention.bucket].label.toLowerCase()})`));
    }
    if (act.length) { lines.push("", "ACT NOW"); for (const i of act.slice(0, TOP)) lines.push(line(i)); }
    if (reach.length) { lines.push("", "REACH OUT"); for (const i of reach.slice(0, TOP)) lines.push(line(i)); }
    if (quarterlyList.length) {
      lines.push("", "QUARTERLY CALLS");
      for (const i of quarterlyList.slice(0, TOP)) lines.push(`• ${i.name} — ${describeQuarterly(i.quarterly)} (due ${formatShortDate(i.quarterly.dueAt)})`);
    }
    if (!act.length && !reach.length && !quarterlyList.length) lines.push("", "Nobody needs you this week.");
    const text = lines.join("\n");
    const payload = {
      text,
      items: [...act, ...reach].slice(0, TOP).map(i => ({ client: i.name, bucket: i.attention.bucket, reasons: i.attention.reasons })),
      got_worse: worse.slice(0, TOP).map(i => i.name),
    };

    // Save this week's snapshot, but only from the Monday job: opening the digest in the portal must not rewrite history.
    if (cron) {
      const { error } = await admin.from("client_status_log").upsert(
        items.map(i => ({ client_id: i.id, snapshot_on: today, bucket: i.attention.bucket, status: i.status, reasons: i.attention.reasons })),
        { onConflict: "client_id,snapshot_on" },
      );
      if (error) console.error("could not save the status snapshot", error.message);
    }

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

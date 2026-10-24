/**
 * Admin "All clients" mode: every active member's gate, latest numbers, build
 * list and Dan AI memory in one block, so Dan can ask across his whole client
 * base ("who's stuck at Gate 1?", "who needs a call this week?").
 */

// deno-lint-ignore no-explicit-any
type DB = any;

type Profile = { id: string; full_name: string | null; gate: string | null; gate_key_task: string | null };
type Month = {
  user_id: string; month: string; mrr: number | null; total_revenue: number | null; oneoff_revenue: number | null;
  new_clients: number | null; content_posts: number | null; leads_generated: number | null; booked_calls: number | null;
  retainer_convos: number | null; active_retainers: number | null; ad_spend: number | null; business_confidence: number | null;
};
type Memory = { user_id: string; memory: Record<string, unknown> | null; refreshed_at: string | null };

const money = (n: number | null | undefined) => n == null ? "?" : `$${Math.round(Number(n)).toLocaleString("en-US")}`;
const monthLabel = (m: string) => new Date(`${m.slice(0, 7)}-01T12:00:00Z`).toLocaleDateString("en-AU", { month: "short", year: "numeric" });
const clip = (s: unknown, n: number) => {
  const t = String(s ?? "").replace(/\s+/g, " ").trim();
  return t.length > n ? `${t.slice(0, n - 1)}…` : t;
};
const list = (v: unknown, n = 3) => Array.isArray(v) ? v.slice(0, n).map(x => clip(x, 140)).filter(Boolean).join("; ") : "";

export async function loadRoster(admin: DB, today = new Date()): Promise<{ text: string; clients: number }> {
  const [{ data: profiles }, { data: months }, { data: memories }, { data: progress }, { data: questions }] = await Promise.all([
    admin.from("profiles").select("id, full_name, gate, gate_key_task").eq("is_admin", false).eq("access_revoked", false).is("archived_at", null).order("full_name"),
    admin.from("monthly_totals").select("user_id, month, mrr, total_revenue, oneoff_revenue, new_clients, content_posts, leads_generated, booked_calls, retainer_convos, active_retainers, ad_spend, business_confidence").order("month", { ascending: false }).limit(1500),
    admin.from("member_memory").select("user_id, memory, refreshed_at"),
    admin.from("member_task_progress").select("user_id, status"),
    admin.from("client_questions").select("user_id, question, created_at").order("created_at", { ascending: false }).limit(400),
  ]);
  const byUser = <T extends { user_id: string }>(rows: T[] | null) =>
    (rows ?? []).reduce<Record<string, T[]>>((acc, r) => ((acc[r.user_id] ??= []).push(r), acc), {});
  const m = byUser(months as Month[] | null);
  const mem = Object.fromEntries(((memories ?? []) as Memory[]).map(x => [x.user_id, x]));
  const prog = byUser(progress as { user_id: string; status: string }[] | null);
  const asked = byUser(questions as { user_id: string; question: string; created_at: string }[] | null);

  const blocks = ((profiles ?? []) as Profile[]).filter(p => p.full_name).map(p => {
    const rows = (m[p.id] ?? []).slice(0, 3);
    const t = rows[0];
    const L = [`## ${p.full_name} — ${p.gate ?? "no gate set"}${p.gate_key_task ? ` · key task: ${clip(p.gate_key_task, 120)}` : ""}`];
    if (t) {
      const days = Math.round((today.getTime() - new Date(`${t.month.slice(0, 10)}T12:00:00Z`).getTime()) / 86400000);
      L.push(`Latest numbers (${monthLabel(t.month)}, ${days} days old): MRR ${money(t.mrr)}, total ${money(t.total_revenue)}, one-off ${money(t.oneoff_revenue)}, retainers ${t.active_retainers ?? "?"}, new clients ${t.new_clients ?? "?"}, retainer convos ${t.retainer_convos ?? "?"}, posts ${t.content_posts ?? "?"}, leads ${t.leads_generated ?? "?"}, booked calls ${t.booked_calls ?? "?"}, ad spend ${money(t.ad_spend)}, confidence ${t.business_confidence ?? "?"}/10`);
      if (rows.length > 1) L.push(`Earlier: ${rows.slice(1).map(r => `${monthLabel(r.month)} MRR ${money(r.mrr)}, total ${money(r.total_revenue)}`).join(" | ")}`);
    } else L.push("Latest numbers: none submitted");
    const pr = prog[p.id] ?? [];
    if (pr.length) {
      const n = (s: string) => pr.filter(x => x.status === s).length;
      L.push(`Build list ticks: ${n("approved")} approved, ${n("submitted")} waiting on Dan, ${n("needs_changes")} sent back`);
    }
    const x = mem[p.id]?.memory;
    if (x) {
      if (x.snapshot) L.push(`Snapshot: ${clip(x.snapshot, 320)}`);
      const stuck = list(x.stuck); if (stuck) L.push(`Stuck: ${stuck}`);
      const working = list(x.working, 2); if (working) L.push(`Working: ${working}`);
      if (x.next_focus) L.push(`Next focus: ${clip(x.next_focus, 200)}`);
      const watch = list(x.watch_outs); if (watch) L.push(`Watch outs: ${watch}`);
    }
    const qs = (asked[p.id] ?? []).slice(0, 3).map(q => clip(q.question, 120));
    if (qs.length) L.push(`Recently asked Dan AI: ${qs.join(" | ")}`);
    return L.join("\n");
  });
  return { text: `ALL CLIENTS (${blocks.length} active, as of ${today.toISOString().slice(0, 10)})\n\n${blocks.join("\n\n")}`, clients: blocks.length };
}

export const ROSTER_PROMPT = `You are Dan Wilmott's analyst inside the ProfitX portal. Dan (the coach, an admin) is asking about his WHOLE client base. ALL CLIENTS below is everything the portal holds on each active member: gate, latest numbers, build list, Dan AI's memory of them and what they've asked recently. DAN'S BRAIN above is his method: use its gate criteria, priorities and numbers to judge who's on track.

Rules:
- Answer Dan directly, by client name, using their real numbers. Name names: this is Dan's own private view.
- Facts only from ALL CLIENTS. If the data doesn't show it (e.g. numbers missing or stale), say so rather than guess.
- Rank by what matters most for Dan's time: who's at risk or stuck first, then who's close to moving up.
- Short and scannable. No fluff, no greeting.

Return JSON only:
{"answer": "one line answering the question",
 "points": [{"do": "Client name — what's going on / what to do", "why": "the number or fact behind it"}],
 "note": "optional one line, e.g. whose data is missing or stale, else null",
 "resource": null}
Up to 8 points.`;

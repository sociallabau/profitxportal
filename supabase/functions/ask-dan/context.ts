// Member context + DERIVED numbers, computed in code so the model never does the maths.
// Pure: no I/O. Used for real members (MEMBER/ADMIN mode) and synthetic personas (TEST mode).
import { contextSections, isFilled, type ContextAnswers } from "../_shared/contextRoom.ts";

export type Totals = {
  month: string; mrr?: number | null; mrr_manual?: number | null; total_revenue?: number | null;
  new_clients?: number | null; ad_spend?: number | null; content_posts?: number | null;
  booked_calls?: number | null; leads_generated?: number | null; offers_made?: number | null;
  oneoff_revenue?: number | null; expenses?: number | null; calls_showed?: number | null;
};
export type Goal = {
  starting_mrr?: number | null; target_mrr?: number | null; target_date?: string | null;
  retainer_tier_1?: number | null; retainer_tier_2?: number | null; retainer_tier_3?: number | null;
};
export type MemberInput = {
  name?: string | null;
  business_overview?: string | null;
  gate?: string | null; gate_key_task?: string | null; gate_move_up?: string | null;
  answers: ContextAnswers;
  totals: Totals[]; // newest first, max 3
  goal: Goal | null;
};

export type Derived = {
  latest_month: string | null; days_since_latest: number | null;
  data_freshness: "fresh" | "stale" | "none";
  mrr_latest: number | null; mrr_trend: string | null;
  oneoff_revenue_latest: number | null; total_revenue_latest: number | null; all_oneoff: boolean;
  new_clients_latest: number | null; ad_spend_latest: number | null;
  cost_per_client: number | null; lowest_retainer_price: number | null;
  cac_vs_first_month: number | null; cac_verdict: string;
  revenue_reliable: boolean; calls_tracked: boolean;
  goal_status: "current" | "expired" | "none";
  context_room_filled: number; context_room_missing: string[];
};

const KEY_FIELDS: [string, string][] = [
  ["offers_detail", "offer prices"], ["niche", "niche"], ["team", "team"],
  ["main_lead_source", "main lead source"], ["biggest_blocker", "biggest blocker"],
];

const norm = (v: unknown) => String(Array.isArray(v) ? v.join(", ") : v ?? "").trim().replace(/\s+/g, " ").toLowerCase();
/** Keys whose topic the business overview clearly covers (so they're not "missing"). */
const OVERVIEW_COVERS: Record<string, RegExp> = {
  offers_detail: /\$\s?\d|\d+\s?k\b|per month|\/m(o|th)?\b|retainer|package|tier/i,
  niche: /\b(niche|for|work with|serve|clients? (are|in)|industry|businesses|brands|cafes?|gyms?|real estate|trades?|clinics?)\b/i,
  team: /\b(team|editor|solo|myself|staff|hire|contractor|employee)\b/i,
  main_lead_source: /\b(leads?|referrals?|outreach|instagram|ads|word of mouth|dms?)\b/i,
};
const money = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;
const monthLabel = (iso: string) =>
  new Date(iso + (iso.length <= 10 ? "T00:00:00Z" : "")).toLocaleString("en-AU", { month: "short", year: "numeric", timeZone: "UTC" });
const mrrOf = (t: Totals) => t.mrr ?? t.mrr_manual ?? null;

export function derive(m: MemberInput, today = new Date()): Derived {
  const t = m.totals;
  const latest = t[0] ?? null;
  const days = latest ? Math.floor((today.getTime() - Date.parse(latest.month + "T00:00:00Z")) / 86400000) : null;
  const mrrLatest = latest ? mrrOf(latest) : null;
  let trend: string | null = null;
  if (t.length >= 2) {
    const a = mrrOf(t[t.length - 1]), b = mrrLatest;
    if (a != null && b != null) {
      const diff = b - a;
      const pct = a ? Math.round((diff / a) * 100) : null;
      trend = diff === 0 ? "flat" : `${diff > 0 ? "up" : "down"} ${money(Math.abs(diff))}${pct != null ? ` (${Math.abs(pct)}%)` : ""} over ${t.length} months`;
    }
  }
  const nc = latest?.new_clients ?? null, ad = latest?.ad_spend ?? null;
  const cpc = nc && nc > 0 && ad && ad > 0 ? ad / nc : null;
  const tiers = [m.goal?.retainer_tier_1, m.goal?.retainer_tier_2, m.goal?.retainer_tier_3].filter((v): v is number => typeof v === "number" && v > 0);
  const low = tiers.length ? Math.min(...tiers) : null;
  const ratio = cpc != null && low ? cpc / low : null;
  const verdict = ratio == null ? "unknown"
    : ratio < 0.25 ? "under 25% — excellent, spend more"
    : ratio < 0.5 ? "under 50% — allowed to scale"
    : "over 50% — fix ads/offer before scaling";
  const revenueReliable = !t.some(r => r.total_revenue != null && mrrOf(r) != null && r.total_revenue! < mrrOf(r)!);
  const callsTracked = !t.some(r => r.booked_calls === 0 && (r.new_clients ?? 0) > 0);
  const td = m.goal?.target_date;
  const todayIso = today.toISOString().slice(0, 10);
  const goalStatus = !td ? "none" : td >= todayIso ? "current" : "expired";
  const fields = contextSections.flatMap(s => s.fields).filter(f => f.key !== "anything_else");
  const filled = fields.filter(f => isFilled(m.answers[f.key])).length;
  const ov = m.business_overview?.trim() || "";
  const missing = KEY_FIELDS.filter(([k]) => !isFilled(m.answers[k]) && !(ov && OVERVIEW_COVERS[k]?.test(ov))).map(([, l]) => l);
  const oneoff = latest?.oneoff_revenue ?? null, totalRev = latest?.total_revenue ?? null;
  const allOneoff = (mrrLatest ?? 0) === 0 && ((totalRev ?? 0) > 0 || (oneoff ?? 0) > 0);
  if (!m.gate) missing.push("current gate");
  return {
    latest_month: latest?.month ?? null, days_since_latest: days,
    data_freshness: !latest ? "none" : (days ?? 0) > 45 ? "stale" : "fresh",
    mrr_latest: mrrLatest, mrr_trend: trend,
    oneoff_revenue_latest: oneoff, total_revenue_latest: totalRev, all_oneoff: allOneoff, new_clients_latest: nc, ad_spend_latest: ad,
    cost_per_client: cpc, lowest_retainer_price: low,
    cac_vs_first_month: ratio != null ? Math.round(ratio * 100) : null, cac_verdict: verdict,
    revenue_reliable: revenueReliable, calls_tracked: callsTracked, goal_status: goalStatus,
    context_room_filled: filled, context_room_missing: missing,
  };
}

/** Builds the ABOUT THIS MEMBER block. Excludes support.anything_else. */
export function buildMemberBlock(m: MemberInput, today = new Date()): { text: string; derived: Derived; hasContext: boolean; summary: string } {
  const d = derive(m, today);
  const ovNorm = m.business_overview ? norm(m.business_overview) : "";
  const fields = contextSections.flatMap(s => s.fields).filter(f => f.key !== "anything_else" && isFilled(m.answers[f.key])
    && !(ovNorm && norm(m.answers[f.key]) === ovNorm));
  const hasContext = !!(m.name || m.business_overview || fields.length || m.totals.length || m.goal || m.gate);
  if (!hasContext) return { text: "ABOUT THIS MEMBER: nothing filled in yet.", derived: d, hasContext, summary: "nothing filled in yet" };

  const L: string[] = ["ABOUT THIS MEMBER"];
  const biz = m.answers.business_name ? String(m.answers.business_name) : null;
  L.push(`Name / business: ${[m.name, biz].filter(Boolean).join(" / ") || "unknown"}`);
  if (m.business_overview) L.push(`Business overview: ${m.business_overview}`);
  for (const f of fields) {
    const v = m.answers[f.key];
    L.push(`${f.label}: ${Array.isArray(v) ? v.join(", ") : v}`);
  }
  if (m.gate) L.push(`Current gate (set by Dan): ${m.gate}`);
  if (m.gate_key_task) L.push(`Gate key task: ${m.gate_key_task}`);
  if (m.gate_move_up) L.push(`To move up a gate: ${m.gate_move_up}`);
  const tiers = [1, 2, 3].map(i => m.goal?.[`retainer_tier_${i}` as keyof Goal]).filter(v => v != null);
  if (tiers.length) L.push(`Retainer tiers: ${tiers.map(v => money(Number(v))).join(" / ")}`);

  if (m.totals.length) {
    const rows = m.totals.map(t => {
      const parts: string[] = [];
      const mrr = mrrOf(t);
      if (mrr != null) parts.push(`MRR ${money(mrr)}`);
      if (t.total_revenue != null) parts.push(`total revenue ${money(t.total_revenue)}`);
      if (t.oneoff_revenue != null) parts.push(`one-off revenue ${money(t.oneoff_revenue)}`);
      if (t.new_clients != null) parts.push(`new clients ${t.new_clients}`);
      if (t.ad_spend != null) parts.push(`ad spend ${money(t.ad_spend)}`);
      if (t.leads_generated != null) parts.push(`leads ${t.leads_generated}`);
      if (t.booked_calls != null) parts.push(`booked calls ${t.booked_calls}`);
      if (t.offers_made != null) parts.push(`offers ${t.offers_made}`);
      if (t.content_posts != null) parts.push(`posts ${t.content_posts}`);
      return `${monthLabel(t.month)}: ${parts.join(", ")}`;
    });
    L.push(`Monthly totals (newest first): ${rows.join(" | ")}`);
  } else L.push("Monthly totals: none submitted yet");
  if (m.goal?.target_mrr) L.push(`90-day goal: ${money(m.goal.target_mrr)} MRR by ${m.goal.target_date ?? "no date"}`);

  L.push("DERIVED (computed, trust these):");
  if (d.data_freshness === "none") L.push("- Data: no monthly totals submitted");
  else L.push(`- Data: based on ${monthLabel(d.latest_month!)} numbers (${d.days_since_latest} days old — ${d.data_freshness.toUpperCase()})${d.data_freshness === "stale" ? `. Say "based on your ${monthLabel(d.latest_month!).split(" ")[0]} numbers" and nudge them to submit their latest totals.` : ""}`);
  if (d.all_oneoff) L.push(`- Revenue: ${money(d.total_revenue_latest ?? d.oneoff_revenue_latest ?? 0)}, all one-off — $0 recurring. Say "your money's all one-off right now", not "$0 MRR".`);
  else if (d.mrr_latest != null) L.push(`- MRR: ${money(d.mrr_latest)}${d.mrr_trend ? `, ${d.mrr_trend}` : ""}`);
  if (d.cost_per_client != null) {
    L.push(`- Cost per new client: ~${money(d.cost_per_client)}${d.lowest_retainer_price ? ` vs lowest retainer ${money(d.lowest_retainer_price)} = ${d.cac_vs_first_month}% → ${d.cac_verdict}` : " (no retainer price on file)"}`);
  } else L.push("- Cost per new client: unknown (needs ad spend and new clients)");
  if (!d.revenue_reliable) L.push("- Total revenue: UNRELIABLE (lower than MRR) — use MRR only");
  if (!d.calls_tracked) L.push("- Calls: not tracked (0 booked calls but clients signed) — don't say they had no calls");
  if (d.goal_status === "expired") L.push(`- Goal: ${money(m.goal!.target_mrr ?? 0)} MRR by ${m.goal!.target_date} — EXPIRED. Don't treat it as current; ask them to set a new 90-day goal in their Context Room.`);
  else if (d.goal_status === "current") L.push(`- Goal: ${money(m.goal!.target_mrr ?? 0)} MRR by ${m.goal!.target_date} — current`);
  else L.push("- Goal: none set");
  if (d.context_room_missing.length) L.push(`Missing from Context Room: ${d.context_room_missing.join(", ")}`);

  const summary = [m.name, m.gate ? `gate: ${m.gate}` : null, d.mrr_latest != null ? `MRR ${money(d.mrr_latest)}` : null,
    d.cost_per_client != null ? `cost/client ~${money(d.cost_per_client)}` : null, `data ${d.data_freshness}`, `goal ${d.goal_status}`]
    .filter(Boolean).join(", ");
  return { text: L.join("\n"), derived: d, hasContext, summary };
}

// Member context + DERIVED numbers, computed in code so the model never does the maths.
// Pure: no I/O. Used for real members (MEMBER/ADMIN mode) and synthetic personas (TEST mode).
import { contextSections, isFilled, type ContextAnswers } from "../_shared/contextRoom.ts";
import { nextBuildTask, type MemberExtras } from "./dossier.ts";
import { instagramLines } from "./instagram.ts";
import { signalLines, signals } from "./signals.ts";

export type Totals = {
  month: string; mrr?: number | null; mrr_manual?: number | null; total_revenue?: number | null;
  new_clients?: number | null; ad_spend?: number | null; content_posts?: number | null;
  booked_calls?: number | null; leads_generated?: number | null; offers_made?: number | null;
  oneoff_revenue?: number | null; expenses?: number | null; calls_showed?: number | null;
  active_retainers?: number | null; retainers_lost?: number | null; retainer_convos?: number | null; ad_leads?: number | null;
  case_studies_posted?: number | null; ad_spend_awareness?: number | null; ad_spend_leadgen?: number | null;
  meetings?: number | null; expense_contractors?: number | null;
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
  totals: Totals[]; // newest first, max 6
  goal: Goal | null;
  extras?: MemberExtras; // everything else in the portal (real members only; personas don't have it)
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
  // Days since the END of their latest month: last month's numbers aren't old until the month after is over.
  const [ly, lm] = latest ? latest.month.split("-").map(Number) : [];
  const days = latest ? Math.floor((today.getTime() - Date.UTC(ly, lm, 1)) / 86400000) : null;
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
  return {
    latest_month: latest?.month ?? null, days_since_latest: days,
    data_freshness: !latest ? "none" : (days ?? 0) > 35 ? "stale" : "fresh",
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
      if (t.active_retainers != null) parts.push(`paying retainers ${t.active_retainers}`);
      if (t.retainers_lost) parts.push(`retainers lost ${t.retainers_lost}`);
      if (t.ad_spend != null) parts.push(`ad spend ${money(t.ad_spend)}${t.ad_spend_awareness != null || t.ad_spend_leadgen != null ? ` (awareness ${money(t.ad_spend_awareness ?? 0)}, lead gen ${money(t.ad_spend_leadgen ?? 0)})` : ""}`);
      if (t.retainer_convos != null || t.ad_leads != null) {
        if (t.retainer_convos != null) parts.push(`retainer conversations ${t.retainer_convos}`);
        if (t.ad_leads != null) parts.push(`ad leads ${t.ad_leads}`);
      } else if (t.leads_generated != null) parts.push(`leads ${t.leads_generated}`);
      if (t.case_studies_posted != null) parts.push(`case studies posted ${t.case_studies_posted}`);
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
  if (m.extras) L.push(...extrasLines(m.extras));
  L.push(...signalLines(signals(m, d)));

  const summary = [m.name, m.gate ? `gate: ${m.gate}` : null, d.mrr_latest != null ? `MRR ${money(d.mrr_latest)}` : null,
    d.cost_per_client != null ? `cost/client ~${money(d.cost_per_client)}` : null, `data ${d.data_freshness}`, `goal ${d.goal_status}`]
    .filter(Boolean).join(", ");
  return { text: L.join("\n"), derived: d, hasContext, summary };
}

const STATUS_LABEL: Record<string, string> = { approved: "DONE (Dan approved)", submitted: "ticked by them, proof goes to Dan on WhatsApp", needs_changes: "SENT BACK by Dan", open: "not done yet" };

/** The rest of the portal, as plain lines the model can use. */
export function extrasLines(x: MemberExtras): string[] {
  const L: string[] = [];
  if (x.memory) {
    L.push(`WHAT YOU KNOW ABOUT THEM (your running memory${x.memory.refreshed_at ? `, updated ${x.memory.refreshed_at.slice(0, 10)}` : ""}${x.memory.stale ? "; newer data below wins on conflict" : ""}):`);
    L.push(x.memory.summary);
  }
  const j = x.journey;
  if (j.joined || j.starting_mrr != null || j.first_month) {
    L.push(`WHERE THEY STARTED: ${[j.joined && `joined ProfitX ${j.joined}`, j.starting_mrr != null && `starting MRR $${Math.round(j.starting_mrr).toLocaleString("en-US")}`, j.first_month && `first logged month ${j.first_month}${j.first_mrr != null ? ` at $${Math.round(j.first_mrr).toLocaleString("en-US")} MRR` : ""}`].filter(Boolean).join(", ")}`);
  }
  if (x.build.length) {
    const done = x.build.filter(t => t.status === "approved").length;
    L.push(`GATE BUILD LIST (Gate ${x.gate_number}, ${done}/${x.build.length} done; monthly tasks reset each month):`);
    for (const t of x.build) {
      L.push(`- [${STATUS_LABEL[t.status]}] ${t.title} (${t.kind}${t.training ? `; training: ${t.training}` : ""})${t.review_note ? ` — Dan's note: "${t.review_note}"` : ""}`);
    }
    const next = nextBuildTask(x.build);
    if (next) L.push(`NEXT BUILD TASK: ${next.title}${next.training ? ` — training: ${next.training}` : ""}${next.status === "needs_changes" ? " (Dan sent it back, fix this first)" : ""}`);
  }
  if (x.fast_track_lead_gen) L.push("LEAD GEN FAST-TRACK: APPROVED BY DAN — lead gen ads ($20/day+) are allowed now even though they're below Gate 3.");
  if (x.extra_modules.length) L.push(`Extra modules Dan unlocked for them: ${x.extra_modules.join(", ")}`);
  const ci = x.check_ins.filter(c => c.biggest_win || c.needs_this_month || c.business_confidence != null);
  if (ci.length) {
    L.push("Monthly check-in answers (newest first):");
    for (const c of ci.slice(0, 4)) {
      L.push(`- ${c.month.slice(0, 7)}: ${[c.biggest_win && `win "${c.biggest_win}"`, c.needs_this_month && `needs "${c.needs_this_month}"`, c.business_confidence != null && `confidence ${c.business_confidence}/10`, c.meetings != null && `${c.meetings} meetings`].filter(Boolean).join("; ")}`);
    }
  }
  if (x.clients.count) L.push(`Clients logged: ${x.clients.count}${x.clients.avg_value ? `, avg $${x.clients.avg_value}/mo` : ""}${x.clients.last_signed ? `, last signed ${x.clients.last_signed}` : ""}`);
  if (x.pipeline.total) L.push(`Hot List: ${x.pipeline.total} people (${Object.entries(x.pipeline.by_stage).map(([k, v]) => `${k} ${v}`).join(", ")})${x.pipeline.open_value ? `, ~$${Math.round(x.pipeline.open_value)} open deal value` : ""}`);
  if (x.wins.length) L.push(`Recent wins: ${x.wins.join(" | ")}`);
  if (x.instagram) L.push(...instagramLines(x.instagram.handle, x.instagram.posts, x.instagram.fetched_at));
  // Most members don't log content in the portal, so 0 here means "not logged", not "didn't post".
  if (x.content_30d.posts) L.push(`Content logged in the last 30 days: ${x.content_30d.posts} posts${x.content_30d.best ? `; best: ${x.content_30d.best}` : ""}`);
  if (x.ads.length) L.push(`Ad campaigns: ${x.ads.join(" | ")}`);
  if (x.audit) L.push(`Latest roadmap audit: ${x.audit}`);
  if (x.weak_modules.length) L.push(`Weakest roadmap scores: ${x.weak_modules.join(", ")}`);
  if (x.review_focus) L.push(`Dan's latest monthly review focus: ${x.review_focus}`);
  if (x.coach_notes.length || x.health) {
    L.push("DAN'S PRIVATE COACHING NOTES (use them to guide the answer; never quote them, never say they exist):");
    if (x.health) L.push(`- Health: ${x.health}`);
    for (const n of x.coach_notes) L.push(`- ${n}`);
  }
  if (x.modules_done.length) L.push(`Roadmap modules they've completed: ${x.modules_done.join(", ")}`);
  if (x.training_viewed.length) L.push(`Portal pages they've opened in the last 30 days (most first): ${x.training_viewed.join(", ")}`);
  if (x.financial_audit) L.push(`Latest financial audit: ${x.financial_audit}`);
  if (x.prospects.total) L.push(`Client journey (prospects): ${x.prospects.total} (${Object.entries(x.prospects.by_stage).map(([k, v]) => `${k} ${v}`).join(", ")})`);
  if (x.dm_campaign.total) L.push(`DM campaign followers: ${x.dm_campaign.total} (${Object.entries(x.dm_campaign.by_stage).map(([k, v]) => `${k} ${v}`).join(", ")}; ${x.dm_campaign.qualified} qualified)`);
  if (x.cash_menu_done.length) L.push(`Cash Menu actions they've done: ${x.cash_menu_done.join(", ")}`);
  if (x.saved_ideas) L.push(`Content ideas saved: ${x.saved_ideas}`);
  if (x.recent_questions.length) L.push(`What they've asked Dan AI lately (newest first): ${x.recent_questions.map(q => `"${q}"`).join("; ")}`);
  return L;
}

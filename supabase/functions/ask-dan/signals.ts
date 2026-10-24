/**
 * What looks off in a member's business, computed in code from their numbers,
 * build list and pipeline, most important first. Each signal names the problem
 * in plain words and what fixes it, so Dan AI can pinpoint the real issue behind
 * a question and prescribe the workshop for it.
 */
import type { Derived, MemberInput, Totals } from "./context.ts";

export type Signal = { problem: string; fix: string };

const money = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;
const mrrOf = (t: Totals) => t.mrr ?? t.mrr_manual ?? null;
const POSTS: Record<number, number> = { 1: 4, 2: 8, 3: 8, 4: 8 };
const CONVOS: Record<number, number> = { 1: 4, 2: 6 };

export function signals(m: MemberInput, d: Derived): Signal[] {
  const out: Signal[] = [];
  const t = m.totals[0];
  const gate = m.extras?.gate_number ?? null;
  const x = m.extras;

  if (d.data_freshness === "none") out.push({ problem: "no monthly numbers submitted yet", fix: "submit their Monthly Check-In so the advice can use real numbers" });
  else if (d.data_freshness === "stale") out.push({ problem: `numbers are ${d.days_since_latest} days old`, fix: "submit their latest Monthly Check-In" });

  const sentBack = x?.build.find(b => b.status === "needs_changes");
  if (sentBack) out.push({ problem: `Dan sent back "${sentBack.title}"${sentBack.review_note ? `: ${sentBack.review_note}` : ""}`, fix: "fix it with Dan's note before anything else" });

  if (t) {
    const retainers = t.active_retainers;
    if ((gate == null || gate <= 1) && retainers != null && retainers < 3) out.push({ problem: `${retainers} paying retainers, below Gate 1's 3`, fix: "sign the next paying retainer: conversations first, then content" });
    if (t.retainers_lost) out.push({ problem: `lost ${t.retainers_lost} retainer${t.retainers_lost > 1 ? "s" : ""} last month`, fix: "retention: first 90 days, proactive check-ins, 3-month reviews (Delivery Magic, Smooth Operator)" });
    if (d.mrr_trend?.startsWith("down")) out.push({ problem: `MRR ${d.mrr_trend}`, fix: "find whether it's churn or no new signings, and fix that first" });
    if (d.all_oneoff) out.push({ problem: "all revenue is one-off, nothing recurring", fix: "turn one-off clients into a retainer offer (Profit By Design)" });

    const postTarget = gate ? POSTS[gate] : null;
    if (postTarget && t.content_posts != null && t.content_posts < postTarget) out.push({ problem: `${t.content_posts} posts last month vs the Gate ${gate} bar of ${postTarget}`, fix: "post consistently on their own account: BTS and case studies (Organic Content Snowball)" });
    const convos = t.retainer_convos ?? t.leads_generated ?? null;
    const convoTarget = gate ? CONVOS[gate] : null;
    if (convoTarget && convos != null && convos < convoTarget) out.push({ problem: `${convos} conversations last month vs the Gate ${gate} bar of ${convoTarget}`, fix: "start more retainer conversations and track every one (The System)" });
    if (gate === 2 && t.case_studies_posted === 0) out.push({ problem: "no case studies posted last month (Gate II needs 4)", fix: "post case studies on their own account (Organic Content Snowball)" });

    const leads = t.ad_leads ?? (gate && gate >= 3 ? t.leads_generated : null);
    if (leads && leads >= 5 && t.booked_calls != null && t.booked_calls / leads < 0.2) out.push({ problem: `${leads} leads but only ${t.booked_calls} calls booked`, fix: "speed to lead: call every lead within 15–30 mins and follow up (The System)" });
    if (t.booked_calls && t.calls_showed != null && t.calls_showed / t.booked_calls < 0.6) out.push({ problem: `${t.calls_showed} of ${t.booked_calls} booked calls showed`, fix: "confirm and remind every booking; call fast (The System)" });
    if ((t.ad_spend ?? 0) > 0 && !t.new_clients) out.push({ problem: `${money(t.ad_spend!)} ad spend with no new clients`, fix: "track cost per lead and per client before spending more (Ad Metrics & Tracking 101)" });
    if (d.cac_vs_first_month != null && d.cac_vs_first_month >= 50) out.push({ problem: `cost per client ~${money(d.cost_per_client!)} is ${d.cac_vs_first_month}% of the first month's fee`, fix: "fix creatives and offer before scaling: 3–5 variations in the same campaign (Paid Ad Powerup)" });

    const meetings = t.meetings ?? t.booked_calls ?? null;
    if (meetings && meetings >= 3 && t.new_clients != null && t.new_clients / meetings > 0.6) out.push({ problem: `closing ${t.new_clients} of ${meetings} calls (over 60%)`, fix: "they're underpriced: raise prices on new clients first (Profit By Design)" });
    const revenue = t.total_revenue ?? mrrOf(t) ?? 0;
    if (revenue > 0 && t.expenses != null && (revenue - t.expenses) / revenue < 0.2) out.push({ problem: `margin ${Math.round(((revenue - t.expenses) / revenue) * 100)}% on ${money(revenue)}`, fix: "pricing, tiers and costs (Profit By Design)" });
    if (revenue >= 15000 && (t.expense_contractors ?? 0) === 0) out.push({ problem: `${money(revenue)}/mo and no editor costs`, fix: "past the ~$15–20k/mo editor cue: hire an editor (Editing Team Building)" });
  }

  const conf = x?.check_ins.find(c => c.business_confidence != null)?.business_confidence;
  if (conf != null && conf <= 4) out.push({ problem: `confidence ${conf}/10 at their last check-in`, fix: "start with the one next win; keep it simple" });
  if (x && x.pipeline.total >= 5) {
    const early = Object.entries(x.pipeline.by_stage).filter(([k]) => /lead|new|contact|cold|warm|dm/i.test(k)).reduce((n, [, v]) => n + v, 0);
    if (early / x.pipeline.total > 0.7) out.push({ problem: `${early} of ${x.pipeline.total} Hot List people stuck at the first stage`, fix: "follow up and book calls (The System)" });
  }
  if (x && x.content_30d.posts === 0 && !x.instagram?.posts.length && gate) out.push({ problem: "no content logged in 30 days", fix: "post on their own account this week (Organic Content Snowball)" });
  return out.slice(0, 6);
}

export function signalLines(list: Signal[]): string[] {
  if (!list.length) return [];
  return ["WHAT LOOKS OFF (computed from their data, most important first; use it to find the real problem behind the question):", ...list.map(s => `- ${s.problem} → ${s.fix}`)];
}

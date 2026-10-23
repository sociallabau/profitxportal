// Synthetic test personas (NOT real members). Dates are relative to today.
import type { MemberInput } from "./context.ts";

const daysAgo = (n: number, today: Date) => new Date(today.getTime() - n * 86400000).toISOString().slice(0, 10);
const daysAhead = (n: number, today: Date) => daysAgo(-n, today);
// monthly_totals.month is the first of a month; personas give the report date directly.
const monthsAgo = (n: number, today: Date) => {
  const d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - n, 1));
  return d.toISOString().slice(0, 10);
};

export const PERSONA_KEYS = ["P_EARLY", "P_ADS_EARLY", "P_SCALE", "P_EMPTY", "P_STALE"] as const;

export function persona(key: string, today = new Date()): MemberInput | null {
  switch (key) {
    case "P_EARLY":
      return {
        name: "Sam",
        answers: {
          business_name: "Sam Creative", location: "Brisbane", niche: "Real estate agents",
          offers_detail: "2 paying retainers at $1,500/mo. Tiers: $1,500 and $2,500.",
          biggest_blocker: "not enough conversations",
        },
        totals: [
          { month: monthsAgo(0, today), mrr: 3000, new_clients: 0, ad_spend: 0, content_posts: 3 },
          { month: monthsAgo(1, today), mrr: 3000 },
          { month: monthsAgo(2, today), mrr: 1500 },
        ],
        goal: { target_mrr: 10000, target_date: daysAhead(60, today), retainer_tier_1: 1500, retainer_tier_2: 2500 },
      };
    case "P_ADS_EARLY":
      return {
        name: "Jordan",
        answers: {
          business_name: "Peak Visuals", location: "Melbourne", niche: "Builders + real estate agents",
          offers_detail: "3 retainers at ~$2,950/mo.",
          whats_working: "Awareness ads are live and have booked shoots.",
          posting_cadence: "~6 posts a month",
          biggest_blocker: "Follow-up on leads is slow.",
        },
        totals: [{ month: daysAgo(20, today), mrr: 8850, new_clients: 1, ad_spend: 600, content_posts: 6 }],
        goal: { target_mrr: 15000, target_date: daysAhead(70, today), retainer_tier_1: 2950 },
      };
    case "P_SCALE":
      return {
        name: "Casey",
        gate: "Gate 3 — Scale",
        gate_key_task: "Build the growth hub",
        answers: {
          business_name: "Apex Trades Media", location: "Gold Coast", niche: "Trades / construction",
          offers_detail: "14 retainers. Intro offer $1,500. Tiers $2,000 and $3,500.",
          whats_working: "Lead gen $100/day + awareness $15/day.",
        },
        totals: [{ month: daysAgo(20, today), mrr: 28105, new_clients: 4, ad_spend: 1450, content_posts: 66, booked_calls: 0 }],
        goal: { target_mrr: 45000, target_date: daysAhead(80, today), retainer_tier_1: 2000, retainer_tier_2: 3500 },
      };
    case "P_EMPTY":
      return { answers: {}, totals: [], goal: null };
    case "P_STALE":
      return {
        name: "Riley T",
        answers: { business_name: "Coastline Media" },
        totals: [{ month: daysAgo(90, today), mrr: 12000, total_revenue: 2000, new_clients: 1, ad_spend: 300 }],
        goal: { target_mrr: 20000, target_date: daysAgo(60, today) },
      };
  }
  return null;
}

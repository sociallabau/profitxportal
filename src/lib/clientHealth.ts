import type { ViewRow } from '@/lib/db';

/**
 * Everything Client Health knows about judging a client: the tier labels, the
 * margin thresholds, and the two scoring functions.
 *
 * Pure functions with no JSX and no hooks, kept apart from the page so the
 * scoring can be read, reasoned about and changed without scrolling through a
 * thousand lines of markup.
 */

export type ClientOverview = ViewRow<'admin_client_overview'>;

export type HealthResult = {
  score: number;
  band: 'green' | 'amber' | 'red';
  netMargin: number;
};

/** A client with everything this page derives about them. */
export type ClientWithHealth = ClientOverview & {
  health: HealthResult;
  healthCurrent: HealthResult;
  healthNew: HealthResult;
  conclusion: string;
  readyForInFlow: boolean;
  readyForOver20k: boolean;
  monthlyRevenue: number;
};

export const TIER_OPTIONS = [
  { value: 'onboarding', label: 'Onboarding' },
  { value: 'in_flow_starter', label: 'In Flow · Under $20k/mth' },
  { value: 'in_flow_scale', label: 'In Flow · Over $20k/mth' },
] as const;

// Maps any legacy tier value to the new tier system so older rows still display correctly.
export function normalizeTier(tier?: string | null) {
  if (!tier) return 'onboarding';
  if (tier === 'onramp' || tier === 'on-ramp') return 'onboarding';
  if (tier === 'growth') return 'in_flow_starter';
  if (tier === 'scale' || tier === 'starter') return 'in_flow_scale';
  return tier;
}

export function formatTierLabel(tier?: string | null) {
  return TIER_OPTIONS.find((option) => option.value === normalizeTier(tier))?.label ?? 'Onboarding';
}


// On-ramp module IDs — must match Roadmap.tsx
export const ON_RAMP_MODULE_IDS = [
  'design-retainer-offer', 'client-onboarding',
  'optimise-profile', 'stupidly-simple-ad', 'warm-outreach',
  'discovery-call', 'follow-up-system',
];

// Margin thresholds (net profit margin %)
// >= TARGET_MARGIN  => On Track (green)
// >= MIN_MARGIN     => Good (amber)
// <  MIN_MARGIN     => Needs Help (red)
export const TARGET_MARGIN = 30;
export const MIN_MARGIN = 20;

// Low-score thresholds for survey alerts (out of 10)
export const LOW_CONFIDENCE = 4;
export const LOW_NPS = 6;

export function getMarginBand(netMargin: number): 'green' | 'amber' | 'red' {
  if (netMargin >= TARGET_MARGIN) return 'green';
  if (netMargin >= MIN_MARGIN) return 'amber';
  return 'red';
}

/**
 * Scoring built around the numbers Dan judges a business on: revenue, net
 * margin, leads, cost to acquire a client, and conversion. Margin carries the
 * most weight of any single component — a business that turns over plenty and
 * keeps none of it is not a healthy business.
 *
 * Lead scoring is deliberately not tied to a fixed weekly target. What matters
 * is that leads arrive consistently; the right number depends entirely on
 * their stage and price point.
 *
 * The old scoring banded purely on margin, so the score itself never moved a
 * client between red, amber and green. Here the band comes from the score.
 */
export function calcHealthScoreV2(client: ClientOverview) {
  const revenue    = Number(client.last_total_revenue || 0);
  const expenses   = Number(client.last_expenses || 0);
  const netMargin  = revenue > 0 ? ((revenue - expenses) / revenue) * 100 : -1;
  const leads      = Number(client.last_leads || 0);
  const newClients = Number(client.last_new_clients || 0);
  const adSpend    = Number(client.last_ad_spend || 0);
  const clientValue = Number(client.last_new_clients_value || 0);
  const content    = Number(client.last_content_posts || 0);

  // Revenue (max 20)
  let revenueScore = 0;
  if (revenue >= 30000) revenueScore = 20;
  else if (revenue >= 15000) revenueScore = 15;
  else if (revenue >= 5000) revenueScore = 10;
  else if (revenue > 0) revenueScore = 5;

  // Leads (max 15) — is anything coming in the top, at any scale
  let leadsScore = 0;
  if (leads >= 20) leadsScore = 15;
  else if (leads >= 10) leadsScore = 12;
  else if (leads >= 5) leadsScore = 8;
  else if (leads >= 1) leadsScore = 4;

  // Conversion, leads to signed clients (max 15)
  const conversion = leads > 0 ? (newClients / leads) * 100 : -1;
  let conversionScore = 0;
  if (conversion >= 20) conversionScore = 15;
  else if (conversion >= 10) conversionScore = 11;
  else if (conversion >= 5) conversionScore = 7;
  else if (conversion > 0) conversionScore = 3;

  // Cost to acquire against what a client is worth (max 15)
  const cac = newClients > 0 ? adSpend / newClients : -1;
  const valuePerClient = newClients > 0 ? clientValue / newClients : 0;
  let cacScore = 0;
  if (newClients > 0 && adSpend === 0) cacScore = 15;          // won without paying for it
  else if (cac >= 0 && valuePerClient > 0) {
    const ratio = cac / valuePerClient;
    if (ratio <= 0.25) cacScore = 15;
    else if (ratio <= 0.5) cacScore = 11;
    else if (ratio <= 1) cacScore = 5;
  } else if (adSpend > 0 && newClients === 0) cacScore = 0;    // spending, winning nobody
  else if (newClients > 0) cacScore = 8;                       // won clients, value unknown

  // Margin (max 25) — the heaviest single component. Profit is the point.
  let marginScore = 0;
  if (netMargin >= TARGET_MARGIN) marginScore = 25;
  else if (netMargin >= MIN_MARGIN) marginScore = 18;
  else if (netMargin >= 10) marginScore = 9;
  else if (netMargin >= 0) marginScore = 3;

  // Content, the leading indicator for leads (max 10)
  let contentScore = 0;
  if (content >= 12) contentScore = 10;
  else if (content >= 8) contentScore = 7;
  else if (content >= 4) contentScore = 4;
  else if (content >= 1) contentScore = 2;

  const score = revenueScore + leadsScore + conversionScore + cacScore + marginScore + contentScore;

  let band: 'green' | 'amber' | 'red';
  if (revenue <= 0) band = 'red';
  else if (score >= 70) band = 'green';
  else if (score >= 45) band = 'amber';
  else band = 'red';

  return {
    score, band,
    netMargin: revenue > 0 ? netMargin : 0,
    leads, newClients, conversion, cac, valuePerClient,
    revenueScore, leadsScore, conversionScore, cacScore, marginScore, contentScore,
  };
}

export function calcHealthScore(client: ClientOverview) {
  // Margin-based scoring across 4 pillars: revenue, margin %, content posted, new clients
  const revenue   = Number(client.last_total_revenue || 0);
  const expenses  = Number(client.last_expenses || 0);
  const netMargin = revenue > 0 ? ((revenue - expenses) / revenue) * 100 : -1;
  const content   = Number(client.last_content_posts || 0);
  const newClients = Number(client.last_new_clients || 0);

  // Revenue (max 25)
  let revenueScore = 0;
  if (revenue >= 30000) revenueScore = 25;
  else if (revenue >= 15000) revenueScore = 18;
  else if (revenue >= 5000) revenueScore = 12;
  else if (revenue > 0) revenueScore = 6;

  // Margin (max 35) — primary driver
  let marginScore = 0;
  if (netMargin >= TARGET_MARGIN) marginScore = 35;
  else if (netMargin >= MIN_MARGIN) marginScore = 22;
  else if (netMargin >= 10) marginScore = 12;
  else if (netMargin >= 0) marginScore = 5;

  // Content posted (max 20)
  let contentScore = 0;
  if (content >= 12) contentScore = 20;
  else if (content >= 8) contentScore = 14;
  else if (content >= 4) contentScore = 8;
  else if (content >= 1) contentScore = 3;

  // New clients (max 20)
  let clientsScore = 0;
  if (newClients >= 3) clientsScore = 20;
  else if (newClients >= 2) clientsScore = 14;
  else if (newClients >= 1) clientsScore = 8;

  const score = revenueScore + marginScore + contentScore + clientsScore;

  // Overall band is driven by the margin band, refined by score for edge cases
  const marginBand = getMarginBand(netMargin);
  let band: 'green' | 'amber' | 'red' = marginBand;
  // If they have no revenue at all, force red
  if (revenue <= 0) band = 'red';

  return {
    score,
    band,
    netMargin: revenue > 0 ? netMargin : 0,
    revenueScore,
    marginScore,
    contentScore,
    clientsScore,
  };
}

export function generateConclusion(client: ClientOverview) {
  const name = client.full_name?.split(' ')[0] || 'This client';
  const parts: string[] = [];
  const revenue   = Number(client.last_total_revenue || 0);
  const expenses  = Number(client.last_expenses || 0);
  const netMargin = revenue > 0 ? ((revenue - expenses) / revenue) * 100 : 0;
  const newClients = Number(client.last_new_clients || 0);
  const content    = Number(client.last_content_posts || 0);
  const daysSub    = Number(client.days_since_submission ?? 999);

  if (revenue <= 0) parts.push(`no revenue submitted yet`);
  else if (netMargin >= TARGET_MARGIN) parts.push(`margin ${netMargin.toFixed(0)}% — above target`);
  else if (netMargin >= MIN_MARGIN) parts.push(`margin ${netMargin.toFixed(0)}% — within range`);
  else parts.push(`margin ${netMargin.toFixed(0)}% — below ${MIN_MARGIN}%, needs help`);

  if (newClients >= 2) parts.push(`signed ${newClients} new clients`);
  else if (newClients === 0 && content >= 8) parts.push(`posting content but not converting`);
  else if (newClients === 0) parts.push(`no new clients this month`);

  if (content === 0) parts.push(`no content posted`);
  else if (content >= 12) parts.push(`${content} posts — strong output`);

  if (daysSub > 45) parts.push(`monthly submission overdue (${daysSub} days)`);

  return `${name}: ${parts.join('; ')}.`;
}

export const BAND = {
  green: { bg: 'bg-green-500/10', border: 'border-green-500/30', text: 'text-green-400', dot: 'bg-green-400', label: 'On Track' },
  amber: { bg: 'bg-yellow-500/10', border: 'border-yellow-500/30', text: 'text-yellow-400', dot: 'bg-yellow-400', label: 'Good' },
  red:   { bg: 'bg-red-500/10', border: 'border-red-500/30', text: 'text-red-400', dot: 'bg-red-400', label: 'Needs Help' },
};

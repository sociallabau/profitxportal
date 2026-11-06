import type { ViewRow } from '@/lib/db';
import type { GateHealth } from '@/lib/gateHealth';
import type { Attention, ContactInfo, MomentumResult, Momentum, QuarterlyInfo, DanRead } from '@/lib/clientCare';

/**
 * Tier labels, margin thresholds and the shape of a client on the Client Health
 * page. How a client is judged (momentum, contact, quarterly calls) lives in
 * clientCare.ts.
 */

export type ClientOverview = ViewRow<'admin_client_overview'>;

/** Everything the page works out about one client, on top of their overview row. */
export type ClientWithHealth = ClientOverview & {
  /** What the numbers say. */
  momentum: MomentumResult;
  /** What's shown: Dan's own read if he's set one, otherwise momentum. */
  status: Momentum;
  /** True when `status` is Dan's call rather than the numbers'. */
  overridden: boolean;
  danRead: DanRead | null;
  danReadNote: string | null;
  contact: ContactInfo;
  quarterly: QuarterlyInfo;
  touchEveryDays: number;
  attention: Attention;
  joinedAt: string | null;
  /** Where they stand in the gate system: build list, approvals, gate bars. */
  gh: GateHealth;
  monthlyRevenue: number;
  /** Revenue per check-in, newest first. */
  revenueSeries: number[];
  /** profiles.gate — '1' | '2' | '3' | null. */
  gate?: string | null;
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


// Margin thresholds (net profit margin %), used to colour the margin line in a client's financials.
// >= TARGET_MARGIN  => above target
// >= MIN_MARGIN     => in range
// <  MIN_MARGIN     => below target
export const TARGET_MARGIN = 30;
export const MIN_MARGIN = 20;

export function getMarginBand(netMargin: number): 'green' | 'amber' | 'red' {
  if (netMargin >= TARGET_MARGIN) return 'green';
  if (netMargin >= MIN_MARGIN) return 'amber';
  return 'red';
}

export const MARGIN_STYLE = {
  green: { bg: 'bg-green-500/10', border: 'border-green-500/30', text: 'text-success' },
  amber: { bg: 'bg-yellow-500/10', border: 'border-yellow-500/30', text: 'text-amber-600' },
  red:   { bg: 'bg-red-500/10', border: 'border-red-500/30', text: 'text-destructive' },
} as const;

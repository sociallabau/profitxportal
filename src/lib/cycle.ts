/**
 * The three-month cycle the portal runs on, keyed off the calendar month:
 * December reflects, January builds, February implements, then it repeats.
 *
 * Global and calendar-based on purpose — every member reflects in the same month,
 * so the review can be run as one group session. A member's quarterly call with
 * Dan is a separate clock, anchored to when they joined, so a call can land in any
 * month of the cycle.
 *
 * Pure functions, no hooks, so the rhythm can be tested and changed in one place.
 */

export type CycleMode = 'reflect' | 'build' | 'implement';

/** month % 3 — Dec/Mar/Jun/Sep reflect, Jan/Apr/Jul/Oct build, Feb/May/Aug/Nov implement. */
const MODE_BY_REMAINDER: Record<number, CycleMode> = { 0: 'reflect', 1: 'build', 2: 'implement' };

/** Months back to this cycle's reflect month. */
const SINCE_REFLECT: Record<CycleMode, 0 | 1 | 2> = { reflect: 0, build: 1, implement: 2 };

export const CYCLE_MODES: Record<CycleMode, { label: string; blurb: string }> = {
  reflect: { label: 'Reflect', blurb: 'Reflect on how the implementation went. Set direction for the next quarter.' },
  build: { label: 'Build', blurb: 'Learn or improve the core components of a ProfitX Business.' },
  implement: { label: 'Implement', blurb: 'Implement the components into your business. Take massive action.' },
};

export type Cycle = {
  mode: CycleMode;
  /** 'YYYY-MM' of this cycle's reflect month. The same key for all three of its months. */
  key: string;
  /** 'YYYY-MM' of the month just gone: the numbers this month's check-in is for. */
  previousMonth: string;
};

const ym = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

export function cycleOf(date = new Date()): Cycle {
  const mode = MODE_BY_REMAINDER[(date.getMonth() + 1) % 3];
  return {
    mode,
    key: ym(new Date(date.getFullYear(), date.getMonth() - SINCE_REFLECT[mode], 1)),
    previousMonth: ym(new Date(date.getFullYear(), date.getMonth() - 1, 1)),
  };
}

/**
 * The cycle before this one — the three months the reflection actually looks back on.
 * Reflect comes first in a cycle, not last: in December you are opening the Dec–Feb
 * cycle, and what there is to reflect on is Sep–Nov, the build and implement months
 * that just ran. The two projects picked in that review are for the cycle now starting.
 */
export function cycleBefore(cycle: Cycle): Cycle {
  const [y, m] = cycle.key.split('-').map(Number);
  return cycleOf(new Date(y, m - 1 - 3, 1));
}

export type CycleStepKey = 'numbers' | 'review';

export const CYCLE_STEPS: Record<CycleStepKey, { label: string; href: string }> = {
  numbers: { label: "Submit last month's numbers", href: '/submissions/monthly' },
  review: { label: 'Review the cycle and pick your two projects', href: '/cycle' },
};

/** Every month wants the numbers in. A reflect month also wants the review done. */
export function cycleSteps(mode: CycleMode): CycleStepKey[] {
  return mode === 'reflect' ? ['numbers', 'review'] : ['numbers'];
}

// ---------- what happened in the cycle ----------

/** The cycle's three months, oldest first: its reflect month and the two that follow. */
export function cycleMonths(cycle: Cycle): string[] {
  const [y, m] = cycle.key.split('-').map(Number);
  return [0, 1, 2].map(i => ym(new Date(y, m - 1 + i, 1)));
}

/** A check-in, as much of it as the review needs. Nulls mean "not asked", not zero. */
export type CycleTotals = {
  month: string;
  total_revenue?: number | null;
  expenses?: number | null;
  active_retainers?: number | null;
  retainers_lost?: number | null;
  new_clients?: number | null;
  content_posts?: number | null;
  retainer_convos?: number | null;
  business_confidence?: number | null;
};

export type CycleReview = {
  /** The cycle's three months, oldest first. */
  monthKeys: string[];
  /** How many of the three they actually submitted. The rest of this is only as good as this number. */
  submitted: number;
  /** Revenue across the cycle, and the change from its first submitted month to its last. */
  revenue: { total: number; changePct: number | null };
  profit: { total: number; marginPct: number | null };
  /** Retainers at the end of the cycle, plus what moved during it. */
  retainers: { end: number | null; lost: number; signed: number };
  output: { posts: number; convos: number };
  confidence: { first: number | null; last: number | null };
};

const sum = (rows: CycleTotals[], key: keyof CycleTotals) =>
  rows.reduce((n, r) => n + (Number(r[key]) || 0), 0);

/**
 * The cycle in numbers, from the member's own check-ins. Everything here is computed rather
 * than asked: a reflection should show them what happened and only ask what the data can't know.
 */
export function reviewCycle(cycle: Cycle, totals: CycleTotals[]): CycleReview {
  const monthKeys = cycleMonths(cycle);
  // Oldest first, and only the months belonging to this cycle.
  const rows = monthKeys
    .map(key => totals.find(t => String(t.month).slice(0, 7) === key))
    .filter((r): r is CycleTotals => !!r);
  const revenue = sum(rows, 'total_revenue');
  const expenses = sum(rows, 'expenses');
  const withRevenue = rows.filter(r => Number(r.total_revenue) > 0);
  const [firstRev, lastRev] = [withRevenue[0], withRevenue.at(-1)];
  const scored = rows.filter(r => r.business_confidence != null);
  const end = [...rows].reverse().find(r => r.active_retainers != null)?.active_retainers;
  return {
    monthKeys,
    submitted: rows.length,
    revenue: {
      total: revenue,
      changePct: firstRev && lastRev && firstRev !== lastRev && Number(firstRev.total_revenue) > 0
        ? Math.round(((Number(lastRev.total_revenue) - Number(firstRev.total_revenue)) / Number(firstRev.total_revenue)) * 100)
        : null,
    },
    profit: { total: revenue - expenses, marginPct: revenue > 0 ? Math.round(((revenue - expenses) / revenue) * 100) : null },
    retainers: { end: end ?? null, lost: sum(rows, 'retainers_lost'), signed: sum(rows, 'new_clients') },
    output: { posts: sum(rows, 'content_posts'), convos: sum(rows, 'retainer_convos') },
    confidence: { first: scored[0]?.business_confidence ?? null, last: scored.at(-1)?.business_confidence ?? null },
  };
}

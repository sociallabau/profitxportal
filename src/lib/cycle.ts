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

export type CycleStepKey = 'numbers' | 'review';

export const CYCLE_STEPS: Record<CycleStepKey, { label: string; href: string }> = {
  numbers: { label: "Submit last month's numbers", href: '/submissions/monthly' },
  review: { label: 'Review the cycle and pick your two projects', href: '/roadmap' },
};

/** Every month wants the numbers in. A reflect month also wants the review done. */
export function cycleSteps(mode: CycleMode): CycleStepKey[] {
  return mode === 'reflect' ? ['numbers', 'review'] : ['numbers'];
}

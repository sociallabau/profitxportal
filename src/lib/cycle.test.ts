import { describe, expect, it } from 'vitest';
import { cycleBefore, cycleMonths, cycleOf, cycleSteps, reviewCycle, type CycleTotals } from './cycle';

const at = (year: number, month: number, day = 15) => new Date(year, month - 1, day);

describe('cycleOf', () => {
  it('December reflects, January builds, February implements', () => {
    expect(cycleOf(at(2026, 12)).mode).toBe('reflect');
    expect(cycleOf(at(2027, 1)).mode).toBe('build');
    expect(cycleOf(at(2027, 2)).mode).toBe('implement');
  });
  it('then it repeats, all year', () => {
    const modes = Array.from({ length: 12 }, (_, i) => cycleOf(at(2027, i + 1)).mode);
    expect(modes).toEqual([
      'build', 'implement', 'reflect', // Jan, Feb, Mar
      'build', 'implement', 'reflect', // Apr, May, Jun
      'build', 'implement', 'reflect', // Jul, Aug, Sep
      'build', 'implement', 'reflect', // Oct, Nov, Dec
    ]);
  });
  it('all three months of a cycle share the reflect month as their key', () => {
    expect(cycleOf(at(2026, 12)).key).toBe('2026-12');
    expect(cycleOf(at(2027, 1)).key).toBe('2026-12');
    expect(cycleOf(at(2027, 2)).key).toBe('2026-12');
    // The next cycle starts in March.
    expect(cycleOf(at(2027, 3)).key).toBe('2027-03');
  });
  it('points at the month just gone, across a year boundary', () => {
    expect(cycleOf(at(2027, 1)).previousMonth).toBe('2026-12');
    expect(cycleOf(at(2026, 12)).previousMonth).toBe('2026-11');
  });
});

describe('cycleSteps', () => {
  it('a reflect month asks for the numbers and the review', () => {
    expect(cycleSteps('reflect')).toEqual(['numbers', 'review']);
  });
  it('the other months just want the numbers in', () => {
    expect(cycleSteps('build')).toEqual(['numbers']);
    expect(cycleSteps('implement')).toEqual(['numbers']);
  });
});

describe('cycleMonths', () => {
  it('is the reflect month and the two that follow, across a year boundary', () => {
    expect(cycleMonths(cycleOf(at(2027, 1)))).toEqual(['2026-12', '2027-01', '2027-02']);
    expect(cycleMonths(cycleOf(at(2027, 6)))).toEqual(['2027-06', '2027-07', '2027-08']);
  });
});

describe('cycleBefore', () => {
  it('steps back a whole cycle, across a year boundary', () => {
    expect(cycleBefore(cycleOf(at(2026, 12))).key).toBe('2026-09');
    expect(cycleBefore(cycleOf(at(2027, 1))).key).toBe('2026-09');
  });
  it('is the three months the December reflection looks back on', () => {
    expect(cycleMonths(cycleBefore(cycleOf(at(2026, 12))))).toEqual(['2026-09', '2026-10', '2026-11']);
  });
  it('stays on the reflect-month grid when stepped back repeatedly', () => {
    let c = cycleOf(at(2027, 5)); // an implement month, cycle key 2027-03
    for (let i = 0; i < 4; i++) c = cycleBefore(c);
    expect(c.mode).toBe('reflect');
    expect(c.key).toBe('2026-03');
  });
});

describe('reviewCycle', () => {
  const cycle = cycleOf(at(2027, 2)); // the Dec-Feb cycle
  const month = (month: string, over: Partial<CycleTotals> = {}): CycleTotals => ({
    month: `${month}-01`, total_revenue: 10000, expenses: 4000, active_retainers: 3,
    retainers_lost: 0, new_clients: 1, content_posts: 8, retainer_convos: 6, business_confidence: 7, ...over,
  });

  it('adds up the cycle and reads the trend from first to last submitted month', () => {
    const r = reviewCycle(cycle, [
      month('2026-12'),
      month('2027-01', { total_revenue: 12000 }),
      month('2027-02', { total_revenue: 15000, active_retainers: 5, new_clients: 2 }),
    ]);
    expect(r.submitted).toBe(3);
    expect(r.revenue.total).toBe(37000);
    expect(r.revenue.changePct).toBe(50); // 10k -> 15k
    expect(r.profit.total).toBe(25000);
    expect(r.profit.marginPct).toBe(68);
    expect(r.retainers).toEqual({ end: 5, lost: 0, signed: 4 });
    expect(r.output).toEqual({ posts: 24, convos: 18 });
  });

  it('ignores months outside the cycle', () => {
    const r = reviewCycle(cycle, [month('2026-12'), month('2027-03', { total_revenue: 99000 })]);
    expect(r.submitted).toBe(1);
    expect(r.revenue.total).toBe(10000);
  });

  it('handles a cycle with nothing submitted', () => {
    const r = reviewCycle(cycle, []);
    expect(r.submitted).toBe(0);
    expect(r.revenue).toEqual({ total: 0, changePct: null });
    expect(r.profit.marginPct).toBeNull();
    expect(r.retainers.end).toBeNull();
    expect(r.confidence).toEqual({ first: null, last: null });
  });

  it('needs two months with revenue before it claims a trend', () => {
    expect(reviewCycle(cycle, [month('2026-12')]).revenue.changePct).toBeNull();
  });

  it('reads confidence from the months that scored it, oldest to newest', () => {
    const r = reviewCycle(cycle, [
      month('2026-12', { business_confidence: 4 }),
      month('2027-01', { business_confidence: null }),
      month('2027-02', { business_confidence: 8 }),
    ]);
    expect(r.confidence).toEqual({ first: 4, last: 8 });
  });
});

import { describe, expect, it } from 'vitest';
import { isExampleDashboard, EXAMPLE_REVENUE, buildExampleCalls } from './dashboardExample';

const at = (year: number, month: number, day: number) => new Date(Date.UTC(year, month - 1, day, 0, 0, 0));

describe('dashboard screenshot examples', () => {
  it('shows examples only for the owner account', () => {
    expect(isExampleDashboard('63419807-10a6-4cfc-a8ec-a99052ea981b')).toBe(true);
    expect(isExampleDashboard('1948d8b5-member')).toBe(false);
    expect(isExampleDashboard()).toBe(false);
  });

  it('example revenue climbs each month from $0 to $15k', () => {
    expect(EXAMPLE_REVENUE).toHaveLength(12);
    expect(EXAMPLE_REVENUE[0].revenue).toBe(0);
    expect(EXAMPLE_REVENUE.at(-1)?.revenue).toBe(15000);
    expect(EXAMPLE_REVENUE.every((point, index) => index === 0 || point.revenue > EXAMPLE_REVENUE[index - 1].revenue)).toBe(true);
  });
});

describe('buildExampleCalls', () => {
  const dow = (dateKey: string) => {
    const [y, m, d] = dateKey.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  };
  const addDaysKey = (dateKey: string, days: number) => {
    const [y, m, d] = dateKey.split('-').map(Number);
    const next = new Date(Date.UTC(y, m - 1, d + days));
    return `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, '0')}-${String(next.getUTCDate()).padStart(2, '0')}`;
  };
  const key = (c: { start: string }) => c.start.slice(0, 10);
  /** The nearest Tuesday on or after `from`, found rather than memorised, so the test never relies on me knowing a date's weekday by heart. */
  const aTuesday = (from: Date) => { const d = new Date(from); while (d.getUTCDay() !== 2) d.setUTCDate(d.getUTCDate() + 1); return d; };

  it('always opens with a Tuesday Momentum Call, whatever day it is run', () => {
    for (let d = 1; d <= 28; d++) {
      expect(dow(key(buildExampleCalls(at(2027, 3, d))[0]))).toBe(2);
    }
  });

  it('is strictly in the future, even when run on a Tuesday itself', () => {
    const now = aTuesday(at(2027, 3, 1));
    const todayKey = key({ start: now.toISOString() });
    expect(key(buildExampleCalls(now)[0]) > todayKey).toBe(true);
  });

  it('rolls the whole schedule forward a week when run a week later — stays fresh instead of going stale', () => {
    const week1 = buildExampleCalls(at(2027, 3, 4));
    const week2 = buildExampleCalls(at(2027, 3, 11));
    expect(addDaysKey(key(week1[0]), 7)).toBe(key(week2[0]));
  });

  it('spaces the three Momentum Calls a week apart, with the named workshop the day after the first', () => {
    const calls = buildExampleCalls(at(2027, 3, 4));
    const momentum = calls.filter(c => c.title === 'Momentum Call™');
    const workshop = calls.find(c => c.title === 'Christmas Comes Early™')!;
    expect(momentum).toHaveLength(3);
    expect(addDaysKey(key(momentum[0]), 7)).toBe(key(momentum[1]));
    expect(addDaysKey(key(momentum[0]), 14)).toBe(key(momentum[2]));
    expect(addDaysKey(key(momentum[0]), 1)).toBe(key(workshop));
  });
});

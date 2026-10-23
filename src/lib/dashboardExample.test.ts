import { describe, expect, it } from 'vitest';
import { isExampleDashboard, EXAMPLE_REVENUE } from './dashboardExample';

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

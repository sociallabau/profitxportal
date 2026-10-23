import { describe, expect, it } from 'vitest';
import { isExampleDashboard } from './dashboardExample';

describe('dashboard screenshot examples', () => {
  it('shows examples only for the owner account', () => {
    expect(isExampleDashboard('63419807-10a6-4cfc-a8ec-a99052ea981b')).toBe(true);
    expect(isExampleDashboard('1948d8b5-member')).toBe(false);
    expect(isExampleDashboard()).toBe(false);
  });
});
import { describe, it, expect } from 'vitest';
import { revenuePosition, submissionStreak } from './dashboardProgress';

describe('revenue ladder', () => {
  it('places revenue at its level and interpolates between levels', () => {
    expect(revenuePosition(20000)).toBe(25);
    expect(revenuePosition(25000)).toBe(31.25);
    expect(revenuePosition(150000)).toBe(100);
    expect(revenuePosition(-1)).toBe(0);
  });
});
describe('monthly submission streak', () => {
  it('counts consecutive months, not submissions, including backdated reports', () => {
    expect(submissionStreak(['2026-08-31', '2026-09-30', '2026-09-01'], '2026-10-23')).toEqual({ streak: 2, longest: 2 });
  });
  it('resets when the previous month was missed and preserves longest run', () => {
    expect(submissionStreak(['2026-06-30', '2026-07-31'], '2026-10-23')).toEqual({ streak: 0, longest: 2 });
  });
});
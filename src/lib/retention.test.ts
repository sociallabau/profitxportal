import { describe, it, expect } from 'vitest';
import {
  monthlyChurnTrend,
  activeChurnedCounts,
  memberLtv,
  cac,
  ltvCacBand,
  renewalRate,
  type MemberRow,
} from './retention';

const NOW = new Date('2026-10-23T00:00:00Z');

const members: MemberRow[] = [
  { id: 'a', created_at: '2026-04-10T00:00:00Z', archived_at: null },                    // active
  { id: 'b', created_at: '2026-05-02T00:00:00Z', archived_at: '2026-09-15T00:00:00Z' },  // churned Sep
  { id: 'c', created_at: '2026-09-05T00:00:00Z', archived_at: null },                    // joined Sep
  { id: 'd', created_at: '2026-10-01T00:00:00Z', archived_at: null },                    // joined Oct
];

describe('monthlyChurnTrend', () => {
  const trend = monthlyChurnTrend(members, 6, NOW);
  const sep = trend.find(p => p.key === '2026-09')!;
  const oct = trend.find(p => p.key === '2026-10')!;

  it('counts churn where archived_at falls in the month', () => {
    expect(sep.churned).toBe(1);
    expect(oct.churned).toBe(0);
  });

  it('counts active members at the start of the month', () => {
    expect(sep.activeStart).toBe(2); // a + b
    expect(oct.activeStart).toBe(2); // a + c
  });

  it('computes churn rate as churned ÷ active at start', () => {
    expect(sep.churnRate).toBe(0.5);
    expect(oct.churnRate).toBe(0);
  });

  it('counts new members per month', () => {
    expect(sep.newMembers).toBe(1);
    expect(oct.newMembers).toBe(1);
  });
});

describe('activeChurnedCounts', () => {
  it('splits on archived_at', () => {
    expect(activeChurnedCounts(members)).toEqual({ active: 3, churned: 1 });
  });
});

describe('memberLtv', () => {
  it('is ARPU ÷ monthly churn rate', () => {
    expect(memberLtv(2000, 0.05)).toBe(40000);
  });

  it('is null when churn is zero or unknown', () => {
    expect(memberLtv(2000, 0)).toBeNull();
    expect(memberLtv(2000, null)).toBeNull();
    expect(memberLtv(0, 0.05)).toBeNull();
  });
});

describe('cac', () => {
  it('is spend ÷ new members', () => {
    expect(cac(3000, 3)).toBe(1000);
  });

  it('is null without spend or new members', () => {
    expect(cac(0, 3)).toBeNull();
    expect(cac(3000, 0)).toBeNull();
  });
});

describe('ltvCacBand', () => {
  it('bands at ≥3 green, 1–3 amber, <1 red', () => {
    expect(ltvCacBand(3)).toBe('green');
    expect(ltvCacBand(2.5)).toBe('amber');
    expect(ltvCacBand(0.8)).toBe('red');
    expect(ltvCacBand(null)).toBeNull();
  });
});

describe('renewalRate', () => {
  it('counts anniversaries in the period and who stayed', () => {
    const start = new Date('2026-09-01T00:00:00Z');
    const end = new Date('2026-10-01T00:00:00Z');
    const r = renewalRate(members, start, end);
    // Sep anniversaries: a (10 Sep), b (2 Sep — left 15 Sep, after anniversary → renewed).
    // c joined 5 Sep, so their first renewal is October, not September.
    expect(r.due).toBe(2);
    expect(r.renewed).toBe(2);
  });

  it('marks a member as not renewed when archived before the anniversary', () => {
    const start = new Date('2026-10-01T00:00:00Z');
    const end = new Date('2026-11-01T00:00:00Z');
    const r = renewalRate([
      { id: 'x', created_at: '2026-05-20T00:00:00Z', archived_at: '2026-10-10T00:00:00Z' },
    ], start, end);
    expect(r.due).toBe(1);
    expect(r.renewed).toBe(0);
    expect(r.rate).toBe(0);
  });
});

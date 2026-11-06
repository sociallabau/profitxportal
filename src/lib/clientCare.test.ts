import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import {
  attention, computeMomentum, effectiveStatus, lastContact, quarterly, touchEveryDays,
  type MomentumInput, type Touchpoint,
} from './clientCare';

const now = new Date('2026-11-06T00:00:00Z');
const ago = (days: number) => new Date(now.getTime() - days * 86400000).toISOString();
const touch = (kind: string, days: number): Touchpoint => ({ kind, occurred_at: ago(days) });

const base: MomentumInput = {
  revenueSeries: [11000],
  confidenceSeries: [7, 7],
  daysSinceCheckin: 10,
  daysSinceJoined: 200,
};

describe('computeMomentum', () => {
  it('Tobias: growing and checking in reads as rolling', () => {
    const r = computeMomentum({ ...base, revenueSeries: [19600, 14350, 11000] });
    expect(r.status).toBe('rolling');
  });

  it('Harry: someone who just joined is new, never bad', () => {
    const r = computeMomentum({ revenueSeries: [], confidenceSeries: [], daysSinceCheckin: null, daysSinceJoined: 12 });
    expect(r.status).toBe('new');
    expect(r.reasons[0]).toBe('Joined 12 days ago');
  });

  it('not logging into the portal is not a negative on its own', () => {
    // There is no login input at all: a client on WhatsApp with healthy numbers is fine.
    const r = computeMomentum({ ...base, revenueSeries: [8000, 7900, 7000] });
    expect(['rolling', 'steady']).toContain(r.status);
  });

  it('a client who has not checked in is quiet, not needs-help', () => {
    const r = computeMomentum({ ...base, revenueSeries: [9000, 8500], daysSinceCheckin: 80 });
    expect(r.status).toBe('quiet');
    expect(r.reasons).toEqual(['No check-in for 80 days']);
  });

  it('a client who never checked in (and is not new) is quiet', () => {
    const r = computeMomentum({ revenueSeries: [], confidenceSeries: [], daysSinceCheckin: null, daysSinceJoined: 120 });
    expect(r.status).toBe('quiet');
  });

  it('one real negative is watch', () => {
    const r = computeMomentum({ ...base, revenueSeries: [6000, 8000] });
    expect(r.status).toBe('watch');
    expect(r.reasons).toEqual(['Revenue down 25%']);
  });

  it('two negatives is needs help', () => {
    const r = computeMomentum({ ...base, revenueSeries: [6000, 8000], confidenceSeries: [3, 6] });
    expect(r.status).toBe('needs_help');
  });

  it('revenue falling to zero is flagged', () => {
    const r = computeMomentum({ ...base, revenueSeries: [0, 5000] });
    expect(r.reasons).toContain('Revenue fell to $0');
  });

  it('flat for three months is a watch, but flat for two is not', () => {
    expect(computeMomentum({ ...base, revenueSeries: [10000, 10100, 9900] }).status).toBe('watch');
    expect(computeMomentum({ ...base, revenueSeries: [10000, 10100] }).status).toBe('steady');
  });

  it('flags a confidence drop of 2+', () => {
    const r = computeMomentum({ ...base, confidenceSeries: [5, 8] });
    expect(r.reasons).toEqual(['Confidence dropped 8→5']);
  });
});

describe('retainer and profit warning signs', () => {
  it('flags retainers lost this month', () => {
    const r = computeMomentum({ ...base, revenueSeries: [10000, 10000], retainersLostSeries: [2, 0] });
    expect(r.status).toBe('watch');
    expect(r.reasons).toEqual(['Lost 2 retainers']);
  });
  it('flags a falling retainer count even when no loss was reported', () => {
    const r = computeMomentum({ ...base, revenueSeries: [10000, 10000], activeRetainersSeries: [3, 4] });
    expect(r.reasons).toEqual(['Retainers down 4→3']);
  });
  it('flags spending more than they earn', () => {
    const r = computeMomentum({ ...base, revenueSeries: [6000, 5800], expensesSeries: [6500, 3000] });
    expect(r.reasons).toEqual(['Spending more than they earn']);
  });
  it('two of these together needs help', () => {
    const r = computeMomentum({ ...base, revenueSeries: [6000, 5800], retainersLostSeries: [1], expensesSeries: [6500] });
    expect(r.status).toBe('needs_help');
  });
  it('stays quiet when retainers and profit are fine', () => {
    const r = computeMomentum({ ...base, revenueSeries: [9000, 8000], retainersLostSeries: [0], activeRetainersSeries: [4, 3], expensesSeries: [4000] });
    expect(r.status).toBe('rolling');
  });
});

describe('Dan\'s read', () => {
  it('beats the automatic status', () => {
    const auto = computeMomentum({ ...base, revenueSeries: [6000, 8000] });
    expect(effectiveStatus(auto, 'good')).toEqual({ status: 'rolling', overridden: true });
  });
  it('falls back to the numbers when unset', () => {
    const auto = computeMomentum({ ...base, revenueSeries: [6000, 8000] });
    expect(effectiveStatus(auto, null)).toEqual({ status: 'watch', overridden: false });
  });
});

describe('lastContact', () => {
  it('finds the most recent touch of any kind', () => {
    const c = lastContact([touch('whatsapp', 20), touch('group_call', 3), touch('call', 50)], now);
    expect(c.days).toBe(3);
    expect(c.kind).toBe('group_call');
  });
  it('is null when nothing is logged', () => {
    expect(lastContact([], now)).toEqual({ at: null, days: null, kind: null });
  });
});

describe('quarterly', () => {
  it('counts 90 days from the last quarterly call', () => {
    const q = quarterly([touch('quarterly_call', 60)], ago(400), now);
    expect(q.state).toBe('ok');
    expect(q.daysUntil).toBe(30);
  });
  it('is due soon inside 14 days', () => {
    const q = quarterly([touch('quarterly_call', 80)], ago(400), now);
    expect(q.state).toBe('soon');
    expect(q.daysUntil).toBe(10);
  });
  it('is overdue once the 90 days have passed', () => {
    const q = quarterly([touch('quarterly_call', 100)], ago(400), now);
    expect(q.state).toBe('overdue');
    expect(q.daysUntil).toBe(-10);
  });
  it('ignores other contact: only a quarterly call resets the clock', () => {
    const q = quarterly([touch('whatsapp', 2), touch('quarterly_call', 100)], ago(400), now);
    expect(q.state).toBe('overdue');
  });
  it('starts the first clock at join date', () => {
    const q = quarterly([], ago(20), now);
    expect(q.state).toBe('new');
    expect(q.daysUntil).toBe(70);
  });
  it('flags long-standing clients with no quarterly call ever logged', () => {
    const q = quarterly([], ago(300), now);
    expect(q.state).toBe('overdue');
    expect(q.neverLogged).toBe(true);
  });
});

describe('attention: who to talk to next', () => {
  const rolling = { status: 'rolling' as const, touchEveryDays: 30, isNew: false };
  const okQuarter = quarterly([touch('quarterly_call', 20)], ago(400), now);

  it('has nothing to say about a client who is rolling and recently spoken to', () => {
    expect(attention({ ...rolling, contact: lastContact([touch('whatsapp', 5)], now), quarterly: okQuarter })).toEqual({ priority: 0, reasons: [] });
  });

  it('Lachlan: weekly WhatsApp keeps him off the list even if he never logs in', () => {
    const a = attention({ ...rolling, contact: lastContact([touch('whatsapp', 6)], now), quarterly: okQuarter });
    expect(a.priority).toBe(0);
  });

  it('Marc: small revenue, no calls, nobody checking in, so he surfaces', () => {
    const a = attention({
      status: 'quiet', touchEveryDays: 30, isNew: false,
      contact: lastContact([touch('whatsapp', 75)], now),
      quarterly: quarterly([touch('quarterly_call', 100)], ago(400), now),
    });
    expect(a.reasons).toEqual(['Quarterly call overdue 10d', 'Last spoke 75d ago']);
    expect(a.priority).toBeGreaterThan(100);
  });

  it('Jake: good but inactive surfaces only because nobody has spoken to him', () => {
    const a = attention({ ...rolling, contact: lastContact([touch('whatsapp', 45)], now), quarterly: okQuarter });
    expect(a.reasons).toEqual(['Last spoke 45d ago']);
  });

  it('respects a per-client cadence', () => {
    const contact = lastContact([touch('whatsapp', 45)], now);
    expect(attention({ ...rolling, touchEveryDays: 60, contact, quarterly: okQuarter }).priority).toBe(0);
  });

  it('Harry: a new client is not flagged, but is checked on sooner than the usual cadence', () => {
    const joined = ago(10);
    const q = quarterly([], joined, now);
    const fresh = attention({ status: 'new', touchEveryDays: 30, isNew: true, contact: lastContact([touch('call', 5)], now), quarterly: q });
    expect(fresh.priority).toBe(0);
    const lapsed = attention({ status: 'new', touchEveryDays: 30, isNew: true, contact: lastContact([touch('call', 20)], now), quarterly: q });
    expect(lapsed.reasons).toEqual(['Last spoke 20d ago']);
  });

  it('puts needs-help ahead of everything else', () => {
    const help = attention({ ...rolling, status: 'needs_help', contact: lastContact([touch('whatsapp', 2)], now), quarterly: okQuarter });
    const overdue = attention({ ...rolling, contact: lastContact([touch('whatsapp', 40)], now), quarterly: okQuarter });
    expect(help.priority).toBeGreaterThan(overdue.priority);
  });
});

describe('touchEveryDays', () => {
  it('uses the explicit setting first', () => expect(touchEveryDays(21, 'Weekly')).toBe(21));
  it('falls back to what the client asked for in their Context Room', () => {
    expect(touchEveryDays(null, 'Weekly')).toBe(10);
    expect(touchEveryDays(null, 'Fortnightly')).toBe(18);
    expect(touchEveryDays(null, 'Monthly')).toBe(35);
    expect(touchEveryDays(null, 'Only when I reach out')).toBe(60);
  });
  it('defaults to 30 days', () => expect(touchEveryDays(null, undefined)).toBe(30));
});

describe('shared copy', () => {
  it('keeps the edge-function copy identical, so the Monday digest judges clients the same way as the page', () => {
    const page = readFileSync('src/lib/clientCare.ts', 'utf8');
    const functions = readFileSync('supabase/functions/_shared/clientCare.ts', 'utf8');
    expect(functions).toBe(page);
  });
});

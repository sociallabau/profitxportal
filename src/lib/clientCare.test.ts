import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import {
  assessClient, attention, computeMomentum, effectiveStatus, lastContact, lastReply, quarterly,
  spreadQuarterly, touchEveryDays, type AttentionInput, type MomentumInput, type Touchpoint,
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
    expect(computeMomentum({ ...base, revenueSeries: [19600, 14350, 11000] }).status).toBe('rolling');
  });

  it('Harry: someone who just joined is new, never bad', () => {
    const r = computeMomentum({ revenueSeries: [], confidenceSeries: [], daysSinceCheckin: null, daysSinceJoined: 12 });
    expect(r.status).toBe('new');
    expect(r.reasons[0]).toBe('Joined 12 days ago');
  });

  it('not logging into the portal is not a negative on its own', () => {
    const r = computeMomentum({ ...base, revenueSeries: [8000, 7900, 7000] });
    expect(['rolling', 'steady']).toContain(r.status);
  });

  it('a client who has not checked in is quiet, not needs-help', () => {
    const r = computeMomentum({ ...base, revenueSeries: [9000, 8500], daysSinceCheckin: 80 });
    expect(r.status).toBe('quiet');
    expect(r.reasons).toEqual(['No check-in for 80 days']);
  });

  it('a client who never checked in (and is not new) is quiet', () => {
    expect(computeMomentum({ revenueSeries: [], confidenceSeries: [], daysSinceCheckin: null, daysSinceJoined: 120 }).status).toBe('quiet');
  });

  it('one real negative is watch', () => {
    const r = computeMomentum({ ...base, revenueSeries: [6000, 8000] });
    expect(r.status).toBe('watch');
    expect(r.reasons).toEqual(['Revenue down 25%']);
  });

  it('two negatives is needs help', () => {
    expect(computeMomentum({ ...base, revenueSeries: [6000, 8000], confidenceSeries: [3, 6] }).status).toBe('needs_help');
  });

  it('revenue falling to zero is flagged', () => {
    expect(computeMomentum({ ...base, revenueSeries: [0, 5000] }).reasons).toContain('Revenue fell to $0');
  });

  it('flat for three months is a watch, but flat for two is not', () => {
    expect(computeMomentum({ ...base, revenueSeries: [10000, 10100, 9900] }).status).toBe('watch');
    expect(computeMomentum({ ...base, revenueSeries: [10000, 10100] }).status).toBe('steady');
  });

  it('flags a confidence drop of 2+', () => {
    expect(computeMomentum({ ...base, confidenceSeries: [5, 8] }).reasons).toEqual(['Confidence dropped 8→5']);
  });
});

describe('retainer, profit and satisfaction warning signs', () => {
  it('flags retainers lost this month', () => {
    const r = computeMomentum({ ...base, revenueSeries: [10000, 10000], retainersLostSeries: [2, 0] });
    expect(r.status).toBe('watch');
    expect(r.reasons).toEqual(['Lost 2 retainers']);
  });
  it('flags a falling retainer count even when no loss was reported', () => {
    expect(computeMomentum({ ...base, revenueSeries: [10000, 10000], activeRetainersSeries: [3, 4] }).reasons).toEqual(['Retainers down 4→3']);
  });
  it('flags spending more than they earn', () => {
    expect(computeMomentum({ ...base, revenueSeries: [6000, 5800], expensesSeries: [6500, 3000] }).reasons).toEqual(['Spending more than they earn']);
  });
  it('flags a clearly bad satisfaction score from a current check-in', () => {
    const r = computeMomentum({ ...base, revenueSeries: [9000, 8000], npsSeries: [3] });
    expect(r.status).toBe('watch');
    expect(r.reasons).toEqual(['Satisfaction 3/10']);
  });
  it('ignores a 5: that is where the slider starts, so it says nothing', () => {
    const r = computeMomentum({ ...base, revenueSeries: [9000, 8000], npsSeries: [5] });
    expect(r.status).toBe('rolling');
  });
  it('ignores a low satisfaction score on a stale check-in', () => {
    const r = computeMomentum({ ...base, revenueSeries: [9000, 8000], npsSeries: [3], daysSinceCheckin: 90 });
    expect(r.status).toBe('quiet');
  });
  it('two of these together needs help', () => {
    const r = computeMomentum({ ...base, revenueSeries: [6000, 5800], retainersLostSeries: [1], expensesSeries: [6500] });
    expect(r.status).toBe('needs_help');
  });
  it('stays quiet about retainers and profit when they are fine', () => {
    const r = computeMomentum({ ...base, revenueSeries: [9000, 8000], retainersLostSeries: [0], activeRetainersSeries: [4, 3], expensesSeries: [4000], npsSeries: [9] });
    expect(r.status).toBe('rolling');
  });
});

describe("Dan's read", () => {
  it('beats the automatic status', () => {
    const auto = computeMomentum({ ...base, revenueSeries: [6000, 8000] });
    expect(effectiveStatus(auto, 'good')).toEqual({ status: 'rolling', overridden: true });
  });
  it('falls back to the numbers when unset', () => {
    const auto = computeMomentum({ ...base, revenueSeries: [6000, 8000] });
    expect(effectiveStatus(auto, null)).toEqual({ status: 'watch', overridden: false });
  });
});

describe('lastContact and lastReply', () => {
  it('finds the most recent touch from the team, of any kind', () => {
    const c = lastContact([touch('whatsapp', 20), touch('group_call', 3), touch('call', 50)], now);
    expect(c.days).toBe(3);
    expect(c.kind).toBe('group_call');
  });
  it('does not count what the client sent us as contact from the team', () => {
    expect(lastContact([touch('client_message', 1), touch('whatsapp', 9)], now).days).toBe(9);
  });
  it('is null when nothing is logged', () => {
    expect(lastContact([], now)).toEqual({ at: null, days: null, kind: null });
  });
  it('tracks when they last messaged us, separately', () => {
    expect(lastReply([touch('whatsapp', 1), touch('client_message', 22), touch('client_message', 30)], now).days).toBe(22);
  });
  it('treats no reply data as unknown, not silence', () => {
    expect(lastReply([touch('whatsapp', 1)], now)).toEqual({ at: null, days: null });
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
    expect(quarterly([touch('whatsapp', 2), touch('quarterly_call', 100)], ago(400), now).state).toBe('overdue');
  });
  it('starts the first clock at join date', () => {
    const q = quarterly([], ago(20), now);
    expect(q.state).toBe('new');
    expect(q.daysUntil).toBe(70);
  });
  it('treats a long-standing client with no quarterly call ever logged as not planned, not overdue', () => {
    const q = quarterly([], ago(300), now);
    expect(q.state).toBe('unscheduled');
    expect(q.neverLogged).toBe(true);
  });
  it('a planned date that has passed is genuinely overdue', () => {
    const q = quarterly([], ago(300), now, '2026-11-01');
    expect(q.state).toBe('overdue');
    expect(q.neverLogged).toBe(false);
  });
  it('uses a planned date when there is no quarterly call yet', () => {
    const q = quarterly([], ago(300), now, '2026-11-25');
    expect(q.state).toBe('ok');
    expect(q.daysUntil).toBe(19);
    expect(q.planned).toBe(true);
    expect(q.neverLogged).toBe(false);
  });
  it('lets a planned date inside 14 days read as due soon', () => {
    expect(quarterly([], ago(300), now, '2026-11-12').state).toBe('soon');
  });
  it('ignores a planned date that is older than the last call (the clock restarted)', () => {
    const q = quarterly([touch('quarterly_call', 5)], ago(300), now, '2026-09-01');
    expect(q.planned).toBe(false);
    expect(q.daysUntil).toBe(85);
  });
});

describe('attention: who to talk to next', () => {
  const okQuarter = quarterly([touch('quarterly_call', 20)], ago(400), now);
  const rolling: AttentionInput = {
    status: 'rolling', touchEveryDays: 30, isNew: false, quarterly: okQuarter,
    contact: lastContact([touch('whatsapp', 5)], now), daysSinceCheckin: 10, daysSinceLogin: 3,
  };

  it('says nothing about a client who is doing well and recently spoken to', () => {
    expect(attention(rolling)).toEqual({ priority: 0, reasons: [], bucket: 'good', drifting: false, numbersOnly: false, nextContact: null });
  });

  it('Lachlan: chatting weekly and replying, but never logs in, so he is fine', () => {
    const a = attention({ ...rolling, daysSinceLogin: null, reply: lastReply([touch('client_message', 2)], now) });
    expect(a.bucket).toBe('good');
  });

  it('Marc: no calls, nobody checking in, so he surfaces under Reach out', () => {
    const a = attention({
      ...rolling, status: 'quiet', daysSinceCheckin: 80,
      contact: lastContact([touch('whatsapp', 75)], now),
      quarterly: quarterly([touch('quarterly_call', 100)], ago(400), now),
    });
    expect(a.reasons).toEqual(['Last spoke 75d ago', 'No numbers for 80d', 'Quarterly call overdue 10d']);
    expect(a.bucket).toBe('reach');
  });

  it('Jake: good but inactive surfaces only because nobody has spoken to him', () => {
    const a = attention({ ...rolling, status: 'rolling', contact: lastContact([touch('whatsapp', 45)], now) });
    expect(a.reasons).toEqual(['Last spoke 45d ago']);
    expect(a.bucket).toBe('reach');
  });

  it('chasing missing numbers is an action even when you chat every day', () => {
    const a = attention({ ...rolling, status: 'quiet', daysSinceCheckin: 137, contact: lastContact([touch('whatsapp', 0)], now) });
    expect(a.reasons).toEqual(['No numbers for 137d']);
    expect(a.bucket).toBe('reach');
  });

  it('a client who never submitted is told "No numbers yet"', () => {
    const a = attention({ ...rolling, status: 'quiet', daysSinceCheckin: null });
    expect(a.reasons).toContain('No numbers yet');
  });

  it('Ethan: you messaged, he has not answered in 2 weeks, so he drifts', () => {
    const a = attention({
      ...rolling, status: 'quiet', daysSinceCheckin: 134,
      contact: lastContact([touch('whatsapp', 1)], now), reply: lastReply([touch('client_message', 21)], now),
    });
    expect(a.drifting).toBe(true);
    expect(a.bucket).toBe('act');
    expect(a.reasons).toContain("Hasn't replied in 21d");
  });

  it('silence alone is not drifting if the numbers and logins are fine', () => {
    const a = attention({ ...rolling, daysSinceLogin: 3, contact: lastContact([touch('whatsapp', 1)], now), reply: lastReply([touch('client_message', 20)], now) });
    expect(a.drifting).toBe(false);
    expect(a.bucket).toBe('reach');
  });

  it('mutual silence is "reach out", not drifting: nobody messaged them either', () => {
    const a = attention({ ...rolling, contact: lastContact([touch('whatsapp', 40)], now), reply: lastReply([touch('client_message', 20)], now), daysSinceCheckin: 200 });
    expect(a.drifting).toBe(false);
    expect(a.bucket).toBe('reach');
  });

  it('does not guess when reply data is missing', () => {
    expect(attention({ ...rolling, daysSinceLogin: null }).bucket).toBe('good');
  });

  it('Harry: a new client is not flagged, but is checked on sooner than the usual cadence', () => {
    const q = quarterly([], ago(10), now);
    const fresh = attention({ status: 'new', touchEveryDays: 30, isNew: true, contact: lastContact([touch('call', 5)], now), quarterly: q });
    expect(fresh).toEqual({ priority: 0, reasons: [], bucket: 'new', drifting: false, numbersOnly: false, nextContact: null });
    const lapsed = attention({ status: 'new', touchEveryDays: 30, isNew: true, contact: lastContact([touch('call', 20)], now), quarterly: q });
    expect(lapsed.reasons).toEqual(['Last spoke 20d ago']);
    expect(lapsed.bucket).toBe('reach');
  });

  it('new clients are not chased for numbers they have not been asked for yet', () => {
    const a = attention({ status: 'new', touchEveryDays: 30, isNew: true, contact: lastContact([touch('call', 2)], now), quarterly: quarterly([], ago(10), now), daysSinceCheckin: null });
    expect(a.reasons).toEqual([]);
  });

  it('needs help goes to Act now, ahead of everything else, with the real reasons', () => {
    const help = attention({ ...rolling, status: 'needs_help', statusReasons: ['Revenue down 25%', 'Lost 1 retainer'] });
    const overdue = attention({ ...rolling, contact: lastContact([touch('whatsapp', 40)], now) });
    expect(help.bucket).toBe('act');
    expect(help.reasons).toEqual(['Revenue down 25%', 'Lost 1 retainer']);
    expect(help.priority).toBeGreaterThan(overdue.priority);
  });

  it('puts a quarterly call that is due into the Quarterly bucket when nothing else is wrong', () => {
    const a = attention({ ...rolling, quarterly: quarterly([touch('quarterly_call', 80)], ago(400), now) });
    expect(a.bucket).toBe('quarterly');
    expect(a.reasons).toEqual(['Quarterly call in 10d']);
  });

  it('does not nag about a quarterly call that was never planned', () => {
    const a = attention({ ...rolling, quarterly: quarterly([], ago(300), now) });
    expect(a).toEqual({ priority: 0, reasons: [], bucket: 'good', drifting: false, numbersOnly: false, nextContact: null });
  });

  it('numbers-only: spoke today, replying, but no numbers for months is a nudge, not a call', () => {
    const a = attention({ ...rolling, status: 'quiet', daysSinceCheckin: 196, contact: lastContact([touch('whatsapp', 0)], now) });
    expect(a.bucket).toBe('reach');
    expect(a.numbersOnly).toBe(true);
  });

  it('not numbers-only when you have not spoken to them either', () => {
    const a = attention({ ...rolling, status: 'quiet', daysSinceCheckin: 196, contact: lastContact([touch('whatsapp', 60)], now) });
    expect(a.numbersOnly).toBe(false);
  });

  it('not numbers-only when something else is wrong', () => {
    const a = attention({ ...rolling, status: 'watch', statusReasons: ['Revenue down 25%'], daysSinceCheckin: 196 });
    expect(a.numbersOnly).toBe(false);
  });

  it('respects a per-client cadence', () => {
    expect(attention({ ...rolling, touchEveryDays: 60, contact: lastContact([touch('whatsapp', 45)], now) }).bucket).toBe('good');
  });

  it('a booked call softens the overdue-contact nag, with nothing else wrong', () => {
    const booked = { at: new Date('2026-11-10T08:15:00Z'), kind: 'call', note: null };
    const a = attention({ ...rolling, contact: lastContact([touch('whatsapp', 45)], now), nextContact: booked });
    expect(a.reasons).toEqual([]);
    expect(a.bucket).toBe('good');
    expect(a.nextContact).toEqual(booked);
  });

  it('a booked call does not cover for bad numbers or going silent on messages', () => {
    const booked = { at: new Date('2026-11-10T08:15:00Z'), kind: 'call', note: null };
    const needsHelp = attention({ ...rolling, status: 'needs_help', statusReasons: ['Revenue down 25%'], nextContact: booked });
    expect(needsHelp.bucket).toBe('act');
    expect(needsHelp.reasons).toEqual(['Revenue down 25%']);
    const drifting = attention({
      ...rolling, status: 'quiet', daysSinceCheckin: 134,
      contact: lastContact([touch('whatsapp', 1)], now), reply: lastReply([touch('client_message', 21)], now), nextContact: booked,
    });
    expect(drifting.drifting).toBe(true);
    expect(drifting.bucket).toBe('act');
  });
});

describe('assessClient', () => {
  const month = (revenue: number) => ({ revenue, confidence: 7, nps: null, retainersLost: null, activeRetainers: null, expenses: null });

  it('puts it all together: a healthy, spoken-to client is good', () => {
    const a = assessClient({
      joinedAt: ago(300), months: [month(12000), month(10000)], daysSinceCheckin: 8, daysSinceLogin: 2,
      touchpoints: [touch('whatsapp', 3), touch('client_message', 2), touch('quarterly_call', 30)],
    }, now);
    expect(a.status).toBe('rolling');
    expect(a.attention.bucket).toBe('good');
  });

  it("explains Dan's read in the reasons", () => {
    const a = assessClient({
      joinedAt: ago(300), months: [month(6000), month(8000)], daysSinceCheckin: 8, daysSinceLogin: 2,
      touchpoints: [touch('whatsapp', 3), touch('quarterly_call', 30)], danRead: 'needs_help', danReadNote: 'lost his main client',
    }, now);
    expect(a.overridden).toBe(true);
    expect(a.attention.bucket).toBe('act');
    expect(a.attention.reasons[0]).toBe('Your read: needs help (lost his main client)');
  });

  it('uses the Context Room cadence when none is set', () => {
    const a = assessClient({
      joinedAt: ago(300), months: [month(9000), month(9000)], daysSinceCheckin: 8, daysSinceLogin: 2,
      touchpoints: [touch('whatsapp', 12), touch('quarterly_call', 30)], contextCadence: 'Weekly',
    }, now);
    expect(a.touchEveryDays).toBe(10);
    expect(a.attention.reasons).toEqual(['Last spoke 12d ago']);
  });

  it('a call booked for the future softens the overdue-contact nag', () => {
    const a = assessClient({
      joinedAt: ago(300), months: [month(9000), month(9000)], daysSinceCheckin: 8, daysSinceLogin: 2,
      touchpoints: [touch('whatsapp', 45)],
      nextContactAt: '2026-11-11T08:15:00Z', nextContactKind: 'call', nextContactNote: 'Tuesday catch-up',
    }, now);
    expect(a.attention.reasons).toEqual([]);
    expect(a.attention.bucket).toBe('good');
    expect(a.attention.nextContact).toEqual({ at: new Date('2026-11-11T08:15:00Z'), kind: 'call', note: 'Tuesday catch-up' });
  });

  it('ignores a booked call once its time has passed', () => {
    const a = assessClient({
      joinedAt: ago(300), months: [month(9000), month(9000)], daysSinceCheckin: 8, daysSinceLogin: 2,
      touchpoints: [touch('whatsapp', 45)],
      nextContactAt: ago(1),
    }, now);
    expect(a.attention.nextContact).toBeNull();
    expect(a.attention.reasons).toEqual(['Last spoke 45d ago']);
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

describe('spreadQuarterly', () => {
  const today = new Date('2026-11-06T09:00:00'); // a Friday
  const items = Array.from({ length: 22 }, (_, i) => ({ id: `c${String(i).padStart(2, '0')}`, priority: 100 - i, contactDays: i }));

  it('gives everyone a date, the most urgent first, none on a weekend', () => {
    const out = spreadQuarterly(items, today);
    expect(out).toHaveLength(22);
    expect(out[0].id).toBe('c00');
    const dates = out.map(o => o.dueOn);
    expect([...dates].sort()).toEqual(dates);
    for (const d of dates) expect([0, 6]).not.toContain(new Date(`${d}T12:00:00`).getDay());
  });

  it('keeps every first call inside the next 90 days', () => {
    const last = spreadQuarterly(items, today).at(-1)!.dueOn;
    const days = (new Date(`${last}T12:00:00`).getTime() - today.getTime()) / 86400000;
    expect(days).toBeGreaterThan(60);
    expect(days).toBeLessThan(90);
  });

  it('breaks priority ties by who has gone longest without contact', () => {
    const out = spreadQuarterly([
      { id: 'a', priority: 50, contactDays: 3 }, { id: 'b', priority: 50, contactDays: 30 },
    ], today);
    expect(out.map(o => o.id)).toEqual(['b', 'a']);
  });

  it('handles an empty list', () => expect(spreadQuarterly([], today)).toEqual([]));
});

describe('shared copy', () => {
  it('keeps the edge-function copy identical, so the Monday digest judges clients the same way as the page', () => {
    const page = readFileSync('src/lib/clientCare.ts', 'utf8');
    const functions = readFileSync('supabase/functions/_shared/clientCare.ts', 'utf8');
    expect(functions).toBe(page);
  });
});

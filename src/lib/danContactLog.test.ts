import { describe, expect, it } from 'vitest';
import { resolveClient, resolveKind, resolveContactLog, standsInForQuarterly, type ContactLogDraft, type Roster } from '../../supabase/functions/ask-dan/contactLog';
import type { QuarterlyState } from '../../supabase/functions/_shared/clientCare';

const roster: Roster = [{ id: 'h1', name: 'Harry Smith' }, { id: 'h2', name: 'Harry Jones' }, { id: 'z1', name: 'Zac Brown' }];
const now = new Date('2026-11-07T00:00:00Z');
const draft = (over: Partial<ContactLogDraft>): ContactLogDraft => ({ client_name: null, scheduled_at: null, kind: null, note: null, understood: true, ...over });

describe('resolveClient', () => {
  it('matches the full name case- and whitespace-insensitively', () => {
    expect(resolveClient('harry   smith', roster)).toEqual({ id: 'h1', name: 'Harry Smith' });
  });
  it('matches by first name only when that is unique', () => {
    expect(resolveClient('Zac', roster)).toEqual({ id: 'z1', name: 'Zac Brown' });
  });
  it('never guesses between two people sharing a first name', () => {
    expect(resolveClient('Harry', roster)).toBeNull();
  });
  it('is null for no match or empty input', () => {
    expect(resolveClient('Someone Else', roster)).toBeNull();
    expect(resolveClient(null, roster)).toBeNull();
    expect(resolveClient('  ', roster)).toBeNull();
  });
});

describe('resolveClient — educated guesses', () => {
  const withHarrison: Roster = [{ id: 'ht', name: 'Harrison Tzortzis' }, { id: 'h1', name: 'Harry Smith' }, { id: 'z1', name: 'Zac Brown' }];

  it('matches a nickname plus a surname initial, even when they are not exact-name matches', () => {
    expect(resolveClient('Harry T', withHarrison)).toEqual({ id: 'ht', name: 'Harrison Tzortzis' });
  });
  it('still matches a real first name plus a surname initial', () => {
    expect(resolveClient('Harry S', withHarrison)).toEqual({ id: 'h1', name: 'Harry Smith' });
  });
  it('matches a bare nickname when it is unique in the roster', () => {
    const roster: Roster = [{ id: 'ht', name: 'Harrison Tzortzis' }, { id: 'z1', name: 'Zac Brown' }];
    expect(resolveClient('Harry', roster)).toEqual({ id: 'ht', name: 'Harrison Tzortzis' });
  });
  it('still refuses a bare nickname once it is ambiguous, nicknames included', () => {
    // Harry Smith is literally a Harry; Harrison Tzortzis counts as one too via the nickname —
    // widening who "Harry" could mean must never make a guess safer to make.
    expect(resolveClient('Harry', withHarrison)).toBeNull();
  });
  it('still refuses a surname initial that matches more than one person', () => {
    const roster: Roster = [{ id: 'ht', name: 'Harrison Tzortzis' }, { id: 'h2', name: 'Harry Thompson' }];
    expect(resolveClient('Harry T', roster)).toBeNull();
  });
  it('is unaffected by a name with no nickname entry', () => {
    expect(resolveClient('Zac B', withHarrison)).toEqual({ id: 'z1', name: 'Zac Brown' });
    expect(resolveClient('Zac X', withHarrison)).toBeNull();
  });
});

describe('resolveKind', () => {
  it('passes through a known kind', () => expect(resolveKind('whatsapp')).toBe('whatsapp'));
  it('defaults to call for anything unrecognised', () => {
    expect(resolveKind('zoom')).toBe('call');
    expect(resolveKind(null)).toBe('call');
    expect(resolveKind(undefined)).toBe('call');
  });
});

describe('standsInForQuarterly', () => {
  const states: QuarterlyState[] = ['new', 'ok', 'soon', 'overdue', 'unscheduled'];

  it('fills a real gap: overdue or never scheduled, for a real 1:1 contact', () => {
    expect(standsInForQuarterly('call', 'overdue')).toBe(true);
    expect(standsInForQuarterly('call', 'unscheduled')).toBe(true);
    expect(standsInForQuarterly('quarterly_call', 'overdue')).toBe(true);
    expect(standsInForQuarterly('other', 'unscheduled')).toBe(true);
  });

  it('never overwrites an existing plan, even one that is coming up soon', () => {
    expect(standsInForQuarterly('call', 'soon')).toBe(false);
    expect(standsInForQuarterly('call', 'ok')).toBe(false);
    expect(standsInForQuarterly('call', 'new')).toBe(false);
  });

  it('never counts a WhatsApp message or a group call, whatever the quarterly state', () => {
    for (const state of states) {
      expect(standsInForQuarterly('whatsapp', state)).toBe(false);
      expect(standsInForQuarterly('group_call', state)).toBe(false);
    }
  });
});

describe('resolveContactLog', () => {
  it('bails out when the model did not recognise a contact-logging instruction', () => {
    expect(resolveContactLog(draft({ understood: false }), roster, now)).toEqual({ ok: false, reason: 'not_understood' });
  });
  it('bails out rather than guess when the client cannot be resolved', () => {
    expect(resolveContactLog(draft({ client_name: 'Harry', scheduled_at: '2026-11-10T08:15:00Z' }), roster, now))
      .toEqual({ ok: false, reason: 'client_not_found' });
  });
  it('bails out on a missing or unparseable date', () => {
    expect(resolveContactLog(draft({ client_name: 'Zac Brown' }), roster, now)).toEqual({ ok: false, reason: 'bad_date' });
    expect(resolveContactLog(draft({ client_name: 'Zac Brown', scheduled_at: 'not a date' }), roster, now)).toEqual({ ok: false, reason: 'bad_date' });
  });
  it('bails out on a date implausibly far from now', () => {
    expect(resolveContactLog(draft({ client_name: 'Zac Brown', scheduled_at: '2030-01-01T00:00:00Z' }), roster, now)).toEqual({ ok: false, reason: 'bad_date' });
  });
  it('resolves a future booking', () => {
    const r = resolveContactLog(draft({ client_name: 'Zac Brown', scheduled_at: '2026-11-10T08:15:00Z', kind: 'call', note: 'Catch-up' }), roster, now);
    expect(r).toEqual({ ok: true, client: { id: 'z1', name: 'Zac Brown' }, at: new Date('2026-11-10T08:15:00Z'), when: 'future', kind: 'call', note: 'Catch-up' });
  });
  it('recomputes past vs future from the date itself, not the model', () => {
    const r = resolveContactLog(draft({ client_name: 'Zac Brown', scheduled_at: '2026-11-06T09:00:00Z' }), roster, now);
    expect(r).toMatchObject({ ok: true, when: 'past' });
  });
  it('uses the preselected client without needing a name in the text', () => {
    const r = resolveContactLog(draft({ scheduled_at: '2026-11-10T08:15:00Z' }), roster, now, { id: 'h1', name: 'Harry Smith' });
    expect(r).toMatchObject({ ok: true, client: { id: 'h1', name: 'Harry Smith' } });
  });
  it('defaults an unrecognised kind to call and drops a blank note', () => {
    const r = resolveContactLog(draft({ client_name: 'Zac Brown', scheduled_at: '2026-11-10T08:15:00Z', kind: 'zoom', note: '   ' }), roster, now);
    expect(r).toMatchObject({ ok: true, kind: 'call', note: null });
  });
});

import { describe, expect, it } from 'vitest';
import { derive, buildMemberBlock, extrasLines, type MemberInput } from '../../supabase/functions/ask-dan/context';
import type { MemberExtras } from '../../supabase/functions/ask-dan/dossier';

const daysAgo = (n: number, today: Date) => new Date(today.getTime() - n * 86400000).toISOString();

const baseMember: MemberInput = { answers: {}, totals: [], goal: null };

const emptyExtras: MemberExtras = {
  gate_number: null, fast_track_lead_gen: false, extra_modules: [], build: [], check_ins: [],
  clients: { count: 0, last_signed: null, avg_value: null },
  pipeline: { total: 0, by_stage: {}, open_value: 0 },
  wins: [], content_30d: { posts: 0, best: null }, ads: [], audit: null, cycle: null, weak_modules: [],
  review_focus: null, coach_notes: [], health: null, recent_questions: [], memory: null, instagram: null,
  journey: { joined: null, starting_mrr: null, first_month: null, first_mrr: null },
  modules_done: [], training_viewed: [], financial_audit: null,
  prospects: { total: 0, by_stage: {} }, dm_campaign: { total: 0, by_stage: {}, qualified: 0 },
  cash_menu_done: [], saved_ideas: 0,
};

describe('stale Context Room sections', () => {
  const today = new Date('2026-11-06T00:00:00Z');

  it('flags a filled section whose timestamp is over 90 days old', () => {
    const m: MemberInput = {
      ...baseMember,
      answers: { niche: 'Real estate agents in Brisbane' },
      contextTimestamps: { customer: daysAgo(120, today) },
    };
    expect(derive(m, today).stale_context_sections).toContain('Your customer');
  });

  it('does not flag a section updated within 90 days', () => {
    const m: MemberInput = {
      ...baseMember,
      answers: { niche: 'Real estate agents in Brisbane' },
      contextTimestamps: { customer: daysAgo(10, today) },
    };
    expect(derive(m, today).stale_context_sections).not.toContain('Your customer');
  });

  it('does not flag an untouched section that has nothing filled in', () => {
    const m: MemberInput = { ...baseMember, answers: {}, contextTimestamps: { customer: daysAgo(400, today) } };
    expect(derive(m, today).stale_context_sections).toEqual([]);
  });

  it('surfaces the stale-section line in the member block text', () => {
    const m: MemberInput = {
      ...baseMember,
      answers: { niche: 'Real estate agents in Brisbane' },
      contextTimestamps: { customer: daysAgo(120, today) },
    };
    const { text } = buildMemberBlock(m, today);
    expect(text).toMatch(/Context Room sections untouched for 90\+ days/);
    expect(text).toContain('Your customer');
  });
});

describe('monthly check-in inclusion', () => {
  it('still includes a check-in whose only filled field is meetings or nps', () => {
    const extras: MemberExtras = {
      ...emptyExtras,
      check_ins: [{ month: '2026-10-01', biggest_win: null, needs_this_month: null, business_confidence: null, nps: null, meetings: 4 }],
    };
    const lines = extrasLines(extras);
    expect(lines.some(l => l.startsWith('Monthly check-in answers'))).toBe(true);
    expect(lines.some(l => l.includes('4 meetings'))).toBe(true);
  });

  it('still drops a check-in with nothing at all filled in', () => {
    const extras: MemberExtras = {
      ...emptyExtras,
      check_ins: [{ month: '2026-10-01', biggest_win: null, needs_this_month: null, business_confidence: null, nps: null, meetings: null }],
    };
    const lines = extrasLines(extras);
    expect(lines.some(l => l.startsWith('Monthly check-in answers'))).toBe(false);
  });
});

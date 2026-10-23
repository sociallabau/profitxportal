import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { buildContextMarkdown, contextCompleteness, contextSections, sectionAge } from './contextRoom';

describe('Context Room rules', () => {
  it('excludes the personal support disclosure from AI exports', () => {
    const markdown = buildContextMarkdown({ business_name: 'Video Studio', anything_else: 'PRIVATE_DISCLOSURE', preferred_channel: 'WhatsApp' });
    expect(markdown).toContain('Video Studio');
    expect(markdown).toContain('WhatsApp');
    expect(markdown).not.toContain('PRIVATE_DISCLOSURE');
  });
  it('exports only recognised member fields, never private coach notes', () => {
    const markdown = buildContextMarkdown({ customer_problem: 'Needs consistent video', coach_notes: 'PRIVATE_COACH_NOTE', risk_rating: 'PRIVATE_RISK' });
    expect(markdown).toContain('Needs consistent video');
    expect(markdown).not.toContain('PRIVATE_COACH_NOTE');
    expect(markdown).not.toContain('PRIVATE_RISK');
  });
  it('marks a section due a refresh only after 90 days', () => {
    const saved = '2026-01-01T00:00:00Z';
    const start = Date.parse(saved);
    expect(sectionAge(saved, start + 90 * 86400000).needsRefresh).toBe(false);
    expect(sectionAge(saved, start + 91 * 86400000).needsRefresh).toBe(true);
  });
  it('counts seven complete sections without requiring optional disclosures', () => {
    const answers = Object.fromEntries(contextSections.flatMap(s => s.fields.filter(f => !f.optional).map(f => [f.key, f.type === 'multi' ? ['Instagram'] : '0'])));
    expect(contextCompleteness(answers)).toMatchObject({ percentage: 100, sections: 7 });
    expect(contextCompleteness({})).toMatchObject({ percentage: 0, sections: 0 });
  });
  it('uses reported MRR zero instead of falling back to another value', () => {
    expect(buildContextMarkdown({}, { mrr_manual: 0, mrr: 5000, month: '2026-09-01' })).toContain('**Latest MRR:** $0');
  });
  it('keeps the frontend and edge context builders identical', () => {
    expect(readFileSync('supabase/functions/_shared/contextRoom.ts', 'utf8')).toBe(readFileSync('src/lib/contextRoom.ts', 'utf8'));
  });
});
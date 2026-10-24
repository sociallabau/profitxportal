import { describe, expect, it } from 'vitest';
import { checkerResult, relevantExcerpt } from '../../supabase/functions/ask-dan/performance';

describe('Dan AI speed contracts', () => {
  it('uses the unchanged draft when the checker passes without a final', () => {
    const draft = { answer: 'Original checked answer.' };
    expect(checkerResult({ pass: true, issues: [] }, draft, () => null)?.final).toBe(draft);
  });
  it('rejects failed checks without a valid correction', () => {
    expect(checkerResult({ pass: false, issues: [{ type: 'privacy' }] }, {}, () => null)).toBeNull();
  });
  it('does not accept a pass that still reports issues', () => {
    expect(checkerResult({ pass: true, issues: [{ type: 'privacy' }] }, {}, () => null)).toBeNull();
  });
  it('limits passages to 900 characters around the relevant match', () => {
    const content = 'x'.repeat(2000) + 'speed to lead' + 'y'.repeat(2000);
    const excerpt = relevantExcerpt(content, ['speed to lead']);
    expect(excerpt.length).toBe(900);
    expect(excerpt).toContain('speed to lead');
  });
});
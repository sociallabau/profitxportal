import { describe, expect, it } from 'vitest';
import { hasCostPerClient, looksTruncated, repairCostPerClient, wordCount } from '../../supabase/functions/ask-dan/guardrails';
import { FLAG_REPLY } from '../../supabase/functions/ask-dan/prompts';

describe('Dan AI guardrail repairs', () => {
  it('accepts a colon before dot points but rejects an unfinished stance', () => {
    expect(looksTruncated("Not quite yet bro — here's the order:")).toBe(false);
    expect(looksTruncated('Your next step is')).toBe(true);
  });
  it('recognises formatted dollars, not unrelated digits', () => {
    expect(hasCostPerClient('~$1,200 a client', 1200)).toBe(true);
    expect(hasCostPerClient('$3,630 retainer; 363 views', 363)).toBe(false);
  });
  it('retains computed cost inside four points without replacing the note', () => {
    const answer = { points: [{ do: 'Call every lead within 15–30 mins', why: 'Follow-up comes first' }, { do: 'Keep tracking', why: 'Use your growth hub' }, { do: 'Wait 7 days', why: 'Leave the campaign alone' }, { do: 'Review later', why: 'Judge over 1–2 months' }], note: null };
    const repaired = repairCostPerClient(answer, 363, 2000);
    expect(repaired.points).toHaveLength(4);
    expect(repaired.points[0].why).toContain('~$363 a client vs your $2,000 retainer, under half');
    expect(repaired.note).toBeNull();
    expect(answer.points[0].why).toBe('Follow-up comes first');
  });
  it('does not invent an unknown cost', () => {
    const answer = { points: [{ do: 'Track clients', why: 'Get the numbers first' }] };
    expect(repairCostPerClient(answer, NaN, 2000)).toBe(answer);
  });
  it('keeps the boundary fallback within 15–60 words', () => {
    expect(wordCount(FLAG_REPLY)).toBeGreaterThanOrEqual(15);
    expect(wordCount(FLAG_REPLY)).toBeLessThanOrEqual(60);
  });
});
import { describe, expect, it } from 'vitest';
import { gateFromLabel, mustSay } from '../../supabase/functions/ask-dan/mustSay';

const base = { gate: 1, revenue: 3000, hasContext: true, hasMember: true };

describe('mustSay', () => {
  it('reads gate labels', () => {
    expect(gateFromLabel('Gate 2 · Fuel')).toBe(2);
    expect(gateFromLabel('Gate III')).toBe(3);
    expect(gateFromLabel(null)).toBeNull();
  });
  it('carries the free-client rules and their revenue', () => {
    const r = mustSay({ ...base, question: 'Should I do a free month for a cafe to get a case study?' }).join(' ');
    expect(r).toContain('$15–20k');
    expect(r).toContain('$3,000');
    expect(r).toContain('OWN account');
    expect(r).toContain('on top of the fee');
    expect(r).toContain('awareness');
  });
  it('adds the $50 boost for a Gate 1 path question, not for Gate 3', () => {
    expect(mustSay({ ...base, question: "What's my next step to move up?" }).join(' ')).toContain('$50');
    expect(mustSay({ ...base, gate: 3, question: "What's my next step to move up?" }).join(' ')).not.toContain('$50');
  });
  it('asks for the Context Room when it is empty', () => {
    expect(mustSay({ ...base, hasContext: false, question: 'What should I charge?' }).join(' ')).toContain('Context Room');
  });
});

import { describe, expect, it } from 'vitest';
import { SITUATIONS, situationBlock } from '../../supabase/functions/ask-dan/playbook';

const keys = (q: string) => situationBlock(q).keys;

describe("Dan's playbook situations", () => {
  it('matches each common stuck point to its situation', () => {
    const cases: [string, string][] = [
      ['Help me do this build task step by step: "Start 6 retainer conversations" (training: C2)', 'conversations'],
      ['How do I get more clients?', 'conversations'],
      ['What should I charge for a retainer?', 'pricing'],
      ['A prospect said it was too expensive, what do I say?', 'too_expensive'],
      ["I'm posting every week but getting no enquiries", 'no_enquiries'],
      ["I've run out of ideas, what should I post?", 'content_ideas'],
      ['My boost is not working, should I change it?', 'ad_results'],
      ["A lead just wants a price and won't jump on a call", 'lead_stalled'],
      ['They ghosted me after I sent examples', 'lead_stalled'],
      ['How do I turn a one-off shoot into a retainer?', 'one_off'],
      ['My client wants to cancel next month', 'churn'],
      ["I'm too busy shooting to post my own stuff", 'too_busy'],
      ['My client keeps asking for extra videos outside the retainer', 'scope_creep'],
    ];
    for (const [q, key] of cases) expect(keys(q), q).toContain(key);
  });

  it('leaves unrelated questions alone and caps at two situations', () => {
    expect(keys('Am I at Gate 1 with 3 paying retainers?')).toEqual([]);
    expect(keys('Should I pause my ads to save cash?')).not.toContain('churn');
    expect(keys('Too busy for content and my boost is not working and I get no enquiries').length).toBeLessThanOrEqual(2);
  });

  it("every situation has Dan's answer and his reasoning", () => {
    for (const s of SITUATIONS) {
      expect(s.dan.length, s.key).toBeGreaterThan(80);
      expect(s.logic.length, s.key).toBeGreaterThan(80);
    }
    expect(situationBlock('How do I get more clients?').text).toContain("Don't paste it as a script");
  });
});

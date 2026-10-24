import { describe, expect, it } from 'vitest';
import { gateFromLabel, missingRules, mustSay, statedRetainers } from '../../supabase/functions/ask-dan/mustSay';

const base = { gate: 1, revenue: 3000, hasContext: true, hasMember: true };
const says = (r: ReturnType<typeof mustSay>) => r.map(x => x.say).join(' ');

describe('mustSay', () => {
  it('reads gate labels and stated retainers', () => {
    expect(gateFromLabel('Gate 2 · Fuel')).toBe(2);
    expect(gateFromLabel('Gate III')).toBe(3);
    expect(gateFromLabel(null)).toBeNull();
    expect(statedRetainers("I've got 2 retainers at $1,500")).toBe(2);
    expect(statedRetainers('3 retainers, one I do free')).toBeNull();
  });
  it('GATE_PATH: not at Gate 1 yet and the $50 boost', () => {
    const r = mustSay({ ...base, gate: null, question: "I've got 2 retainers at $1,500. How do I get to Gate 2 and what should I spend on ads?" });
    expect(says(r)).toContain('not at Gate 1 yet');
    expect(says(r)).toContain('$50');
    expect(missingRules(r, "You're not at Gate 1 yet. Put a ~$50 profile-visit boost behind your best posts.")).toEqual([]);
  });
  it('FREE_CLIENT_TRAP: all the free-client rules', () => {
    const r = mustSay({ ...base, question: "I've got 3 retainers, one free as a case study. I want to skip boosting and bundle ad spend into a package." });
    expect(says(r)).toContain('$15–20k');
    expect(says(r)).toContain('OWN account');
    expect(says(r)).toContain('on top of the fee');
    expect(says(r)).toContain('switch off awareness');
    expect(missingRules(r, 'Post case studies on your own account. Ad spend sits on top of the fee. Never switch off awareness. Editor at ~$15–20k.')).toEqual([]);
  });
  it('ADS_5_DAYS_SCALE: under half and the Growth Hub', () => {
    const r = mustSay({ ...base, gate: 3, costPerClient: 363, lowestPrice: 2000, question: 'Ads have run 5 days, can I scale?' });
    expect(missingRules(r, '~$363 a client vs $2,000.').map(x => x.short)).toHaveLength(2);
    expect(missingRules(r, '~$363 a client is under half your $2,000. Track every lead in your Growth Hub.')).toEqual([]);
  });
  it('asks for the Context Room when it is empty', () => {
    expect(says(mustSay({ ...base, hasContext: false, question: 'What should I charge?' }))).toContain('Context Room');
  });
});

describe('mustSay creatives', () => {
  it('asks for 3–4 creatives on a weak CTR', () => {
    const r = mustSay({ gate: 2, revenue: 3000, hasContext: true, hasMember: true, question: 'Lead gen 5 days, CTR 0.5%, one video. Kill it or bump to $40/day?' });
    expect(r.map(x => x.short).join(' ')).toContain('3–4 creatives');
    expect(missingRules(r.filter(x => x.short.includes('creatives')), 'Add 3–4 creatives to the SAME campaign.')).toEqual([]);
  });
});

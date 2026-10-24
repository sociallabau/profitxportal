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
  it('FREE_CLIENT_GATE: a free client does not count, and no unrelated ad rules', () => {
    const r = mustSay({ ...base, question: "I've got 3 retainers, two at $1,800 and one I'm doing free as a case study. So I'm at Gate 1, right?" });
    expect(r.map(x => x.short)).toContain("free clients don't count, only paying retainers");
    expect(says(r)).not.toContain('on top of the fee');
    expect(says(r)).not.toContain('$15–20k');
    expect(says(r)).not.toContain('$50');
    expect(missingRules(r, "Not yet. The free client doesn't count. Post case studies on your own account.")).toEqual([]);
  });
  it('AD_SPEND_INSIDE and SKIP_BOOST: on top of the fee, and the $50 boost', () => {
    expect(says(mustSay({ ...base, question: 'Should I include the ad spend in my retainer price to keep it simple?' }))).toContain('on top of the fee');
    const r = mustSay({ ...base, question: 'Can I skip the boost and go straight to lead gen at $50/day?' });
    expect(says(r)).toContain('$50 profile-visit boost');
    expect(missingRules(r, 'Lead gen at $50/day comes later.').map(x => x.short)).toEqual(["for now it's a ~$50 profile-visit boost behind your best posts; awareness comes at Gate 2", 'lead gen comes at Gate 3']);
  });
  it('ADS_5_DAYS_SCALE: under half and the CPA column on the lead tracking sheet', () => {
    const r = mustSay({ ...base, gate: 3, costPerClient: 363, lowestPrice: 2000, question: 'Ads have run 5 days, can I scale?' });
    expect(missingRules(r, '~$363 a client vs $2,000.').map(x => x.short)).toHaveLength(3);
    expect(missingRules(r, '~$363 a client vs $2,000. Log every lead daily in your growth hub.').map(x => x.short)).toContain('check the CPA column on your lead tracking sheet');
    expect(missingRules(r, '~$363 a client is under half your $2,000. Bump it once every lead is called within 15–30 mins; check the CPA column on your lead tracking sheet.')).toEqual([]);
  });
  it('ADS_5_DAYS_EARLY: no Gate 3 or starter-boost rules', () => {
    const r = mustSay({ ...base, costPerClient: 600, lowestPrice: 2950, question: 'Been running lead gen 5 days at $20/day, 4 leads, none booked a call. Kill it or bump to $40/day?' });
    const shorts = r.map(x => x.short).join(' ');
    expect(shorts).not.toContain('bump it once');
    expect(shorts).not.toContain('half your');
    expect(shorts).not.toContain('$50 profile-visit');
  });
  it('SKIP_BOOST: the $50 boost and lead gen at Gate 3', () => {
    const r = mustSay({ ...base, question: 'Can I skip the profile visit boost and go straight to lead gen at $50/day?' });
    expect(r.map(x => x.short)).toContain('lead gen comes at Gate 3');
    expect(missingRules(r, 'Put a ~$50 profile-visit boost behind your best posts. Awareness at Gate 2, lead gen comes at Gate 3.')).toEqual([]);
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

describe('mustSay $50 boost check', () => {
  const rule = mustSay({ gate: null, revenue: 3000, hasContext: true, hasMember: true, question: 'skip boosting and go straight to lead gen at $50/day?' }).filter(r => r.short.includes('$50'));
  it('is not fooled by "$50/day" lead gen', () => {
    expect(rule).toHaveLength(1);
    expect(missingRules(rule, 'Lead gen at $50/day is a Gate 3 step, skip boosting for now.')).toHaveLength(1);
    expect(missingRules(rule, 'Put a ~$50 profile-visit boost behind your best posts.')).toHaveLength(0);
  });
  it('keeps Gate 3 rules away from early gates', () => {
    const early = mustSay({ gate: 1, revenue: 3000, hasContext: true, hasMember: true, costPerClient: 600, lowestPrice: 2950, question: 'Lead gen 5 days, bump to $40/day?' });
    expect(early.map(r => r.short).join(' ')).not.toContain('Growth Hub');
  });
});

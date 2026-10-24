import { describe, expect, it } from 'vitest';
import { prescribe, workshopGuideText } from '../../supabase/functions/ask-dan/workshops';
import { signals } from '../../supabase/functions/ask-dan/signals';
import { derive, type MemberInput } from '../../supabase/functions/ask-dan/context';
import { resourceCatalogue } from '@/data/resourceCatalogue';

const lines = resourceCatalogue().split('\n');
const title = (l: string | null) => l?.split(' · ').pop() ?? null;

describe('workshop prescription', () => {
  it('has a guide line for every workshop and lesson in the Vault', () => {
    const vault = lines.filter(l => /^Vault · (Workshop|Lesson) ·/.test(l));
    for (const l of vault) expect(workshopGuideText([l]), l).not.toBe('');
  });
  it('prescribes the workshop that fixes the problem', () => {
    expect(title(prescribe('40 leads but only 3 calls booked, slow follow up', lines))).toContain('The System');
    expect(title(prescribe('my CTR is low and the creatives are not working, can I scale', lines))).toContain('Paid Ad Powerup');
    expect(title(prescribe('lost a client, churn is killing me, delivery feels chaotic', lines))).toContain('Delivery Magic');
    expect(title(prescribe('closing everyone, am I underpriced? margin is thin', lines))).toContain('Profit By Design');
    expect(title(prescribe('what should I post, my content and hooks get no views', lines))).toContain('Organic Content Snowball');
    expect(prescribe('hello', lines)).toBeNull();
  });
});

describe('problem signals', () => {
  const base: MemberInput = { answers: {}, goal: { retainer_tier_1: 2000 }, totals: [] };
  const today = new Date();
  const month = `${today.toISOString().slice(0, 7)}-01`;
  it('spots a follow-up problem and a churn problem', () => {
    const m: MemberInput = { ...base, totals: [{ month, mrr: 6000, ad_leads: 40, booked_calls: 3, retainers_lost: 1, ad_spend: 1500, new_clients: 1 }] };
    const s = signals(m, derive(m, today)).map(x => x.problem).join(' | ');
    expect(s).toContain('40 leads but only 3 calls booked');
    expect(s).toContain('lost 1 retainer');
  });
  it('flags missing numbers and underpricing', () => {
    expect(signals(base, derive(base, today))[0].problem).toContain('no monthly numbers');
    const m: MemberInput = { ...base, totals: [{ month, mrr: 4000, meetings: 4, new_clients: 3 }] };
    expect(signals(m, derive(m, today)).map(x => x.fix).join(' ')).toContain('underpriced');
  });
});

import { describe, expect, it } from 'vitest';
import { checkInValues, visibleSections } from './checkIn';

const keys = (gate: Parameters<typeof visibleSections>[0]) => visibleSections(gate).flatMap(s => s.fields.map(f => f.key));

describe('check-in boxes by gate', () => {
  it('shows a Gate 1 member their gate and Gate 2, not ad leads', () => {
    expect(keys(1)).toContain('case_studies_posted');
    expect(keys(1)).toContain('ad_spend_awareness');
    expect(keys(1)).not.toContain('ad_leads');
  });
  it('shows everything with no gate, and Gate 3 boxes from Gate 2', () => {
    expect(keys(null)).toContain('calls_showed');
    expect(keys(2)).toContain('ad_leads');
  });
});

describe('checkInValues', () => {
  it('fills the combined columns and leaves hidden boxes null', () => {
    const v = checkInValues({ retainer_convos: '6', ad_spend_awareness: '50', ad_leads: '40' }, 1);
    expect(v.leads_generated).toBe(6);
    expect(v.ad_spend).toBe(50);
    expect(v.ad_leads).toBeNull();
    expect(v.new_clients).toBeNull();
  });
  it('adds both kinds of ad spend and both kinds of lead', () => {
    const v = checkInValues({ retainer_convos: '2', ad_leads: '30', ad_spend_awareness: '100', ad_spend_leadgen: '1500.5' }, 3);
    expect(v.leads_generated).toBe(32);
    expect(v.ad_spend).toBe(1600.5);
  });
});

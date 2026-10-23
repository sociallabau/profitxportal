import { describe, it, expect } from 'vitest';
import { classifyAudit } from './roadmapAudit';

describe('classifyAudit', () => {
  it('offer and clients reds are a supply issue', () => {
    const r = classifyAudit({ O1: 'red', C2: 'red', D1: 'red' });
    expect(r.issue).toBe('supply');
    expect(r.supplyReds).toBe(2);
  });
  it('delivery reds are a demand issue', () => {
    const r = classifyAudit({ D1: 'red', D2: 'red', O1: 'red' });
    expect(r.issue).toBe('demand');
    expect(r.focus[0]).toBe('D1');
  });
  it('focus prioritises reds over ambers', () => {
    expect(classifyAudit({ O1: 'amber', C4: 'red' }).focus).toEqual(['C4', 'O1']);
  });
});

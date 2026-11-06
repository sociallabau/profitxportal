import { describe, it, expect } from 'vitest';
import { classifyAudit, pickOptions, type Rating } from './roadmapAudit';

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

describe('pickOptions', () => {
  it('splits the weak areas into grow-the-business and tighten-it-up', () => {
    const r = pickOptions({ O2: 'red', C1: 'red', D1: 'red', D2: 'amber' }, 2);
    expect(r.bigger).toEqual(['O2', 'C1']);
    expect(r.better).toEqual(['D1', 'D2']);
  });
  it('never offers a module beyond the gate above theirs', () => {
    const all = Object.fromEntries(['O1', 'O4', 'D1', 'D6'].map(c => [c, 'red' as Rating]));
    const r = pickOptions(all, 1);
    // O4 and D6 are Gate 4 modules: out of reach for a Gate 1 member.
    expect(r.bigger).not.toContain('O4');
    expect(r.better).not.toContain('D6');
    expect(r.bigger).toContain('O1');
  });
  it('still offers something when a side came back all green', () => {
    const r = pickOptions({ O1: 'red' }, 2);
    expect(r.better.length).toBeGreaterThan(0);
  });
  it('caps each side', () => {
    const all = Object.fromEntries(['O1', 'O2', 'O3', 'C1', 'C2', 'C3'].map(c => [c, 'red' as Rating]));
    expect(pickOptions(all, 4, 2).bigger).toHaveLength(2);
  });
});

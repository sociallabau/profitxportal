import { describe, expect, it } from 'vitest';
import { cycleOf, cycleSteps } from './cycle';

const at = (year: number, month: number, day = 15) => new Date(year, month - 1, day);

describe('cycleOf', () => {
  it('December reflects, January builds, February implements', () => {
    expect(cycleOf(at(2026, 12)).mode).toBe('reflect');
    expect(cycleOf(at(2027, 1)).mode).toBe('build');
    expect(cycleOf(at(2027, 2)).mode).toBe('implement');
  });
  it('then it repeats, all year', () => {
    const modes = Array.from({ length: 12 }, (_, i) => cycleOf(at(2027, i + 1)).mode);
    expect(modes).toEqual([
      'build', 'implement', 'reflect', // Jan, Feb, Mar
      'build', 'implement', 'reflect', // Apr, May, Jun
      'build', 'implement', 'reflect', // Jul, Aug, Sep
      'build', 'implement', 'reflect', // Oct, Nov, Dec
    ]);
  });
  it('all three months of a cycle share the reflect month as their key', () => {
    expect(cycleOf(at(2026, 12)).key).toBe('2026-12');
    expect(cycleOf(at(2027, 1)).key).toBe('2026-12');
    expect(cycleOf(at(2027, 2)).key).toBe('2026-12');
    // The next cycle starts in March.
    expect(cycleOf(at(2027, 3)).key).toBe('2027-03');
  });
  it('points at the month just gone, across a year boundary', () => {
    expect(cycleOf(at(2027, 1)).previousMonth).toBe('2026-12');
    expect(cycleOf(at(2026, 12)).previousMonth).toBe('2026-11');
  });
});

describe('cycleSteps', () => {
  it('a reflect month asks for the numbers and the review', () => {
    expect(cycleSteps('reflect')).toEqual(['numbers', 'review']);
  });
  it('the other months just want the numbers in', () => {
    expect(cycleSteps('build')).toEqual(['numbers']);
    expect(cycleSteps('implement')).toEqual(['numbers']);
  });
});

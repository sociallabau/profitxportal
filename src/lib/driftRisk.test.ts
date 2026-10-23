import { describe, it, expect } from 'vitest';
import { computeDrift, isFlatOrDeclining } from './driftRisk';

const base = {
  gate: '1',
  revenueSeries: [12000, 11000],
  daysSinceSubmission: 10,
  daysSinceCompletion: 5,
  confidenceSeries: [8, 8],
};

describe('computeDrift', () => {
  it('is green when everything is moving', () => {
    expect(computeDrift(base)).toEqual({ band: 'green', signals: [] });
  });

  it('flags a stalled gate: no completion in 60+ days and gate target not met', () => {
    const r = computeDrift({ ...base, revenueSeries: [4000, 3900], daysSinceCompletion: 74 });
    expect(r.signals).toContain('No module progress 74 days');
    expect(r.signals).toContain('Revenue flat 2 months');
    expect(r.band).toBe('red');
  });

  it('does not flag a stalled gate when the gate revenue target is met', () => {
    const r = computeDrift({ ...base, daysSinceCompletion: 90 });
    expect(r.signals).toEqual([]);
    expect(r.band).toBe('green');
  });

  it('flags a submission gap over 45 days', () => {
    const r = computeDrift({ ...base, daysSinceSubmission: 52 });
    expect(r.signals).toEqual(['No submission 52 days']);
    expect(r.band).toBe('amber');
  });

  it('flags never submitting', () => {
    const r = computeDrift({ ...base, daysSinceSubmission: null });
    expect(r.signals).toEqual(['Never submitted a monthly report']);
  });

  it('flags confidence of 4 or less', () => {
    const r = computeDrift({ ...base, confidenceSeries: [3, 7] });
    expect(r.signals).toEqual(['Confidence 3/10']);
  });

  it('flags a confidence drop of 2 or more', () => {
    const r = computeDrift({ ...base, confidenceSeries: [5, 8] });
    expect(r.signals).toEqual(['Confidence dropped 8→5']);
  });

  it('goes red with two or more signals', () => {
    const r = computeDrift({
      gate: '2',
      revenueSeries: [9000, 9000, 8800],
      daysSinceSubmission: 60,
      daysSinceCompletion: 100,
      confidenceSeries: [3, 6],
    });
    expect(r.band).toBe('red');
    expect(r.signals.length).toBeGreaterThanOrEqual(3);
  });
});

describe('isFlatOrDeclining', () => {
  it('treats ±5% as flat', () => {
    expect(isFlatOrDeclining([10000, 9800, 9600])).toBe(true);
  });

  it('clears when revenue grows beyond tolerance', () => {
    expect(isFlatOrDeclining([11000, 10000, 9500])).toBe(false);
  });

  it('needs at least two submissions', () => {
    expect(isFlatOrDeclining([10000])).toBe(false);
    expect(isFlatOrDeclining([])).toBe(false);
  });
});

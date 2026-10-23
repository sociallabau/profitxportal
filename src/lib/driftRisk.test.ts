import { describe, it, expect } from 'vitest';
import { computeDrift, isFlatOrDeclining } from './driftRisk';

const base = {
  revenueSeries: [12000, 11000],
  daysSinceSubmission: 10,
  confidenceSeries: [8, 8],
};

describe('computeDrift', () => {
  it('is green when everything is moving', () => {
    expect(computeDrift(base)).toEqual({ band: 'green', signals: [] });
  });

  it('flags flat or declining revenue across the last submissions', () => {
    const r = computeDrift({ ...base, revenueSeries: [4000, 3900] });
    expect(r.signals).toEqual(['Revenue flat 2 months']);
    expect(r.band).toBe('amber');
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
      revenueSeries: [9000, 9000, 8800],
      daysSinceSubmission: 60,
      confidenceSeries: [3, 6],
    });
    expect(r.band).toBe('red');
    expect(r.signals.length).toBeGreaterThanOrEqual(3);
  });

  it('never uses module progress as a signal', () => {
    const r = computeDrift(base);
    expect(r.signals.join(' ')).not.toMatch(/module/i);
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

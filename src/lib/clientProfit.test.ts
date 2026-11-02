import { describe, it, expect } from 'vitest';
import { calculateClient, rateMargin } from './clientProfit';

const rates = { hourlyCost: 40, editorCostPerVideo: 75 };

describe('calculateClient', () => {
  it('matches the example client on the sheet', () => {
    const r = calculateClient({ name: 'Example Client', packagePrice: 3500, shootHours: 4, managementHours: 4, videos: 4 }, rates);
    expect(r.timeCost).toBe(320);
    expect(r.editorCost).toBe(300);
    expect(r.totalCost).toBe(620);
    expect(r.netProfit).toBe(2880);
    expect(r.margin).toBeCloseTo(82.29, 2);
    expect(r.rating).toBe('green');
  });

  it('has no margin or rating without a package price', () => {
    const r = calculateClient({ name: '', packagePrice: 0, shootHours: 2, managementHours: 0, videos: 0 }, rates);
    expect(r.netProfit).toBe(-80);
    expect(r.margin).toBeNull();
    expect(r.rating).toBeNull();
  });

  it('treats blank (NaN) inputs as zero', () => {
    const r = calculateClient({ name: '', packagePrice: 1000, shootHours: NaN, managementHours: 1, videos: NaN }, rates);
    expect(r.totalCost).toBe(40);
  });
});

describe('rateMargin', () => {
  it('uses the sheet bands', () => {
    expect(rateMargin(60)).toBe('green');
    expect(rateMargin(59.9)).toBe('yellow');
    expect(rateMargin(40)).toBe('yellow');
    expect(rateMargin(39.9)).toBe('red');
    expect(rateMargin(-20)).toBe('red');
  });
});

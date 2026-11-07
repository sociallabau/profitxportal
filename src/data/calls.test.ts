import { describe, expect, it } from 'vitest';
import { thumbnailFor } from './calls';

describe('thumbnailFor', () => {
  it('still gives Momentum Call its own thumbnail, not just by being the fallback', () => {
    expect(thumbnailFor('ProfitX - Momentum Call™')).toBeDefined();
  });

  it('recognises a known workshop by a keyword in its title', () => {
    expect(thumbnailFor('ProfitX Workshop — Smooth Operator™')).toBeDefined();
    expect(thumbnailFor('ProfitX Workshop — Christmas Comes Early™')).toBeDefined();
  });

  it('gives an unrecognised title no thumbnail at all, rather than borrowing one', () => {
    expect(thumbnailFor('ProfitX Workshop — Lead Lift™')).toBeUndefined();
    expect(thumbnailFor('ProfitX Workshop — AI Systems™')).toBeUndefined();
  });

  it('never hands an unrecognised title the Momentum Call thumbnail specifically', () => {
    expect(thumbnailFor('ProfitX Workshop — Lead Lift™')).not.toBe(thumbnailFor('ProfitX - Momentum Call™'));
  });
});

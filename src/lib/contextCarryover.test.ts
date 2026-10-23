import { describe, expect, it } from 'vitest';
import { carryOverContext } from './contextCarryover';

describe('existing member context', () => {
  it('carries a previous business description into a missing answer', () => {
    expect(carryOverContext({ business_name: 'Member agency' }, 'Existing business context')).toEqual({ business_name: 'Member agency', customer_problem: 'Existing business context' });
  });
  it('never overwrites a newer Context Room answer', () => {
    expect(carryOverContext({ customer_problem: 'New answer' }, 'Old answer').customer_problem).toBe('New answer');
  });
  it('preserves an intentionally cleared answer', () => {
    expect(carryOverContext({ customer_problem: '' }, 'Old answer').customer_problem).toBe('');
  });
  it('does not populate an answer from blank legacy context', () => {
    expect(carryOverContext({}, '  ')).toEqual({});
  });
});
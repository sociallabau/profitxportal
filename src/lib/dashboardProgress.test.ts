import { describe, it, expect } from 'vitest';
import { revenuePosition, submissionStreak, focusBullets } from './dashboardProgress';
import { workshopTypeFor } from '@/data/calls';

it('marks the next October 28 workshop as Learn, including calendar-feed titles', () => {
  expect(workshopTypeFor('ProfitX Workshop - Christmas Comes Early™', '2026-10-28T07:00:00')).toBe('learn');
});

describe('revenue ladder', () => {
  it('places revenue at its level and interpolates between levels', () => {
    expect(revenuePosition(20000)).toBe(25);
    expect(revenuePosition(25000)).toBe(31.25);
    expect(revenuePosition(150000)).toBe(100);
    expect(revenuePosition(-1)).toBe(0);
  });
});
describe('monthly submission streak', () => {
  it('counts consecutive months, not submissions, including backdated reports', () => {
    expect(submissionStreak(['2026-08-31', '2026-09-30', '2026-09-01'], '2026-10-23')).toEqual({ streak: 2, longest: 2 });
  });
  it('resets when the previous month was missed and preserves longest run', () => {
    expect(submissionStreak(['2026-06-30', '2026-07-31'], '2026-10-23')).toEqual({ streak: 0, longest: 2 });
  });
});

describe('focus dot points', () => {
  it('splits gate criteria written with slashes into one point each', () => {
    expect(focusBullets('Gate 1 is: 3 retainers / 4 convos a month / 4 posts a month / 2 case studies (BTS of shoots counts as a case study)')).toEqual([
      'Gate 1 is: 3 retainers',
      '4 convos a month',
      '4 posts a month',
      '2 case studies',
      'BTS of shoots counts as a case study',
    ]);
  });
  it('splits run-on sentences and long asides, keeping lowercase fragments joined', () => {
    expect(focusBullets('Post twice a week to 8 this month, best ones into awareness. Then 2 more case studies (work into your bts, or get some clients on cam if you can)')).toEqual([
      'Post twice a week to 8 this month, best ones into awareness',
      'Then 2 more case studies',
      'Work into your bts, or get some clients on cam if you can',
    ]);
    expect(focusBullets('Post some BTS content and profile visit boost them - to get engagement')).toEqual([
      'Post some BTS content and profile visit boost them, to get engagement',
    ]);
    expect(focusBullets('Own growth hub (speed to lead, follow-ups, what converts). Everything else for Gate 4 is met or close (~5 inbound of 4).')).toEqual([
      'Own growth hub',
      'Speed to lead, follow-ups, what converts',
      'Everything else for Gate 4 is met or close (~5 inbound of 4)',
    ]);
  });
  it('returns nothing for empty notes', () => {
    expect(focusBullets('')).toEqual([]);
    expect(focusBullets(null)).toEqual([]);
  });
});

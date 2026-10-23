import { describe, it, expect } from 'vitest';
import { revenuePosition, submissionStreak, focusBullets } from './dashboardProgress';
import { workshopTypeFor } from '@/data/calls';

const CASE_NOTE = '(either results from client or BTS posts with you talking)';

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
  it('gives every gate criterion its own short point', () => {
    expect(focusBullets('Gate 1 is: 3 retainers / 4 convos a month / 4 posts a month / 2 case studies (BTS of shoots counts as a case study)')).toEqual([
      'Gate 1 is: 3 retainers',
      '4 convos a month',
      '4 posts a month',
      `2 case studies ${CASE_NOTE}`,
      'BTS of shoots counts as a case study',
    ]);
  });
  it('drops hedged lead-ins so points read as instructions', () => {
    expect(focusBullets('Just need a paying retainer signed in October - additionally posts 7→8, case studies (bts or testimonials) 2→4. Basically one extra bts or client based post.')).toEqual([
      'Need a paying retainer signed in October',
      'Posts 7→8',
      'Case studies (bts or testimonials) 2→4',
      'One extra bts or client based post',
    ]);
  });
  it('explains what counts only on numbered case study targets', () => {
    expect(focusBullets('Then 2 more case studies and 2ish case study posts')).toEqual([
      `2 more case studies ${CASE_NOTE}`,
      `2ish case study posts ${CASE_NOTE}`,
    ]);
    expect(focusBullets('You have enough retainers and case studies to move up')).toEqual([
      'You have enough retainers and case studies to move up',
    ]);
    expect(focusBullets('Post 2 result or testimonial case studies or pieces (client on camera if you can)')).toEqual([
      'Post 2 result or testimonial case studies or pieces (client on camera if you can)',
    ]);
  });
  it('keeps compound subjects and tails together', () => {
    expect(focusBullets('Your convos, case studies/content and posts are all met bro')).toEqual([
      'Your convos, case studies/content and posts are all met bro',
    ]);
    expect(focusBullets('Convos 2→4, posts 2→4, $50 PV boosting for engagement and convos')).toEqual([
      'Convos 2→4, posts 2→4',
      '$50 PV boosting for engagement and convos',
    ]);
  });
  it('returns nothing for empty notes', () => {
    expect(focusBullets('')).toEqual([]);
    expect(focusBullets(null)).toEqual([]);
  });
});

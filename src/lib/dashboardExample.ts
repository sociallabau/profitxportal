import { OWNER_USER_ID } from '@/lib/owner';
import type { Call } from '@/data/calls';
import momentumThumbnail from '@/assets/momentum-call-thumb.png';
import workshopThumbnail from '@/assets/christmas-comes-early-thumb.png';

export const isExampleDashboard = (userId?: string) => userId === OWNER_USER_ID;

export const EXAMPLE_PROFILE = {
  full_name: 'Alex Example',
  gate: 'Gate 2 · Fuel',
  gate_key_task: 'Start 4 sales conversations this week. Publish 4 posts this week. Share 2 case studies.',
  gate_move_up: 'Sign 3 new retainers. Reach $20k monthly revenue.',
};

// Flat 12-month example line: starts at $0, then holds $15k/mth.
export const EXAMPLE_REVENUE = Array.from({ length: 12 }, (_, index) => ({
  revenue: index === 0 ? 0 : 15000,
  month: ['Oct 25', 'Nov 25', 'Dec 25', 'Jan 26', 'Feb 26', 'Mar 26', 'Apr 26', 'May 26', 'Jun 26', 'Jul 26', 'Aug 26', 'Sep 26'][index],
  monthKey: `202${5 + Math.floor(index / 14)}-${String(((index + 9) % 12) + 1).padStart(2, '0')}-01`,
}));

export const EXAMPLE_CALLS: Call[] = [
  { title: 'Momentum Call™', category: 'Coaching', start: '2026-10-27T07:30:00+10:00', durationMins: 60, meetUrl: '#', thumbnail: momentumThumbnail },
  { title: 'Christmas Comes Early™', category: 'Workshop', workshopType: 'learn', start: '2026-10-28T07:00:00+10:00', durationMins: 90, meetUrl: '#', thumbnail: workshopThumbnail },
  { title: 'Momentum Call™', category: 'Coaching', start: '2026-11-03T07:30:00+10:00', durationMins: 60, meetUrl: '#' },
  { title: 'Momentum Call™', category: 'Coaching', start: '2026-11-10T07:30:00+10:00', durationMins: 60, meetUrl: '#' },
];

export const EXAMPLE_WINS = [
  { id: 'example-1', win_text: 'Signed two new retainers this month — the ads are paying off!', cash_amount: 3200, created_at: '2026-10-22T12:00:00+10:00' },
  { id: 'example-2', win_text: 'Handed editing over to the team and got a full day back each week.', cash_amount: 0, created_at: '2026-10-20T12:00:00+10:00' },
];
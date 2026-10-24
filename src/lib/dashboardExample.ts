import type { TaskWithStatus } from '@/lib/growthHub';
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

// Rising 12-month example line: starts at $0, climbs a little each month, hits $15k last month.
const EXAMPLE_REVENUE_VALUES = [0, 500, 1200, 2100, 3200, 4500, 6000, 7600, 9200, 10900, 12800, 15000];

export const EXAMPLE_REVENUE = EXAMPLE_REVENUE_VALUES.map((revenue, index) => ({
  revenue,
  month: ['Nov 25', 'Dec 25', 'Jan 26', 'Feb 26', 'Mar 26', 'Apr 26', 'May 26', 'Jun 26', 'Jul 26', 'Aug 26', 'Sep 26', 'Oct 26'][index],
  monthKey: `${2025 + Math.floor((10 + index) / 12)}-${String(((10 + index) % 12) + 1).padStart(2, '0')}-01`,
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
const exampleTask = (n: number, title: string, why: string, codes: string[], status: TaskWithStatus['status'], kind: TaskWithStatus['kind'] = 'once'): TaskWithStatus => ({
  id: `example-${n}`, gate: 2, position: n, title, why, kind, module_codes: codes, training_label: null, training_url: null,
  proof_hint: 'a screenshot', active: true, period: kind === 'monthly' ? 'example' : 'once', status, progress: null,
});

/** The example member's Gate 2 build list, for the owner-only screenshot dashboard. */
export const EXAMPLE_BUILD: TaskWithStatus[] = [
  exampleTask(1, 'Kickoff call with Dan', 'Set your gate and 90-day plan', [], 'approved', 'kickoff'),
  exampleTask(2, 'Awareness campaign live at $5–20/day', 'Keeps your best posts in front of the right people', ['C4'], 'approved'),
  exampleTask(3, 'Post 8 times on your own account', 'BTS and case studies start conversations', ['C1'], 'submitted', 'monthly'),
  exampleTask(4, 'Start 6 retainer conversations', 'The Gate 2 bar for new clients', ['C2'], 'open', 'monthly'),
  exampleTask(5, 'Post 4 case studies on your own account', 'Proof that sells the retainer for you', ['C3'], 'open'),
];
export const EXAMPLE_NEXT = EXAMPLE_BUILD[3];
export const EXAMPLE_BRIEF = '4 conversations down, 2 to go this month. DM everyone who engaged with your last BTS.';

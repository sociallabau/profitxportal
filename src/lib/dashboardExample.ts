import type { TaskWithStatus } from '@/lib/growthHub';
import { OWNER_USER_ID } from '@/lib/owner';
import { brisbaneDateKey, type Call } from '@/data/calls';
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

/** 'YYYY-MM-DD' + `days`, as a date key. Brisbane has no DST, so this is safe as plain UTC-anchored arithmetic. */
function addDays(dateKey: string, days: number): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  const next = new Date(Date.UTC(y, m - 1, d + days));
  return `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, '0')}-${String(next.getUTCDate()).padStart(2, '0')}`;
}

/** The next `weekday` (0=Sun..6=Sat) strictly after `todayKey` — never today itself, so a call
 * generated this morning never shows as "upcoming" once it has already happened today. */
function nextWeekday(todayKey: string, weekday: number): string {
  const [y, m, d] = todayKey.split('-').map(Number);
  const todayDow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  const diff = ((weekday - todayDow + 7) % 7) || 7;
  return addDays(todayKey, diff);
}

/**
 * The owner-only screenshot dashboard's "Next Up" calls, evergreen: built relative to today
 * rather than fixed dates, so a screenshot taken any week still shows a believable near-future
 * schedule instead of calls that happened months ago. Same weekly Momentum Call cadence (Tuesdays)
 * real members see, plus one named workshop — fully isolated fictional data, never live calendar rows.
 */
export function buildExampleCalls(now = new Date()): Call[] {
  const today = brisbaneDateKey(now);
  const momentum1 = nextWeekday(today, 2); // Tuesday
  const workshop = addDays(momentum1, 1); // the Wednesday right after
  const momentum2 = addDays(momentum1, 7);
  const momentum3 = addDays(momentum1, 14);
  return [
    { title: 'Momentum Call™', category: 'Coaching', start: `${momentum1}T07:30:00+10:00`, durationMins: 60, meetUrl: '#', thumbnail: momentumThumbnail },
    { title: 'Christmas Comes Early™', category: 'Workshop', workshopType: 'learn', start: `${workshop}T07:00:00+10:00`, durationMins: 90, meetUrl: '#', thumbnail: workshopThumbnail },
    { title: 'Momentum Call™', category: 'Coaching', start: `${momentum2}T07:30:00+10:00`, durationMins: 60, meetUrl: '#' },
    { title: 'Momentum Call™', category: 'Coaching', start: `${momentum3}T07:30:00+10:00`, durationMins: 60, meetUrl: '#' },
  ];
}

export const EXAMPLE_CALLS: Call[] = buildExampleCalls();

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

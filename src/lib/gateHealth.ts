/**
 * Where a member stands in the gate system, for the admin Client Health page:
 * build list progress, ticks waiting on Dan, whether their gate's monthly bars
 * are held, and so whether they're ready to move up. Pure, so it's testable.
 */
import {
  GATE_GOALS, HOLD_MONTHS, buildProgress, goalStatus, goalTask, monthKey, withStatus,
  type GateNumber, type GrowthHubTask, type TaskProgress, type TaskTracking,
} from '@/lib/growthHub';

export type GateMonth = { month: string; content_posts?: number | null; leads_generated?: number | null; new_clients?: number | null };
/** What's happening this month before the check-in: build-list tallies and new clients logged so far. */
export type GateLive = { tracking?: TaskTracking[]; newClientsThisMonth?: number };

export type GateHealth = {
  gate: GateNumber | null;
  build: { done: number; approved: number; total: number; pct: number };
  buildApproved: boolean;
  toApprove: number;
  sentBack: number;
  /** value: latest check-in. live: this month so far (check-in, build-list tally or logged clients, whichever is highest). */
  goals: { label: string; value: number | null; live: number; target: number; held: boolean }[];
  /** Every gate goal hit this month, live. */
  hitThisMonth: boolean;
  /** Every gate goal hit 2 months running: two check-ins, or last month's check-in plus this month live. */
  goalsHeld: boolean;
  readyToMoveUp: boolean;
  /** Short reasons for the table, e.g. "Posts 3/8". */
  behind: string[];
};

const prevMonthKey = (month: string) => {
  const [y, m] = month.split('-').map(Number);
  return monthKey(new Date(y, m - 2, 1));
};

export function gateHealth(gate: GateNumber | null, tasks: GrowthHubTask[], progress: TaskProgress[], monthsNewestFirst: GateMonth[], month = monthKey(), live: GateLive = {}): GateHealth {
  if (!gate) return { gate, build: { done: 0, approved: 0, total: 0, pct: 0 }, buildApproved: false, toApprove: 0, sentBack: 0, goals: [], hitThisMonth: false, goalsHeld: false, readyToMoveUp: false, behind: [] };
  const list = withStatus(tasks.filter(t => t.gate === gate), progress, month, live.tracking ?? []);
  const build = buildProgress(list);
  const row = (key: string) => monthsNewestFirst.find(r => r.month.startsWith(key));
  const thisMonth = row(month);
  const lastMonth = row(prevMonthKey(month));
  const goals = GATE_GOALS[gate].map(goal => {
    const { value, held } = goalStatus(goal, monthsNewestFirst);
    const liveNow = Math.max(
      thisMonth?.[goal.field] ?? 0,
      goalTask(goal, list)?.tracking?.count ?? 0,
      goal.field === 'new_clients' ? live.newClientsThisMonth ?? 0 : 0,
    );
    const heldLive = liveNow >= goal.target && (lastMonth?.[goal.field] ?? 0) >= goal.target;
    return { label: goal.label, value, live: liveNow, target: goal.target, held: (held.length === HOLD_MONTHS && held.every(Boolean)) || heldLive };
  });
  const goalsHeld = goals.length > 0 && goals.every(g => g.held);
  const buildApproved = build.total > 0 && build.approved === build.total;
  return {
    gate, build, buildApproved,
    toApprove: list.filter(t => t.status === 'submitted').length,
    sentBack: list.filter(t => t.status === 'needs_changes').length,
    goals,
    hitThisMonth: goals.length > 0 && goals.every(g => g.live >= g.target),
    goalsHeld,
    // Dan's call: 2 months of goals hit means they're due to move up. The build list shows alongside so he can check it.
    readyToMoveUp: gate < 4 && goalsHeld,
    behind: goals.filter(g => g.live < g.target).map(g => `${g.label} ${g.live}/${g.target}`),
  };
}

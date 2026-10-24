/**
 * Where a member stands in the gate system, for the admin Client Health page:
 * build list progress, ticks waiting on Dan, whether their gate's monthly bars
 * are held, and so whether they're ready to move up. Pure, so it's testable.
 */
import {
  GATE_GOALS, HOLD_MONTHS, buildProgress, goalStatus, monthKey, withStatus,
  type GateNumber, type GrowthHubTask, type TaskProgress,
} from '@/lib/growthHub';

export type GateMonth = { month: string; content_posts?: number | null; leads_generated?: number | null; new_clients?: number | null };

export type GateHealth = {
  gate: GateNumber | null;
  build: { done: number; approved: number; total: number; pct: number };
  toApprove: number;
  sentBack: number;
  goals: { label: string; value: number | null; target: number; held: boolean }[];
  goalsHeld: boolean;
  readyToMoveUp: boolean;
  /** Short reasons for the table, e.g. "Posts 3/8". */
  behind: string[];
};

export function gateHealth(gate: GateNumber | null, tasks: GrowthHubTask[], progress: TaskProgress[], monthsNewestFirst: GateMonth[], month = monthKey()): GateHealth {
  if (!gate) return { gate, build: { done: 0, approved: 0, total: 0, pct: 0 }, toApprove: 0, sentBack: 0, goals: [], goalsHeld: false, readyToMoveUp: false, behind: [] };
  const list = withStatus(tasks.filter(t => t.gate === gate), progress, month);
  const build = buildProgress(list);
  const goals = GATE_GOALS[gate].map(goal => {
    const { value, held } = goalStatus(goal, monthsNewestFirst);
    return { label: goal.label, value, target: goal.target, held: held.length === HOLD_MONTHS && held.every(Boolean) };
  });
  const goalsHeld = goals.length > 0 && goals.every(g => g.held);
  return {
    gate, build,
    toApprove: list.filter(t => t.status === 'submitted').length,
    sentBack: list.filter(t => t.status === 'needs_changes').length,
    goals, goalsHeld,
    readyToMoveUp: gate < 4 && goalsHeld && build.total > 0 && build.approved === build.total,
    behind: goals.filter(g => (g.value ?? 0) < g.target).map(g => `${g.label} ${g.value ?? 0}/${g.target}`),
  };
}

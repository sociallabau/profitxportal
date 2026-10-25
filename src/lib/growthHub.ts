import { DAN_WHATSAPP_URL, ONBOARDING_COVERED_CODES } from '@/data/modules';

/**
 * Growth Hub: the four gates, each gate's build list, and a member's progress.
 *
 * profiles.gate is the source of truth for where a member is (labels like
 * "Gate 2 (Fuel)"). Build tasks live in playbook_tasks; ticks + proof live in
 * member_task_progress, one row per task per period ('once' or 'YYYY-MM').
 *
 * Pure functions, no JSX and no hooks, so the rules are testable.
 */

export type GateNumber = 1 | 2 | 3 | 4;
export type TaskKind = 'kickoff' | 'once' | 'monthly';
export type TaskStatus = 'open' | 'submitted' | 'approved' | 'needs_changes';

export type GrowthHubGate = { gate: GateNumber; name: string; headline: string; focus: string; what_you_get: string };
export type GrowthHubTask = {
  id: string; gate: GateNumber; position: number; title: string; why: string; kind: TaskKind;
  module_codes: string[]; training_label: string | null; training_url: string | null; proof_hint: string; active: boolean;
};
export type TaskProgress = {
  id?: string; user_id: string; task_id: string; period: string; status: Exclude<TaskStatus, 'open'>;
  proof_url: string | null; member_note: string | null; review_note: string | null;
  submitted_at?: string; reviewed_at?: string | null;
};
/** A member's running tally on a task before they tick it (member_task_tracking). */
export type TaskTracking = { task_id: string; period: string; working: boolean; count: number };
export type TaskWithStatus = GrowthHubTask & { period: string; status: TaskStatus; progress: TaskProgress | null; tracking?: TaskTracking | null };

/** The number a monthly task counts to, read from its title ("Post 8 times…" → 8). Null when it isn't a count. */
export function taskTarget(task: Pick<GrowthHubTask, 'kind' | 'title'>): number | null {
  if (task.kind !== 'monthly') return null;
  const m = task.title.match(/\b(\d{1,3})\s*(?:x\s*)?(?:[a-z]+\s+){0,2}?(?:times|posts?|reels?|videos?|(?:retainer\s+)?conversations?|convos?|dms?|calls?|outreach(?:es)?|messages?)\b/i);
  const n = m ? Number(m[1]) : NaN;
  return n > 1 ? n : null;
}

/** Open and the member says they're on it: the next move moves to the task below. */
export const isWorking = (t: TaskWithStatus) => t.status === 'open' && !!t.tracking?.working;

/** Fallback copy if playbook_gates hasn't loaded (or the migration isn't run yet). */
export const GATES: GrowthHubGate[] = [
  { gate: 1, name: 'Fix', headline: '3 paying retainers', focus: 'Offer · Proof · Sales', what_you_get: 'The offer sells' },
  { gate: 2, name: 'Fuel', headline: '1 new client every month', focus: 'Content · Conversations · Tracking', what_you_get: 'Demand on purpose' },
  { gate: 3, name: 'Scale', headline: '2 new clients every month', focus: 'Leads · Follow-up · Hub', what_you_get: 'Demand as a system' },
  { gate: 4, name: 'Supercharge', headline: '4 inbound a month', focus: 'Systems · Reporting · Retention', what_you_get: 'Demand comes to you' },
];

export const ROMAN = ['', 'I', 'II', 'III', 'IV'] as const;

/** Which gate each roadmap module first belongs to (mirrors playbook_gate_modules). */
export const MODULE_GATE: Record<string, GateNumber> = {
  O1: 1, O2: 1, O3: 1, C1: 1, C2: 1, C3: 1, D1: 1, D2: 1,
  D3: 2,
  C4: 3, O6: 3, D4: 3,
  O4: 4, O5: 4, C5: 4, C6: 4, D5: 4, D6: 4,
};

const GATE_NAMES: Record<string, GateNumber> = { fix: 1, fuel: 2, scale: 3, supercharge: 4 };

/** "Gate 3 (Scale)", "3", "Scale" → 3. Null when no gate is set. */
export function gateNumber(gate?: string | null): GateNumber | null {
  const text = String(gate ?? '');
  const digit = text.match(/[1-4]/);
  if (digit) return Number(digit[0]) as GateNumber;
  const named = Object.keys(GATE_NAMES).find(name => text.toLowerCase().includes(name));
  return named ? GATE_NAMES[named] : null;
}

/** The label stored in profiles.gate, e.g. "Gate 2 (Fuel)". */
export function gateLabel(gate: GateNumber): string {
  return `Gate ${gate} (${GATES[gate - 1].name})`;
}

/** 'YYYY-MM' for the given date, in the member's local calendar. */
export function monthKey(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export function periodFor(kind: TaskKind, month = monthKey()): string {
  return kind === 'monthly' ? month : 'once';
}

/** Merges a gate's tasks with the member's progress for the current period. */
export function withStatus(tasks: GrowthHubTask[], progress: TaskProgress[], month = monthKey(), tracking: TaskTracking[] = []): TaskWithStatus[] {
  return tasks
    .filter(task => task.active)
    .sort((a, b) => a.position - b.position)
    .map(task => {
      const period = periodFor(task.kind, month);
      const row = progress.find(p => p.task_id === task.id && p.period === period) ?? null;
      const track = tracking.find(t => t.task_id === task.id && t.period === period) ?? null;
      return { ...task, period, status: row?.status ?? 'open', progress: row, tracking: track };
    });
}

/**
 * Needs-changes first (Dan sent it back), then the first open task the member can do themselves.
 * Tasks they've marked "working on it" step aside so the next move is the one below; if every open
 * task is being worked on, it falls back to the first of those.
 */
export function nextTask(tasks: TaskWithStatus[]): TaskWithStatus | null {
  return tasks.find(t => t.status === 'needs_changes')
    ?? tasks.find(t => t.status === 'open' && t.kind !== 'kickoff' && !isWorking(t))
    ?? tasks.find(t => t.status === 'open' && !isWorking(t))
    ?? tasks.find(t => t.status === 'open')
    ?? null;
}

/** Ticked (by the member, or approved by Dan) out of the whole list. Dan can still send a tick back. */
export function buildProgress(tasks: TaskWithStatus[]): { done: number; approved: number; total: number; pct: number } {
  const total = tasks.length;
  const done = tasks.filter(t => t.status === 'submitted' || t.status === 'approved').length;
  const approved = tasks.filter(t => t.status === 'approved').length;
  return { done, approved, total, pct: total ? Math.round((done / total) * 100) : 0 };
}

export type TrainingLink = { label: string; href: string | null; external: boolean; status?: 'onboarding' | 'book' };

/**
 * Where the "training" chip points: a URL/Loom, the module page, or nothing.
 * With `hasPage`, a module with no training yet reads the same as its Roadmap
 * tile: covered in onboarding with Dan, or book a call with Dan.
 */
export function trainingLink(task: Pick<GrowthHubTask, 'module_codes' | 'training_url' | 'training_label'>, hasPage?: (code: string) => boolean): TrainingLink | null {
  if (task.training_url) return { label: task.training_label || task.module_codes[0] || 'Training', href: task.training_url, external: /^https?:/i.test(task.training_url) };
  if (task.module_codes.length) {
    const code = task.module_codes.find(c => hasPage?.(c) ?? true);
    if (code) return { label: task.module_codes.join(' + '), href: `/module/${code}`, external: false };
    if (task.module_codes.every(c => ONBOARDING_COVERED_CODES.has(c))) return { label: 'Covered in onboarding with Dan', href: null, external: false, status: 'onboarding' };
    return { label: 'Book a call with Dan', href: DAN_WHATSAPP_URL, external: true, status: 'book' };
  }
  if (task.training_label) return { label: task.training_label, href: null, external: false };
  return null;
}

/** The question the "Help me do this" button sends to Dan AI. */
export function helpPrompt(task: Pick<GrowthHubTask, 'title' | 'module_codes' | 'training_label'>): string {
  const training = task.module_codes.length ? ` (training: ${task.module_codes.join(' + ')})` : task.training_label ? ` (training: ${task.training_label})` : '';
  return `Help me do this build task step by step: "${task.title}"${training}`;
}

/**
 * The measurable monthly bars for each gate, from the confirmed build lists.
 * Fields are monthly_totals columns. A goal is "held" when it's hit 2 months running.
 */
export type GateGoal = { label: string; field: 'content_posts' | 'leads_generated' | 'new_clients'; target: number };
export const GATE_GOALS: Record<GateNumber, GateGoal[]> = {
  1: [{ label: 'Posts', field: 'content_posts', target: 4 }, { label: 'Convos', field: 'leads_generated', target: 4 }],
  2: [{ label: 'New clients', field: 'new_clients', target: 1 }, { label: 'Convos', field: 'leads_generated', target: 6 }, { label: 'Posts', field: 'content_posts', target: 8 }],
  3: [{ label: 'New clients', field: 'new_clients', target: 2 }],
  4: [{ label: 'New clients', field: 'new_clients', target: 4 }],
};
export const HOLD_MONTHS = 2;

type GoalMonth = { month: string } & Partial<Record<GateGoal['field'], number | null>>;
/** Latest value plus whether each of the last HOLD_MONTHS submissions hit the bar (newest first). */
export function goalStatus(goal: GateGoal, monthsNewestFirst: GoalMonth[]): { value: number | null; held: boolean[] } {
  const recent = monthsNewestFirst.slice(0, HOLD_MONTHS);
  return {
    value: recent[0]?.[goal.field] ?? null,
    held: Array.from({ length: HOLD_MONTHS }, (_, i) => (recent[i]?.[goal.field] ?? 0) >= goal.target),
  };
}

const GOAL_TASK: Partial<Record<GateGoal['field'], RegExp>> = { content_posts: /\b(?:posts?|videos?|reels?)\b/i, leads_generated: /\b(?:conversations?|convos?|dms?)\b/i };

/** The monthly build task that counts toward a goal: same kind of thing, same number in its title. */
export function goalTask(goal: GateGoal, tasks: TaskWithStatus[]): TaskWithStatus | null {
  const re = GOAL_TASK[goal.field];
  return re ? tasks.find(t => t.kind === 'monthly' && taskTarget(t) === goal.target && re.test(t.title)) ?? null : null;
}

/**
 * What a goal tile shows: this month's running count from the build list once they're tracking it
 * (or this month's check-in if that's higher), otherwise the latest check-in. Holding still goes off check-ins.
 */
export function liveGoalValue(goal: GateGoal, monthsNewestFirst: GoalMonth[], tasks: TaskWithStatus[], month = monthKey()): { value: number | null; tracked: boolean } {
  const { value } = goalStatus(goal, monthsNewestFirst);
  const count = goalTask(goal, tasks)?.tracking?.count ?? 0;
  if (!count) return { value, tracked: false };
  const latest = monthsNewestFirst[0];
  const checkedIn = latest?.month.startsWith(month) ? latest[goal.field] ?? 0 : 0;
  return { value: Math.max(count, checkedIn), tracked: count >= checkedIn };
}

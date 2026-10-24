import { describe, expect, it } from 'vitest';
import {
  buildProgress, gateLabel, gateNumber, goalStatus, helpPrompt, nextTask, trainingLink, withStatus,
  GATE_GOALS, type GrowthHubTask, type TaskProgress,
} from './growthHub';

const task = (over: Partial<GrowthHubTask>): GrowthHubTask => ({
  id: 't', gate: 2, position: 1, title: 'Task', why: '', kind: 'once', module_codes: [],
  training_label: null, training_url: null, proof_hint: '', active: true, ...over,
});
const done = (task_id: string, period: string, status: TaskProgress['status'], review_note: string | null = null): TaskProgress => ({
  user_id: 'u', task_id, period, status, proof_url: null, member_note: null, review_note,
});

describe('gateNumber', () => {
  it('reads every label style profiles.gate has used', () => {
    expect(gateNumber('Gate 3 (Scale)')).toBe(3);
    expect(gateNumber('2')).toBe(2);
    expect(gateNumber('Supercharge')).toBe(4);
    expect(gateNumber('gate 4')).toBe(4);
  });
  it('is null when no gate is set', () => {
    expect(gateNumber(null)).toBeNull();
    expect(gateNumber('')).toBeNull();
  });
  it('round-trips with gateLabel', () => {
    for (const g of [1, 2, 3, 4] as const) expect(gateNumber(gateLabel(g))).toBe(g);
  });
});

describe('withStatus', () => {
  const tasks = [
    task({ id: 'a', position: 2, kind: 'monthly' }),
    task({ id: 'b', position: 1, kind: 'once' }),
    task({ id: 'c', position: 3, active: false }),
  ];
  it('sorts by position, drops hidden tasks and uses the right period', () => {
    const rows = withStatus(tasks, [done('a', '2026-09', 'approved'), done('b', 'once', 'submitted')], '2026-10');
    expect(rows.map(r => r.id)).toEqual(['b', 'a']);
    expect(rows[0].status).toBe('submitted');
    // Last month's approval doesn't count for this month's monthly task.
    expect(rows[1]).toMatchObject({ period: '2026-10', status: 'open' });
  });
});

describe('nextTask', () => {
  it('puts work Dan sent back first', () => {
    const rows = withStatus([task({ id: 'a', position: 1 }), task({ id: 'b', position: 2 })], [done('b', 'once', 'needs_changes', 'fix the link')]);
    expect(nextTask(rows)?.id).toBe('b');
  });
  it('skips kickoff tasks the member cannot do themselves', () => {
    const rows = withStatus([task({ id: 'k', position: 1, kind: 'kickoff' }), task({ id: 'b', position: 2 })], []);
    expect(nextTask(rows)?.id).toBe('b');
  });
  it('is null when everything is in or approved', () => {
    const rows = withStatus([task({ id: 'a' })], [done('a', 'once', 'submitted')]);
    expect(nextTask(rows)).toBeNull();
  });
});

describe('buildProgress', () => {
  it('counts the member\'s ticks and Dan\'s approvals, not work sent back', () => {
    const rows = withStatus([task({ id: 'a' }), task({ id: 'b' }), task({ id: 'c' }), task({ id: 'd' })],
      [done('a', 'once', 'approved'), done('b', 'once', 'submitted'), done('c', 'once', 'needs_changes')]);
    expect(buildProgress(rows)).toEqual({ done: 2, approved: 1, total: 4, pct: 50 });
  });
});

describe('goalStatus', () => {
  const posts = GATE_GOALS[2].find(g => g.label === 'Posts')!;
  it('shows the latest value and whether each of the last 2 months hit the bar', () => {
    const r = goalStatus(posts, [{ month: '2026-10-01', content_posts: 7 }, { month: '2026-09-01', content_posts: 9 }]);
    expect(r).toEqual({ value: 7, held: [false, true] });
  });
  it('handles no submissions', () => {
    expect(goalStatus(posts, [])).toEqual({ value: null, held: [false, false] });
  });
});

describe('trainingLink', () => {
  it('prefers an explicit link, then the module page', () => {
    expect(trainingLink(task({ training_url: 'https://loom.com/x', training_label: 'Hot List walkthrough' }))).toEqual({ label: 'Hot List walkthrough', href: 'https://loom.com/x', external: true });
    expect(trainingLink(task({ module_codes: ['C1', 'C2'] }))).toEqual({ label: 'C1 + C2', href: '/module/C1', external: false });
    expect(trainingLink(task({ training_label: 'DM scripts' }))).toEqual({ label: 'DM scripts', href: null, external: false });
    expect(trainingLink(task({}))).toBeNull();
  });
});

describe('helpPrompt', () => {
  it('names the task and its training for Dan AI', () => {
    expect(helpPrompt(task({ title: 'Post 8 times', module_codes: ['C1'] }))).toBe('Help me do this build task step by step: "Post 8 times" (training: C1)');
  });
});

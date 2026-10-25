import { describe, expect, it } from 'vitest';
import {
  buildProgress, gateLabel, gateNumber, goalStatus, helpPrompt, isWorking, nextTask, taskTarget, trainingLink, withStatus,
  GATE_GOALS, type GrowthHubTask, type TaskProgress, type TaskTracking,
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
  const track = (task_id: string, working: boolean, count = 0, period = '2026-10'): TaskTracking => ({ task_id, period, working, count });
  it('moves past a monthly task the member is working on', () => {
    const tasks = [task({ id: 'posts', position: 1, kind: 'monthly' }), task({ id: 'convos', position: 2, kind: 'monthly' })];
    const rows = withStatus(tasks, [], '2026-10', [track('posts', true, 5)]);
    expect(isWorking(rows[0])).toBe(true);
    expect(rows[0].tracking?.count).toBe(5);
    expect(nextTask(rows)?.id).toBe('convos');
  });
  it('a count logged last month does not carry over', () => {
    const rows = withStatus([task({ id: 'posts', kind: 'monthly' })], [], '2026-10', [track('posts', true, 8, '2026-09')]);
    expect(isWorking(rows[0])).toBe(false);
  });
  it('falls back to a task being worked on when every open task is', () => {
    const rows = withStatus([task({ id: 'posts', kind: 'monthly' })], [], '2026-10', [track('posts', true)]);
    expect(nextTask(rows)?.id).toBe('posts');
  });
  it('is null when everything is in or approved', () => {
    const rows = withStatus([task({ id: 'a' })], [done('a', 'once', 'submitted')]);
    expect(nextTask(rows)).toBeNull();
  });
});

describe('taskTarget', () => {
  it('reads the monthly number from the title', () => {
    expect(taskTarget({ kind: 'monthly', title: 'Post 8 times a month' })).toBe(8);
    expect(taskTarget({ kind: 'monthly', title: 'Have 6 retainer conversations' })).toBe(6);
    expect(taskTarget({ kind: 'monthly', title: 'Start 10 DMs with ideal clients' })).toBe(10);
    // The real build-list titles.
    expect(taskTarget({ kind: 'monthly', title: 'Post 4 BTS videos on your Instagram and put a $50 profile-visit boost behind each' })).toBe(4);
    expect(taskTarget({ kind: 'monthly', title: 'Have 4 retainer conversations (1 a week) and log them in your Hot List' })).toBe(4);
    expect(taskTarget({ kind: 'monthly', title: 'Post 8 times on your own Instagram (2 a week) and add your best ones to awareness' })).toBe(8);
    expect(taskTarget({ kind: 'monthly', title: 'Have 6 retainer conversations using the DM scripts and log them in your Hot List' })).toBe(6);
    expect(taskTarget({ kind: 'monthly', title: 'Call every lead within 15–30 mins and update your ad tracking sheet weekly' })).toBeNull();
  });
  it('is null for one-off tasks or titles without a count', () => {
    expect(taskTarget({ kind: 'once', title: 'Post 8 times' })).toBeNull();
    expect(taskTarget({ kind: 'monthly', title: 'Update your tracker' })).toBeNull();
    expect(taskTarget({ kind: 'monthly', title: 'Send 1 case study' })).toBeNull();
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

describe('trainingLink matches the Roadmap tiles', () => {
  const t = (codes: string[]) => ({ module_codes: codes, training_url: null, training_label: null });
  it('links modules with training, flags onboarding ones and books a call for the rest', () => {
    const hasPage = (c: string) => c === 'C1';
    expect(trainingLink(t(['C1']), hasPage)?.href).toBe('/module/C1');
    expect(trainingLink(t(['O1']), hasPage)).toMatchObject({ label: 'Covered in onboarding with Dan', href: null, status: 'onboarding' });
    expect(trainingLink(t(['D4']), hasPage)).toMatchObject({ label: 'Book a call with Dan', external: true, status: 'book' });
  });
});

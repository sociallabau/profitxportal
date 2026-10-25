import { describe, expect, it } from 'vitest';
import { gateHealth } from './gateHealth';
import type { GrowthHubTask, TaskProgress } from './growthHub';

const task = (id: string, kind: GrowthHubTask['kind'] = 'once'): GrowthHubTask => ({ id, gate: 1, position: Number(id), title: `T${id}`, why: '', kind, module_codes: [], training_label: null, training_url: null, proof_hint: '', active: true });
const prog = (task_id: string, status: TaskProgress['status'], period = 'once'): TaskProgress => ({ user_id: 'u', task_id, period, status, proof_url: null, member_note: null, review_note: null });
const tasks = [task('1'), task('2'), task('3', 'monthly')];

describe('gateHealth', () => {
  it('counts ticks waiting on Dan and sent-back tasks', () => {
    const h = gateHealth(1, tasks, [prog('1', 'approved'), prog('2', 'submitted'), prog('3', 'needs_changes', '2026-10')], [], '2026-10');
    expect(h.build).toMatchObject({ approved: 1, total: 3 });
    expect(h.toApprove).toBe(1);
    expect(h.sentBack).toBe(1);
    expect(h.readyToMoveUp).toBe(false);
  });
  it('is ready to move up when the bars are held 2 months', () => {
    const months = [{ month: '2026-10-01', content_posts: 5, leads_generated: 4 }, { month: '2026-09-01', content_posts: 4, leads_generated: 6 }];
    const h = gateHealth(1, tasks, [prog('1', 'approved'), prog('2', 'approved'), prog('3', 'approved', '2026-10')], months, '2026-10');
    expect(h.goalsHeld).toBe(true);
    expect(h.readyToMoveUp).toBe(true);
    expect(h.buildApproved).toBe(true);
  });
  it('flags ready to move up even with build tasks still open, so Dan can decide', () => {
    const months = [{ month: '2026-10-01', content_posts: 5, leads_generated: 4 }, { month: '2026-09-01', content_posts: 4, leads_generated: 6 }];
    const h = gateHealth(1, tasks, [], months, '2026-10');
    expect(h.readyToMoveUp).toBe(true);
    expect(h.buildApproved).toBe(false);
  });
  it('counts this month live from the build-list tallies before the check-in is in', () => {
    const live = [
      { ...task('4', 'monthly'), title: 'Post 4 BTS videos on your Instagram' },
      { ...task('5', 'monthly'), title: 'Have 4 retainer conversations (1 a week)' },
    ];
    const tracking = [{ task_id: '4', period: '2026-10', working: true, count: 4 }, { task_id: '5', period: '2026-10', working: true, count: 4 }];
    const sept = [{ month: '2026-09-01', content_posts: 4, leads_generated: 5 }];
    const h = gateHealth(1, live, [], sept, '2026-10', { tracking });
    expect(h.hitThisMonth).toBe(true);
    // September's check-in + October live = 2 months running.
    expect(h.goalsHeld).toBe(true);
    expect(h.readyToMoveUp).toBe(true);
    // One month on its own is a hit, not a move-up.
    const first = gateHealth(1, live, [], [], '2026-10', { tracking });
    expect(first).toMatchObject({ hitThisMonth: true, readyToMoveUp: false });
  });
  it('counts new clients logged this month toward the new-client goal', () => {
    const h = gateHealth(3, [], [], [], '2026-10', { newClientsThisMonth: 2 });
    expect(h.hitThisMonth).toBe(true);
    expect(h.goals[0]).toMatchObject({ label: 'New clients', live: 2 });
  });
  it('lists the bars they are behind on', () => {
    expect(gateHealth(1, tasks, [], [{ month: '2026-10-01', content_posts: 2, leads_generated: 5 }], '2026-10').behind).toEqual(['Posts 2/4']);
  });
});

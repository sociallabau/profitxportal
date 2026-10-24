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
  it('is ready to move up when every task is approved and the bars are held 2 months', () => {
    const months = [{ month: '2026-10-01', content_posts: 5, leads_generated: 4 }, { month: '2026-09-01', content_posts: 4, leads_generated: 6 }];
    const h = gateHealth(1, tasks, [prog('1', 'approved'), prog('2', 'approved'), prog('3', 'approved', '2026-10')], months, '2026-10');
    expect(h.goalsHeld).toBe(true);
    expect(h.readyToMoveUp).toBe(true);
  });
  it('lists the bars they are behind on', () => {
    expect(gateHealth(1, tasks, [], [{ month: '2026-10-01', content_posts: 2, leads_generated: 5 }], '2026-10').behind).toEqual(['Posts 2/4']);
  });
});

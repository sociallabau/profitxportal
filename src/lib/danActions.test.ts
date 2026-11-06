import { describe, expect, it } from 'vitest';
import { matchBuildTask, canMarkWorking, validIdea, resolveTaskProgress } from '../../supabase/functions/ask-dan/actions';
import type { BuildTask } from '../../supabase/functions/ask-dan/dossier';

const openOnce: BuildTask = { id: 't-once', title: 'Post your first reel', kind: 'once', training: null, status: 'open', review_note: null };
const openMonthly: BuildTask = { id: 't-monthly', title: 'Post 8 times this month', kind: 'monthly', training: null, status: 'open', review_note: null };
const approved: BuildTask = { id: 't-done', title: 'Set up your Instagram bio', kind: 'once', training: null, status: 'approved', review_note: null };
const noId: BuildTask = { title: 'Legacy task with no id', kind: 'once', training: null, status: 'open', review_note: null };
const build = [openOnce, openMonthly, approved, noId];

describe('matchBuildTask', () => {
  it('matches case- and whitespace-insensitively', () => {
    expect(matchBuildTask(build, '  post your FIRST reel ')).toBe(openOnce);
  });
  it('returns null for no match or empty title', () => {
    expect(matchBuildTask(build, 'Nonexistent task')).toBeNull();
    expect(matchBuildTask(build, '')).toBeNull();
  });
});

describe('canMarkWorking', () => {
  it('only an open task can be marked working-on', () => {
    expect(canMarkWorking(openOnce)).toBe(true);
    expect(canMarkWorking(approved)).toBe(false);
    expect(canMarkWorking(null)).toBe(false);
  });
});

describe('validIdea', () => {
  it('accepts real text, rejects junk', () => {
    expect(validIdea('Do a BTS reel about the new office')).toBe(true);
    expect(validIdea('hi')).toBe(false);
    expect(validIdea('')).toBe(false);
    expect(validIdea(null)).toBe(false);
    expect(validIdea('x'.repeat(2001))).toBe(false);
  });
});

describe('resolveTaskProgress', () => {
  const today = new Date('2026-11-07T00:00:00Z');

  it('resolves an open once-off task to period "once"', () => {
    expect(resolveTaskProgress(build, { task_title: 'Post your first reel' }, today))
      .toEqual({ taskId: 't-once', period: 'once', count: undefined });
  });

  it('resolves an open monthly task to the current month key', () => {
    expect(resolveTaskProgress(build, { task_title: 'Post 8 times this month', count: 5 }, today))
      .toEqual({ taskId: 't-monthly', period: '2026-11', count: 5 });
  });

  it('refuses a task that is not open (already approved)', () => {
    expect(resolveTaskProgress(build, { task_title: 'Set up your Instagram bio' }, today)).toBeNull();
  });

  it('refuses an unmatched title', () => {
    expect(resolveTaskProgress(build, { task_title: 'Made up task' }, today)).toBeNull();
  });

  it('refuses a matched task with no id to write to', () => {
    expect(resolveTaskProgress(build, { task_title: 'Legacy task with no id' }, today)).toBeNull();
  });

  it('refuses a null intent', () => {
    expect(resolveTaskProgress(build, null, today)).toBeNull();
  });

  it('ignores a negative or non-numeric count rather than writing garbage', () => {
    expect(resolveTaskProgress(build, { task_title: 'Post your first reel', count: -3 }, today)!.count).toBeUndefined();
  });
});

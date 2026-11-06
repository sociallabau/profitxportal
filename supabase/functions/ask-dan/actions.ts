/**
 * What Dan AI is actually allowed to DO, not just advise on. The model states intent as a
 * plain JSON field on its answer, the same way it already returns every other structured
 * field — nothing here is Anthropic tool-calling. Code always decides whether to trust it:
 * never execute on the model's say-so alone.
 *
 * Scope, deliberately narrow:
 * - task_progress: mark a build task "working on it" (member_task_tracking). Never marks a
 *   task done or approved — only Dan's own review does that, and "submitted" status requires
 *   WhatsApp proof to him by design, so chat can never set that either.
 * - save_idea: save a brainstormed content idea in the member's own words. Never touches
 *   saved_ideas (that table is a swipe-file of outlier videos with source_url/transcript
 *   fields, not freeform notes) — it writes to dan_ai_saved_ideas instead.
 *
 * Both are MEMBER-mode only: never in ADMIN mode (looking at someone else's account) or TEST
 * mode (a persona, no real database row to touch).
 */
import { monthKey, type BuildTask } from "./dossier.ts";

export type TaskProgressIntent = { task_title: string; count?: number } | null;
export type SaveIdeaIntent = string | null;

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

/** Loose match on title: the model quotes it from the GATE BUILD LIST block it was given, not a raw id. */
export function matchBuildTask(build: BuildTask[], title: string): BuildTask | null {
  const t = norm(title);
  if (!t) return null;
  return build.find(b => norm(b.title) === t) ?? null;
}

/** Only a task still "open" makes sense to mark working-on: approved/submitted/needs_changes are Dan's calls. */
export function canMarkWorking(task: BuildTask | null): task is BuildTask {
  return !!task && task.status === "open";
}

/** Real text worth keeping, not an empty or junk string. */
export function validIdea(idea: unknown): idea is string {
  return typeof idea === "string" && idea.trim().length >= 3 && idea.trim().length <= 2000;
}

export type ResolvedTaskProgress = { taskId: string; period: string; count: number | undefined };

/** Pure resolution: the task id + period to upsert, or null when the intent doesn't check out. */
export function resolveTaskProgress(build: BuildTask[], intent: TaskProgressIntent, today = new Date()): ResolvedTaskProgress | null {
  if (!intent) return null;
  const task = matchBuildTask(build, intent.task_title);
  if (!canMarkWorking(task) || !task.id) return null;
  const period = task.kind === "monthly" ? monthKey(today) : "once";
  return { taskId: task.id, period, count: typeof intent.count === "number" && intent.count >= 0 ? Math.round(intent.count) : undefined };
}

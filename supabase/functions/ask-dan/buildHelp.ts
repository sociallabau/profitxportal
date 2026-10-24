/**
 * "Help me do this" on a build task. Pulls the task, what Dan wants as proof
 * and the full content of its training modules, so the answer can walk the
 * member through building it with the exact material they need.
 */

import { nextBuildTask, type BuildTask } from "./dossier.ts";

const HELP_RE = /^Help me do this build task step by step: "(.+?)"/;

/** The task title from the Growth Hub "Help me do this" question, or null. */
export function buildTaskTitle(question: string): string | null {
  return question.trim().match(HELP_RE)?.[1] ?? null;
}

type Section = { type?: string; label?: string; title?: string; text?: string; url?: string; items?: unknown; steps?: unknown };
const itemText = (i: unknown): string =>
  typeof i === "string" ? i : i && typeof i === "object" ? String((i as Record<string, unknown>).text ?? (i as Record<string, unknown>).title ?? (i as Record<string, unknown>).label ?? "") : "";

/** module_pages.sections as plain text the model can read. */
export function sectionsText(sections: unknown, cap = 3000): string {
  const out: string[] = [];
  for (const s of (Array.isArray(sections) ? sections : []) as Section[]) {
    const head = s.title ?? s.label;
    if (head) out.push(`## ${head}`);
    if (s.text) out.push(s.text);
    if (Array.isArray(s.items)) out.push(...s.items.map(i => `- ${itemText(i)}`).filter(l => l.length > 2));
    if (Array.isArray(s.steps)) out.push(...s.steps.map((st, n) => `${n + 1}. ${itemText(st)}`));
    if (s.url && /link|template|resource|download/i.test(s.type ?? "")) out.push(`(${s.label ?? s.title ?? "Resource"} is linked on the module page)`);
  }
  const text = out.join("\n");
  return text.length > cap ? `${text.slice(0, cap)}…` : text;
}

// deno-lint-ignore no-explicit-any
type DB = any;

/** "What should I focus on?", "not sure what to do this week": answered with their next build task, walked through. */
export function isFocusQuestion(question: string): boolean {
  return /\bfocus\b|what (should|do|can) i (do|work on|be doing|tackle)|work on|next (step|move|thing)|this week|today|where (do|should) i start|priorit|what now|not sure what|what'?s next|stuck on what/i.test(question);
}

/**
 * The build task this question is about, with its proof and full training content:
 * the task named in "Help me do this", or for a focus question their next build task.
 */
export async function loadBuildHelp(admin: DB, question: string, gate: number | null, build: BuildTask[] = []): Promise<string | null> {
  const next = !buildTaskTitle(question) && isFocusQuestion(question) ? nextBuildTask(build) : null;
  const title = buildTaskTitle(question) ?? next?.title;
  if (!title) return null;
  let q = admin.from("playbook_tasks").select("title, why, kind, module_codes, training_label, proof_hint, gate").eq("title", title).eq("active", true);
  if (gate) q = q.eq("gate", gate);
  const { data: task } = await q.limit(1).maybeSingle();
  if (!task) return null;
  const codes = (task.module_codes ?? []) as string[];
  const { data: modules } = codes.length
    ? await admin.from("module_pages").select("module_id, title, subtitle, sections").in("module_id", codes)
    : { data: [] };
  const L = [
    next
      ? `THEIR NEXT BUILD TASK — this is what they should focus on (Gate ${task.gate}, ${task.kind}): ${task.title}${next.status === "needs_changes" ? `\nDan sent it back${next.review_note ? `: "${next.review_note}"` : ""}. Fix that first.` : ""}`
      : `BUILD TASK THEY'RE DOING (Gate ${task.gate}, ${task.kind}): ${task.title}`,
    task.why && `Why it matters: ${task.why}`,
    task.proof_hint && `Proof Dan wants, sent to him on WhatsApp: ${task.proof_hint}`,
    task.training_label && !codes.length && `Training: ${task.training_label}`,
  ].filter(Boolean) as string[];
  for (const m of (modules ?? []) as { module_id: string; title: string; subtitle: string | null; sections: unknown }[]) {
    L.push("", `MODULE ${m.module_id} — ${m.title}${m.subtitle ? ` (${m.subtitle})` : ""} (on their Roadmap at /module/${m.module_id})`, sectionsText(m.sections));
  }
  return L.join("\n");
}

/**
 * Outcome-based member drift detection for the admin Client Health page.
 *
 * Deliberately ignores call/workshop attendance — members watch replays, so
 * attendance says nothing. Drift is judged only on whether the numbers that
 * should be moving for a member's phase have stalled:
 *
 *   1. Flat core metric — revenue flat (±5%) or down across the last 2–3
 *                        monthly submissions.
 *   2. Submission gap  — no monthly report in 45+ days.
 *   3. Sentiment pulse — self-rated "how's it going" (business_confidence)
 *                        of 4 or less, or a drop of 2+ vs their previous score.
 *
 * Module/checklist progress is deliberately NOT a signal — the program is not
 * based around module completion.
 *
 * Pure functions, no JSX and no hooks, so the rules can be tested and changed
 * without touching the page.
 */

export type DriftBand = 'green' | 'amber' | 'red';

export type DriftResult = {
  band: DriftBand;
  /** Human-readable reasons, e.g. "Revenue flat 3 months". */
  signals: string[];
};

export type DriftInput = {
  /** Revenue per submission, newest first. */
  revenueSeries: number[];
  /** Days since their last monthly_totals row, null if never submitted. */
  daysSinceSubmission: number | null;
  /** business_confidence per submission, newest first (nulls allowed). */
  confidenceSeries: (number | null)[];
};

export const SUBMISSION_GAP_DAYS = 45;
export const LOW_CONFIDENCE_SCORE = 4;
export const CONFIDENCE_DROP = 2;
/** Revenue within ±5% counts as flat. */
export const FLAT_TOLERANCE = 0.05;

/** profiles.gate stores labels like "Gate 3 (Scale)" — pull the number out. */
export function gateNumber(gate?: string | null): '1' | '2' | '3' {
  const match = String(gate ?? '').match(/[123]/);
  return (match?.[0] as '1' | '2' | '3') ?? '1';
}

/** True when the newest 2–3 revenues are all flat or declining. */
export function isFlatOrDeclining(revenueSeries: number[]): boolean {
  const recent = revenueSeries.filter(v => v > 0).slice(0, 3);
  if (recent.length < 2) return false;
  for (let i = 0; i < recent.length - 1; i++) {
    const newer = recent[i];
    const older = recent[i + 1];
    // Growing beyond tolerance breaks the stall.
    if (newer > older * (1 + FLAT_TOLERANCE)) return false;
  }
  return true;
}

export function computeDrift(input: DriftInput, now: Date = new Date()): DriftResult {
  void now; // callers pre-compute day counts; kept for a stable signature
  const signals: string[] = [];

  // 1. Flat or declining core metric
  if (isFlatOrDeclining(input.revenueSeries)) {
    const months = Math.min(input.revenueSeries.filter(v => v > 0).length, 3);
    signals.push(`Revenue flat ${months} month${months === 1 ? '' : 's'}`);
  }

  // 2. Submission gap
  if (input.daysSinceSubmission === null) {
    signals.push('Never submitted a monthly report');
  } else if (input.daysSinceSubmission > SUBMISSION_GAP_DAYS) {
    signals.push(`No submission ${input.daysSinceSubmission} days`);
  }

  // 4. Sentiment pulse
  const scores = input.confidenceSeries.filter((v): v is number => v !== null && v !== undefined);
  const [latest, previous] = scores;
  if (latest !== undefined && latest <= LOW_CONFIDENCE_SCORE) {
    signals.push(`Confidence ${latest}/10`);
  } else if (latest !== undefined && previous !== undefined && previous - latest >= CONFIDENCE_DROP) {
    signals.push(`Confidence dropped ${previous}→${latest}`);
  }

  const band: DriftBand = signals.length >= 2 ? 'red' : signals.length === 1 ? 'amber' : 'green';
  return { band, signals };
}

export const DRIFT_BAND = {
  green: { bg: 'bg-green-500/10', border: 'border-green-500/30', text: 'text-green-400', dot: 'bg-green-400', label: 'Steady' },
  amber: { bg: 'bg-yellow-500/10', border: 'border-yellow-500/30', text: 'text-yellow-400', dot: 'bg-yellow-400', label: 'Watch' },
  red:   { bg: 'bg-red-500/10', border: 'border-red-500/30', text: 'text-red-400', dot: 'bg-red-400', label: 'Needs Support' },
} as const;

/**
 * Dan's rules a question always has to carry, picked in code from the question
 * and the member's numbers. The draft and the checker both get them as MUST SAY,
 * so wording gets tightened around them instead of them being cut for length.
 */

export type MustSayInput = { question: string; gate: number | null; revenue: number | null; hasContext: boolean; hasMember: boolean };

const money = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;

/** "Gate 2 · Fuel" or "Gate II" -> 2. */
export function gateFromLabel(label: string | null | undefined): number | null {
  const m = label?.match(/gate\s*(\d|iv|i{1,3})\b/i);
  if (!m) return null;
  const v = m[1].toLowerCase();
  return /\d/.test(v) ? Number(v) : ({ i: 1, ii: 2, iii: 3, iv: 4 } as Record<string, number>)[v] ?? null;
}

export function mustSay({ question, gate, revenue, hasContext, hasMember }: MustSayInput): string[] {
  const q = question.toLowerCase();
  const out: string[] = [];
  const freeWork = /\bfree\b|for nothing|unpaid|trial (month|client)|case stud|testimonial/.test(q);
  const workload = /hire|hiring|editor|outsourc|va\b|assistant|overwhelm|burn(ed|t)? ?out|too busy|no time|drowning|workload|boundar|scope|extra|weekend|capacity/.test(q);
  const adsMoney = /\bads?\b|ad spend|budget|boost|awareness|lead gen|campaign|save (money|cash)|cut (back|costs)|switch off|turn off|pause/.test(q);
  const path = /\bgate\b|next step|what (should|do) i (focus|do)|where (am i|do i start)|path|roadmap|what'?s next|level up|move up/.test(q);
  const revenueNote = revenue != null && revenue > 0 ? `, against their ~${money(revenue)}/mo now` : "";

  if (workload || freeWork) out.push(`Editor/outsourcing cue is ~$15–20k/mo revenue${revenueNote}.`);
  if (freeWork) {
    out.push("Case studies go on THEIR OWN account, not the client's.");
    out.push("Ad spend sits on top of the fee, through the client's own ad account.");
  }
  if (freeWork || adsMoney || workload) out.push("Never switch off awareness/lead gen to save cash; keep awareness running.");
  if (path && (gate == null || gate <= 1)) out.push("Below or at Gate 1: put a ~$50 profile-visit boost behind their best posts; awareness ads come at Gate 2.");
  if (hasMember && !hasContext) out.push("Their Context Room is empty: give Dan's defaults and end with one line asking them to fill in their Context Room.");
  return out;
}

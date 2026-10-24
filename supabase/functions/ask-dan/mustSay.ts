/**
 * Dan's rules a question always has to carry, picked in code from the question
 * and the member's numbers. The draft and the checker both get them as MUST SAY,
 * and each has a test so code can tell when a final answer still leaves one out.
 */

export type MustSayInput = {
  question: string; gate: number | null; revenue: number | null; hasContext: boolean; hasMember: boolean;
  costPerClient?: number | null; lowestPrice?: number | null; fastTrack?: boolean;
};
export type Rule = { say: string; short: string; test: RegExp };

const money = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;
const WORDS: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5 };

/** "Gate 2 · Fuel" or "Gate II" -> 2. */
export function gateFromLabel(label: string | null | undefined): number | null {
  const m = label?.match(/gate\s*(\d|iv|i{1,3})\b/i);
  if (!m) return null;
  const v = m[1].toLowerCase();
  return /\d/.test(v) ? Number(v) : ({ i: 1, ii: 2, iii: 3, iv: 4 } as Record<string, number>)[v] ?? null;
}

/** "I've got 2 retainers" -> 2, when the question states it plainly and none are free. */
export function statedRetainers(question: string): number | null {
  if (/\bfree\b/i.test(question)) return null;
  const m = question.match(/\b(\d|one|two|three|four|five)\s+(?:paying\s+)?(?:retainers?|retainer clients)\b/i);
  return m ? (WORDS[m[1].toLowerCase()] ?? Number(m[1])) : null;
}

export function mustSay(i: MustSayInput): Rule[] {
  const q = i.question.toLowerCase();
  const out: Rule[] = [];
  const freeWork = /\bfree\b|for nothing|unpaid|trial (month|client)|no charge/.test(q);
  const caseStudy = /case stud|testimonial/.test(q);
  const workload = /hire|hiring|editor|outsourc|\bva\b|assistant|overwhelm|burn(ed|t)? ?out|too busy|no time|drowning|workload|weekend|capacity/.test(q);
  const adsMoney = /\bads?\b|ad spend|budget|boost|awareness|lead gen|campaign|save (money|cash)|cut (back|costs)|switch off|turn off|pause/.test(q);
  const path = /\bgate\b|next step|what (should|do) i (focus|do)|where (am i|do i start)|path|roadmap|what'?s next|level up|move up/.test(q);
  const scale = /\bscal|increase (the )?budget|raise (the )?budget|spend more|double|bump/.test(q);
  const weakCreative = /ctr\s*(of\s*)?0?\.[0-9]|0\.[0-9]+\s*%\s*ctr|one (video|creative|ad)\b|single (video|creative|ad)|low ctr|ctr (is )?(low|bad|poor)/.test(q);
  const revenueNote = i.revenue != null && i.revenue > 0 ? `, against their ~${money(i.revenue)}/mo now` : "";
  const retainers = statedRetainers(i.question);

  if (path && i.gate == null && retainers != null && retainers < 3) {
    out.push({ say: `They have ${retainers} paying retainers, so say plainly they're not at Gate 1 yet (Gate 1 = 3 paying retainers held 2 months).`, short: "you're not at Gate 1 yet (that's 3 paying retainers held 2 months)", test: /not (at |in )?gate (1|i)\b|not (at |in )?gate (1|i) yet|below gate (1|i)\b/i });
  }
  if (freeWork && (path || /\bcount|retainers?\b/.test(q))) {
    out.push({ say: "A free (or case-study) client doesn't count toward the gate: only PAYING monthly retainers count.", short: "free clients don't count, only paying retainers", test: /(doesn'?t|don'?t|does not|do not|won'?t|isn'?t|not) count/i });
    out.push({ say: "Make point 1 their priority: landing the next PAYING retainer (case studies support that, they don't replace it).", short: "your priority is landing the next paying retainer", test: /(next|another|one more|3rd|third) paying (retainer|client)|land(ing)? (your |the |a |one more |another )?(next |3rd |third )?paying/i });
  }
  if (workload) out.push({ say: `Editor/outsourcing cue is ~$15–20k/mo revenue${revenueNote}.`, short: "bring on an editor at ~$15–20k/mo", test: /15\s*[–-]\s*20k/i });
  if (caseStudy) out.push({ say: "Case studies go on THEIR OWN account, not the client's.", short: "case studies go on your own account", test: /own (account|page|profile|feed|socials|instagram|ig)/i });
  if (/ad spend|ads? budget/.test(q) && /bundle|include|inside|\binto\b|\bin (my|the) (retainer|price|package|fee)/.test(q)) {
    out.push({ say: "Ad spend sits on top of the fee, through the client's own ad account.", short: "ad spend sits on top of the fee, through the client's own ad account", test: /on top of (the |your )?(fee|retainer|price)/i });
  }
  if (adsMoney && /save|cut|cash|switch off|turn off|stop/.test(q)) {
    out.push({ say: "Never switch off awareness/lead gen to save cash; keep awareness running.", short: "never switch off awareness", test: /(never|don'?t|do not)\s+(switch|turn|shut)\s+(off|it off)|(switch|turn)ing off|keep (your )?(awareness|it|boosting)\s+(running|on|going)/i });
  }
  // Someone already running lead gen is asking about that campaign, not where to start with ads.
  const alreadyRunning = /(been |i'?m |currently |we'?re )?running (lead gen|awareness|my ads|ads)\b|lead gen (has been|is) (running|live)/.test(q);
  if ((i.gate == null || i.gate <= 1) && adsMoney && !alreadyRunning) {
    out.push({ say: "Below or at Gate 1: put a ~$50 profile-visit boost behind their best posts; awareness ads come at Gate 2.", short: "for now it's a ~$50 profile-visit boost behind your best posts; awareness comes at Gate 2", test: /\$\s?50(?![\d,])(?!\s*\/\s*(day|d)\b)[^.]{0,80}\b(profile|pv|boost)|\b(profile[- ]visit|pv) boost[^.]{0,40}\$\s?50(?![\d,])(?!\s*\/)/i });
    if (/lead gen/.test(q) && /skip|straight|instead|jump|go to/.test(q)) out.push({ say: "Lead gen comes at Gate 3 (after awareness at Gate 2), unless Dan has fast-tracked them.", short: "lead gen comes at Gate 3", test: /lead gen[^.]{0,50}gate (3|iii)\b|gate (3|iii)\b[^.]{0,50}lead gen/i });
  }
  const cpc = i.costPerClient, price = i.lowestPrice;
  // Cost per client and scaling are Gate 3 steps (or Dan's lead gen fast-track); earlier gates get their own gate's step instead.
  if (adsMoney && (i.gate != null && i.gate >= 3 || i.fastTrack) && typeof cpc === "number" && Number.isFinite(cpc) && typeof price === "number" && price > 0) {
    const under = cpc < price / 2;
    out.push({ say: `Say their ~${money(cpc)} a client is ${under ? "UNDER" : "NOT under"} half their ${money(price)} first month's fee, in those words.`, short: `~${money(cpc)} a client is ${under ? "under" : "not under"} half your ${money(price)} first month`, test: under ? /under half/i : /not under half|over half|more than half/i });
    // At Gate 3 they log every lead daily in their own growth hub (built with Dan, outside the portal); cost per client comes off the CPA column on their lead tracking sheet.
    if (scale) out.push({ say: "Point them to the CPA column on their lead tracking sheet, and say scaling only works if every lead and follow-up is logged daily in their growth hub.", short: "check the CPA column on your lead tracking sheet", test: /tracking sheet|\bcpa\b/i });
    // Under half at Gate 3 means the answer is a yes-with-a-condition, not the early-stage "hold".
    if (scale && under) out.push({ say: "Stance is YES: bump the budget, as soon as every lead is called within 15–30 mins. Don't tell them to hold or wait out the week.", short: "bump it once every lead is called within 15–30 mins", test: /\b(bump|scale|raise|increase)\b[^.]{0,60}(once|as soon as|when|after)\b/i });
  }
  if (weakCreative) out.push({ say: "Weak CTR (~0.4–0.6% is the kill zone) or one creative: add 3–4 creatives to the SAME campaign; don't start a new one.", short: "add 3–4 creatives to the same campaign", test: /3\s*[–-]\s*4 (new )?(creatives|ads|videos)/i });
  if (i.hasMember && !i.hasContext) out.push({ say: "Their Context Room is empty: give Dan's defaults and end with one line asking them to fill in their Context Room.", short: "fill in your Context Room so I can make this specific", test: /context room/i });
  return out;
}

/** The rules a final answer still leaves out. */
export const missingRules = (rules: Rule[], text: string) => rules.filter(r => !r.test.test(text));

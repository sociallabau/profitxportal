/**
 * How Client Health judges a client. Two separate questions, because they were
 * being mashed into one and giving wrong answers:
 *
 *   1. Momentum  — are their numbers moving? Judged on direction against their
 *                  own previous months, never a fixed revenue/margin ladder.
 *                  Portal inactivity is NOT a negative: plenty of good clients
 *                  live on WhatsApp and calls and never log in.
 *   2. Contact   — when did Dan or Emily last actually speak to them, and is
 *                  their 90-day quarterly call coming up?
 *
 * The page surfaces the combination: "who do I need to talk to next, and why".
 * Pure functions, no JSX and no hooks, so the rules can be tested and changed
 * without touching the page.
 */

export const QUARTER_DAYS = 90;
/** A quarterly call counts as "coming up" this many days before it falls due. */
export const QUARTER_SOON_DAYS = 14;
export const DEFAULT_TOUCH_DAYS = 30;
/** Joined this recently = settling in. Not judged on numbers yet. */
export const NEW_CLIENT_DAYS = 45;
/** No monthly check-in for this long = we can't read their numbers. */
export const STALE_CHECKIN_DAYS = 50;
export const LOW_CONFIDENCE = 4;
export const CONFIDENCE_DROP = 2;
/** Revenue within ±5% of last month is flat; down more than 15% is a drop. */
export const FLAT_TOLERANCE = 0.05;
export const DROP_TOLERANCE = 0.15;

export type TouchKind = 'whatsapp' | 'call' | 'quarterly_call' | 'group_call' | 'other';

export const TOUCH_KINDS: { value: TouchKind; label: string }[] = [
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'call', label: '1:1 call' },
  { value: 'quarterly_call', label: 'Quarterly call' },
  { value: 'group_call', label: 'Group call' },
  { value: 'other', label: 'Other' },
];

export const touchLabel = (kind: string) => TOUCH_KINDS.find(k => k.value === kind)?.label ?? 'Contact';

export type Touchpoint = { kind: string; occurred_at: string };

const DAY = 24 * 60 * 60 * 1000;
/** Whole calendar days from one date to another (local days), so "100 days ago" is 100 whatever the time of day. */
const dayNumber = (d: Date) => Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / DAY;
export const daysBetween = (from: Date, to: Date) => Math.round(dayNumber(to) - dayNumber(from));
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * DAY);

// ---------- cadence ----------

/**
 * How long Dan lets a client go without contact. Explicit setting first, then what the client
 * said they wanted in their Context Room (with a little slack so "weekly" isn't flagged on day 8),
 * then every 30 days.
 */
export function touchEveryDays(explicit: number | null | undefined, contextCadence?: string | string[] | null): number {
  if (explicit) return explicit;
  const value = (Array.isArray(contextCadence) ? contextCadence[0] : contextCadence)?.toLowerCase() ?? '';
  if (value.startsWith('week')) return 10;
  if (value.startsWith('fortnight')) return 18;
  if (value.startsWith('month')) return 35;
  if (value.startsWith('only')) return 60;
  return DEFAULT_TOUCH_DAYS;
}

// ---------- contact ----------

export type ContactInfo = {
  /** Most recent contact of any kind; null if none is logged. */
  at: Date | null;
  days: number | null;
  kind: string | null;
};

export function lastContact(touchpoints: Touchpoint[], now = new Date()): ContactInfo {
  let best: { at: Date; kind: string } | null = null;
  for (const t of touchpoints) {
    const at = new Date(t.occurred_at);
    if (isNaN(at.getTime()) || at.getTime() > now.getTime() + DAY) continue;
    if (!best || at > best.at) best = { at, kind: t.kind };
  }
  return best ? { at: best.at, days: Math.max(0, daysBetween(best.at, now)), kind: best.kind } : { at: null, days: null, kind: null };
}

// ---------- quarterly call ----------

export type QuarterlyState = 'new' | 'ok' | 'soon' | 'overdue';

export type QuarterlyInfo = {
  state: QuarterlyState;
  /** When the next one falls due: last quarterly call + 90 days, or joined + 90 days. */
  dueAt: Date | null;
  /** Negative = overdue by that many days. */
  daysUntil: number | null;
  lastAt: Date | null;
  /** True when no quarterly call has ever been logged. */
  neverLogged: boolean;
};

export function quarterly(touchpoints: Touchpoint[], joinedAt: string | null | undefined, now = new Date()): QuarterlyInfo {
  const calls = touchpoints
    .filter(t => t.kind === 'quarterly_call')
    .map(t => new Date(t.occurred_at))
    .filter(d => !isNaN(d.getTime()));
  const lastAt = calls.length ? new Date(Math.max(...calls.map(d => d.getTime()))) : null;
  const joined = joinedAt ? new Date(joinedAt) : null;
  const anchor = lastAt ?? (joined && !isNaN(joined.getTime()) ? joined : null);
  if (!anchor) return { state: 'ok', dueAt: null, daysUntil: null, lastAt, neverLogged: !lastAt };
  const dueAt = addDays(anchor, QUARTER_DAYS);
  const daysUntil = daysBetween(now, dueAt);
  const state: QuarterlyState = daysUntil < 0 ? 'overdue' : daysUntil <= QUARTER_SOON_DAYS ? 'soon' : lastAt ? 'ok' : 'new';
  return { state, dueAt, daysUntil, lastAt, neverLogged: !lastAt };
}

// ---------- momentum ----------

export type Momentum = 'new' | 'rolling' | 'steady' | 'quiet' | 'watch' | 'needs_help';

export type MomentumInput = {
  /** Revenue per check-in, newest first. */
  revenueSeries: number[];
  /** business_confidence per check-in, newest first (nulls allowed). */
  confidenceSeries: (number | null)[];
  /** Days since their last monthly check-in; null if never. */
  daysSinceCheckin: number | null;
  /** Days since they joined; null if unknown. */
  daysSinceJoined: number | null;
  /** Retainers lost, per check-in, newest first. */
  retainersLostSeries?: (number | null)[];
  /** Paying retainers, per check-in, newest first. */
  activeRetainersSeries?: (number | null)[];
  /** Expenses per check-in, newest first, lined up with revenueSeries. */
  expensesSeries?: (number | null)[];
};

export type MomentumResult = { status: Momentum; reasons: string[] };

const pct = (a: number, b: number) => Math.round(((a - b) / b) * 100);

export function computeMomentum(input: MomentumInput): MomentumResult {
  const { daysSinceJoined, daysSinceCheckin } = input;
  const revenue = input.revenueSeries.filter(v => v > 0);
  const hasCheckins = input.revenueSeries.length > 0;

  // Someone who just joined is settling in. Not "bad", not judged yet.
  if (daysSinceJoined !== null && daysSinceJoined < NEW_CLIENT_DAYS) {
    return { status: 'new', reasons: [`Joined ${daysSinceJoined} day${daysSinceJoined === 1 ? '' : 's'} ago`] };
  }

  const negatives: string[] = [];
  const [latest, previous, older] = input.revenueSeries;

  if (previous && previous > 0 && latest !== undefined) {
    if (latest <= 0) negatives.push('Revenue fell to $0');
    else if (latest < previous * (1 - DROP_TOLERANCE)) {
      const twoDown = older && older > 0 && previous < older * (1 - FLAT_TOLERANCE);
      negatives.push(twoDown ? 'Revenue down 2 months running' : `Revenue down ${Math.abs(pct(latest, previous))}%`);
    }
  }
  if (revenue.length >= 3) {
    const [a, b, c] = revenue;
    const flat = (x: number, y: number) => Math.abs(x - y) <= y * FLAT_TOLERANCE;
    if (flat(a, b) && flat(b, c)) negatives.push('Revenue flat 3 months');
  }

  // Retainers are the recurring base, so losing them matters before the revenue line shows it.
  const lost = input.retainersLostSeries?.[0] ?? 0;
  const retainers = (input.activeRetainersSeries ?? []).filter((v): v is number => v !== null && v !== undefined);
  if (lost > 0) negatives.push(`Lost ${lost} retainer${lost === 1 ? '' : 's'}`);
  else if (retainers.length >= 2 && retainers[0] < retainers[1]) negatives.push(`Retainers down ${retainers[1]}→${retainers[0]}`);

  // Turning over money and keeping none of it isn't a healthy business.
  const spend = input.expensesSeries?.[0] ?? 0;
  if (latest > 0 && spend > latest) negatives.push('Spending more than they earn');

  const scores = input.confidenceSeries.filter((v): v is number => v !== null && v !== undefined);
  const [conf, prevConf] = scores;
  if (conf !== undefined && conf <= LOW_CONFIDENCE) negatives.push(`Confidence ${conf}/10`);
  else if (conf !== undefined && prevConf !== undefined && prevConf - conf >= CONFIDENCE_DROP) negatives.push(`Confidence dropped ${prevConf}→${conf}`);

  if (negatives.length >= 2) return { status: 'needs_help', reasons: negatives };
  if (negatives.length === 1) return { status: 'watch', reasons: negatives };

  // Nothing wrong in the numbers. If they haven't checked in lately we simply can't tell.
  const stale = !hasCheckins || daysSinceCheckin === null || daysSinceCheckin > STALE_CHECKIN_DAYS;
  if (stale) {
    return { status: 'quiet', reasons: [daysSinceCheckin === null ? 'No check-in yet' : `No check-in for ${daysSinceCheckin} days`] };
  }

  if (previous && previous > 0 && latest > previous * (1 + FLAT_TOLERANCE)) {
    return { status: 'rolling', reasons: [`Revenue up ${pct(latest, previous)}%`] };
  }
  return { status: 'steady', reasons: [] };
}

// ---------- Dan's read ----------

export type DanRead = 'good' | 'watch' | 'needs_help';
export const DAN_READ_STATUS: Record<DanRead, Momentum> = { good: 'rolling', watch: 'watch', needs_help: 'needs_help' };

/** What the client is shown as: Dan's own read when he's set one, otherwise what the numbers say. */
export function effectiveStatus(auto: MomentumResult, danRead: DanRead | null | undefined): { status: Momentum; overridden: boolean } {
  if (danRead && DAN_READ_STATUS[danRead]) return { status: DAN_READ_STATUS[danRead], overridden: true };
  return { status: auto.status, overridden: false };
}

// ---------- the to-do list ----------

export type Attention = {
  /** Higher = talk to them sooner. 0 = nothing needed. */
  priority: number;
  reasons: string[];
};

export type AttentionInput = {
  status: Momentum;
  contact: ContactInfo;
  quarterly: QuarterlyInfo;
  touchEveryDays: number;
  isNew: boolean;
};

/**
 * Who needs a message or a call, and why. Quiet-but-fine clients show up here
 * only because nobody has spoken to them lately, which is exactly the point:
 * the portal can't tell Dan that, only the touchpoint log can.
 */
export function attention(input: AttentionInput): Attention {
  const { status, contact, quarterly: q, touchEveryDays, isNew } = input;
  let priority = 0;
  const reasons: string[] = [];

  if (status === 'needs_help') { priority += 100; reasons.push('Needs help'); }
  else if (status === 'watch') { priority += 50; reasons.push('Watch'); }

  if (q.state === 'overdue') {
    priority += 70 + Math.min(30, Math.abs(q.daysUntil ?? 0) / 3);
    reasons.push(q.neverLogged ? 'Quarterly call: none logged' : `Quarterly call overdue ${Math.abs(q.daysUntil ?? 0)}d`);
  } else if (q.state === 'soon') {
    priority += 35;
    reasons.push(`Quarterly call in ${q.daysUntil}d`);
  }

  const limit = isNew ? Math.min(touchEveryDays, 14) : touchEveryDays;
  if (contact.days === null) {
    priority += isNew ? 40 : 45;
    reasons.push('No contact logged');
  } else if (contact.days > limit) {
    priority += 40 + Math.min(30, (contact.days - limit) / 2);
    reasons.push(`Last spoke ${contact.days}d ago`);
  }

  return { priority: Math.round(priority), reasons };
}

// ---------- display ----------

export const STATUS_STYLE: Record<Momentum, { label: string; bg: string; border: string; text: string; dot: string }> = {
  rolling:    { label: 'Rolling',    bg: 'bg-green-500/10',  border: 'border-green-500/30',  text: 'text-success',      dot: 'bg-green-400' },
  steady:     { label: 'Steady',     bg: 'bg-green-500/10',  border: 'border-green-500/30',  text: 'text-success',      dot: 'bg-green-400' },
  new:        { label: 'New',        bg: 'bg-blue-500/10',   border: 'border-blue-500/30',   text: 'text-blue-600',     dot: 'bg-blue-400' },
  quiet:      { label: 'Quiet',      bg: 'bg-slate-500/10',  border: 'border-slate-500/30',  text: 'text-slate-600',    dot: 'bg-slate-400' },
  watch:      { label: 'Watch',      bg: 'bg-yellow-500/10', border: 'border-yellow-500/30', text: 'text-amber-600',    dot: 'bg-yellow-400' },
  needs_help: { label: 'Needs help', bg: 'bg-red-500/10',    border: 'border-red-500/30',    text: 'text-destructive',  dot: 'bg-red-400' },
};

export function describeQuarterly(q: QuarterlyInfo): string {
  if (!q.dueAt || q.daysUntil === null) return '—';
  if (q.state === 'overdue') return q.neverLogged ? 'None logged' : `Overdue ${Math.abs(q.daysUntil)}d`;
  return q.daysUntil === 0 ? 'Due today' : `In ${q.daysUntil}d`;
}

export const formatShortDate = (d: Date | null) =>
  d ? d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' }) : '—';

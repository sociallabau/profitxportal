/**
 * How Client Health judges a client. Two separate questions, because they were
 * being mashed into one and giving wrong answers:
 *
 *   1. Momentum  — are their numbers moving? Judged on direction against their
 *                  own previous months, never a fixed revenue/margin ladder.
 *   2. Contact   — when did Dan or Emily last actually speak to them, are they
 *                  answering, and is their 90-day quarterly call coming up?
 *
 * Everything lands in one of five buckets so the page can show only who needs
 * someone: Act now, Reach out, Quarterly call, Settling in — and "good", which
 * the page hides. Portal logins are never a warning on their own: plenty of
 * good clients live on WhatsApp and never log in. They only count when a client
 * has also stopped answering.
 *
 * Pure functions, no JSX and no hooks, so the rules can be tested and changed
 * without touching the page. supabase/functions/_shared/clientCare.ts must stay
 * identical so the Monday digest judges clients the same way as the page.
 */

export const QUARTER_DAYS = 90;
/** A quarterly call counts as "coming up" this many days before it falls due. */
export const QUARTER_SOON_DAYS = 14;
export const DEFAULT_TOUCH_DAYS = 30;
/** Joined this recently = settling in. Not judged on numbers yet. */
export const NEW_CLIENT_DAYS = 45;
/** No monthly check-in for this long = their numbers are overdue. */
export const CHECKIN_OVERDUE_DAYS = 45;
/** Messaged them, and they haven't answered for this long. */
export const REPLY_SILENT_DAYS = 14;
/** No portal login for this long counts, but only alongside silence on WhatsApp. */
export const LOGIN_STALE_DAYS = 30;
export const LOW_CONFIDENCE = 4;
/** 5 is where the satisfaction slider starts, so a 5 tells us nothing. Only a clearly bad score counts. */
export const LOW_NPS = 4;
export const CONFIDENCE_DROP = 2;
/** Revenue within ±5% of last month is flat; down more than 15% is a drop. */
export const FLAT_TOLERANCE = 0.05;
export const DROP_TOLERANCE = 0.15;

/** What can be logged by hand. 'client_message' (they messaged us) only arrives from the scans. */
export type TouchKind = 'whatsapp' | 'call' | 'quarterly_call' | 'group_call' | 'other';
export const CLIENT_MESSAGE = 'client_message';

export const TOUCH_KINDS: { value: TouchKind; label: string }[] = [
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'call', label: '1:1 call' },
  { value: 'quarterly_call', label: 'Quarterly call' },
  { value: 'group_call', label: 'Group call' },
  { value: 'other', label: 'Other' },
];

export const touchLabel = (kind: string) =>
  kind === CLIENT_MESSAGE ? 'They messaged' : TOUCH_KINDS.find(k => k.value === kind)?.label ?? 'Contact';

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

// ---------- contact (us to them) and replies (them to us) ----------

export type ContactInfo = {
  /** Most recent contact from the team; null if none is logged. */
  at: Date | null;
  days: number | null;
  kind: string | null;
};

const valid = (t: Touchpoint, now: Date) => {
  const at = new Date(t.occurred_at);
  return !isNaN(at.getTime()) && at.getTime() <= now.getTime() + DAY ? at : null;
};

/** The team's last contact: a message, a call, a quarterly call. What the client sent us doesn't count. */
export function lastContact(touchpoints: Touchpoint[], now = new Date()): ContactInfo {
  let best: { at: Date; kind: string } | null = null;
  for (const t of touchpoints) {
    if (t.kind === CLIENT_MESSAGE) continue;
    const at = valid(t, now);
    if (at && (!best || at > best.at)) best = { at, kind: t.kind };
  }
  return best ? { at: best.at, days: Math.max(0, daysBetween(best.at, now)), kind: best.kind } : { at: null, days: null, kind: null };
}

export type ReplyInfo = { at: Date | null; days: number | null };

/** When they last messaged us. Null means we don't have that data, which is not the same as silence. */
export function lastReply(touchpoints: Touchpoint[], now = new Date()): ReplyInfo {
  let best: Date | null = null;
  for (const t of touchpoints) {
    if (t.kind !== CLIENT_MESSAGE) continue;
    const at = valid(t, now);
    if (at && (!best || at > best)) best = at;
  }
  return best ? { at: best, days: Math.max(0, daysBetween(best, now)) } : { at: null, days: null };
}

// ---------- quarterly call ----------

/** 'unscheduled': a long-standing client with no quarterly call logged and none planned. That's a setup gap, not an overdue call. */
export type QuarterlyState = 'new' | 'ok' | 'soon' | 'overdue' | 'unscheduled';

export type QuarterlyInfo = {
  state: QuarterlyState;
  /** When the next one falls due: planned date, else last quarterly call + 90 days, else joined + 90 days. */
  dueAt: Date | null;
  /** Negative = overdue by that many days. */
  daysUntil: number | null;
  lastAt: Date | null;
  /** True when no quarterly call has ever been logged and none is planned. */
  neverLogged: boolean;
  /** True when the due date was set by hand (or by "spread the first calls"). */
  planned: boolean;
};

export function quarterly(touchpoints: Touchpoint[], joinedAt: string | null | undefined, now = new Date(), plannedOn?: string | null): QuarterlyInfo {
  const calls = touchpoints
    .filter(t => t.kind === 'quarterly_call')
    .map(t => new Date(t.occurred_at))
    .filter(d => !isNaN(d.getTime()));
  const lastAt = calls.length ? new Date(Math.max(...calls.map(d => d.getTime()))) : null;
  const joined = joinedAt ? new Date(joinedAt) : null;
  const plan = plannedOn ? new Date(`${plannedOn.slice(0, 10)}T12:00:00`) : null;
  const usePlan = !!plan && !isNaN(plan.getTime()) && (!lastAt || plan > lastAt);
  const anchor = lastAt ?? (joined && !isNaN(joined.getTime()) ? joined : null);
  if (!usePlan && !anchor) return { state: 'ok', dueAt: null, daysUntil: null, lastAt, neverLogged: !lastAt, planned: false };
  const dueAt = usePlan ? plan! : addDays(anchor!, QUARTER_DAYS);
  const daysUntil = daysBetween(now, dueAt);
  const neverLogged = !lastAt && !usePlan;
  const state: QuarterlyState = daysUntil < 0 ? (neverLogged ? 'unscheduled' : 'overdue') : daysUntil <= QUARTER_SOON_DAYS ? 'soon' : neverLogged ? 'new' : 'ok';
  return { state, dueAt, daysUntil, lastAt, neverLogged, planned: usePlan };
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
  /** "Would you recommend us" (0-10) per check-in, newest first. */
  npsSeries?: (number | null)[];
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

  // Only judge the satisfaction score from a check-in that is still current, so an old bad score doesn't stick.
  const nps = input.npsSeries?.[0];
  if (nps !== null && nps !== undefined && nps <= LOW_NPS && daysSinceCheckin !== null && daysSinceCheckin <= CHECKIN_OVERDUE_DAYS) {
    negatives.push(`Satisfaction ${nps}/10`);
  }

  if (negatives.length >= 2) return { status: 'needs_help', reasons: negatives };
  if (negatives.length === 1) return { status: 'watch', reasons: negatives };

  // Nothing wrong in the numbers. If they haven't checked in lately we simply can't tell.
  const stale = !hasCheckins || daysSinceCheckin === null || daysSinceCheckin > CHECKIN_OVERDUE_DAYS + 5;
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

// ---------- who needs someone, and why ----------

/** Act now: numbers falling or gone quiet on us. Reach out: overdue a message or their numbers. Good: hidden. */
export type Bucket = 'act' | 'reach' | 'quarterly' | 'new' | 'good';
/** Higher = more urgent. Used to see who got worse since last week. */
export const BUCKET_SEVERITY: Record<Bucket, number> = { good: 0, new: 0, quarterly: 1, reach: 2, act: 3 };

export type Attention = {
  /** Higher = talk to them sooner. 0 = nothing needed. */
  priority: number;
  /** Plain-English reasons, most important first. */
  reasons: string[];
  bucket: Bucket;
  /** Their numbers are stale or sliding AND they've stopped answering messages we sent. */
  drifting: boolean;
  /** The only thing wrong is that their monthly numbers are overdue. A nudge, not a conversation. */
  numbersOnly: boolean;
};

export type AttentionInput = {
  status: Momentum;
  contact: ContactInfo;
  reply?: ReplyInfo;
  quarterly: QuarterlyInfo;
  touchEveryDays: number;
  isNew: boolean;
  /** Why the status is what it is: the momentum reasons, or Dan's own note. Only shown for Watch / Needs help. */
  statusReasons?: string[];
  daysSinceCheckin?: number | null;
  daysSinceLogin?: number | null;
};

export function attention(input: AttentionInput): Attention {
  const { status, contact, quarterly: q, touchEveryDays: every, isNew } = input;
  const reply = input.reply ?? { at: null, days: null };
  const checkinDays = input.daysSinceCheckin ?? null;
  let priority = 0;
  const reasons: string[] = [];

  const negative = status === 'needs_help' || status === 'watch';

  // Their numbers are overdue. We can't see drift without them, so chasing the check-in is an action.
  const checkinOverdue = !isNew && (checkinDays === null || checkinDays > CHECKIN_OVERDUE_DAYS);
  // We messaged them after they last wrote, and they've gone quiet.
  const unanswered = reply.days !== null && reply.days > REPLY_SILENT_DAYS && contact.days !== null && contact.days < reply.days;
  const loginStale = input.daysSinceLogin === null || input.daysSinceLogin === undefined || input.daysSinceLogin > LOGIN_STALE_DAYS;
  const drifting = unanswered && (checkinOverdue || loginStale || negative);

  if (negative) {
    priority += status === 'needs_help' ? 100 : 50;
    reasons.push(...(input.statusReasons?.length ? input.statusReasons : [status === 'needs_help' ? 'Needs help' : 'Watch']));
  }
  if (drifting) priority += 90;
  if (unanswered) {
    priority += 35;
    reasons.push(`Hasn't replied in ${reply.days}d`);
  }

  const limit = isNew ? Math.min(every, 14) : every;
  const contactOverdue = contact.days === null || contact.days > limit;
  if (contact.days === null) {
    priority += isNew ? 40 : 45;
    reasons.push('No contact logged');
  } else if (contact.days > limit) {
    priority += 40 + Math.min(30, (contact.days - limit) / 2);
    reasons.push(`Last spoke ${contact.days}d ago`);
  }

  if (checkinOverdue) {
    priority += 30 + (checkinDays === null ? 0 : Math.min(20, (checkinDays - CHECKIN_OVERDUE_DAYS) / 5));
    reasons.push(checkinDays === null ? 'No numbers yet' : `No numbers for ${checkinDays}d`);
  }

  if (q.state === 'overdue') {
    priority += 70 + Math.min(30, Math.abs(q.daysUntil ?? 0) / 3);
    reasons.push(`Quarterly call overdue ${Math.abs(q.daysUntil ?? 0)}d`);
  } else if (q.state === 'soon') {
    priority += 35;
    reasons.push(`Quarterly call in ${q.daysUntil}d`);
  }

  const bucket: Bucket =
    status === 'needs_help' || drifting ? 'act'
    : negative || contactOverdue || checkinOverdue || unanswered ? 'reach'
    : q.state === 'overdue' || q.state === 'soon' ? 'quarterly'
    : status === 'new' ? 'new'
    : 'good';

  const numbersOnly = bucket === 'reach' && checkinOverdue && !negative && !contactOverdue && !unanswered;
  return { priority: Math.round(priority), reasons, bucket, drifting, numbersOnly };
}

// ---------- one call that does it all, so the page and the Monday digest can't disagree ----------

export type MonthInput = {
  revenue: number;
  confidence: number | null;
  nps: number | null;
  retainersLost: number | null;
  activeRetainers: number | null;
  expenses: number | null;
};

export type AssessInput = {
  joinedAt: string | null;
  /** Check-ins, newest first. */
  months: MonthInput[];
  daysSinceCheckin: number | null;
  daysSinceLogin: number | null;
  touchpoints: Touchpoint[];
  danRead?: DanRead | null;
  danReadNote?: string | null;
  touchEveryExplicit?: number | null;
  contextCadence?: string | string[] | null;
  quarterlyPlannedOn?: string | null;
};

export type Assessment = {
  momentum: MomentumResult;
  status: Momentum;
  overridden: boolean;
  contact: ContactInfo;
  reply: ReplyInfo;
  quarterly: QuarterlyInfo;
  touchEveryDays: number;
  attention: Attention;
};

export function assessClient(input: AssessInput, now = new Date()): Assessment {
  const col = <K extends keyof MonthInput>(k: K) => input.months.map(m => m[k]);
  const momentum = computeMomentum({
    revenueSeries: col('revenue') as number[],
    confidenceSeries: col('confidence'),
    retainersLostSeries: col('retainersLost'),
    activeRetainersSeries: col('activeRetainers'),
    expensesSeries: col('expenses'),
    npsSeries: col('nps'),
    daysSinceCheckin: input.daysSinceCheckin,
    daysSinceJoined: input.joinedAt ? daysBetween(new Date(input.joinedAt), now) : null,
  });
  const { status, overridden } = effectiveStatus(momentum, input.danRead);
  const contact = lastContact(input.touchpoints, now);
  const reply = lastReply(input.touchpoints, now);
  const q = quarterly(input.touchpoints, input.joinedAt, now, input.quarterlyPlannedOn);
  const every = touchEveryDays(input.touchEveryExplicit, input.contextCadence);
  const statusReasons = overridden
    ? [`Your read: ${status === 'needs_help' ? 'needs help' : status}${input.danReadNote ? ` (${input.danReadNote})` : ''}`]
    : momentum.reasons;
  return {
    momentum, status, overridden, contact, reply, quarterly: q, touchEveryDays: every,
    attention: attention({
      status, contact, reply, quarterly: q, touchEveryDays: every, isNew: momentum.status === 'new',
      statusReasons, daysSinceCheckin: input.daysSinceCheckin, daysSinceLogin: input.daysSinceLogin,
    }),
  };
}

// ---------- staggering the first quarterly calls ----------

const isoLocal = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/**
 * Everyone starts with no quarterly call logged, so every client is "overdue" at once and the
 * list is useless. Spread their first call across the next 90 days, the people who most need
 * someone first, one at a time on weekdays.
 */
export function spreadQuarterly(
  items: { id: string; priority: number; contactDays: number | null }[],
  today = new Date(),
  startInDays = 3,
  spanDays = QUARTER_DAYS - 5,
): { id: string; dueOn: string }[] {
  const ordered = [...items].sort((a, b) => b.priority - a.priority || (b.contactDays ?? 9999) - (a.contactDays ?? 9999) || a.id.localeCompare(b.id));
  const step = ordered.length > 0 ? Math.max(1, (spanDays - startInDays) / ordered.length) : 1;
  return ordered.map((item, i) => {
    let d = addDays(new Date(today.getFullYear(), today.getMonth(), today.getDate(), 12), startInDays + Math.floor(i * step));
    while (d.getDay() === 0 || d.getDay() === 6) d = addDays(d, 1);
    return { id: item.id, dueOn: isoLocal(d) };
  });
}

// ---------- display ----------

export const STATUS_STYLE: Record<Momentum, { label: string; bg: string; border: string; text: string; dot: string }> = {
  rolling:    { label: 'Rolling',    bg: 'bg-green-500/10',  border: 'border-green-500/30',  text: 'text-success',      dot: 'bg-green-400' },
  steady:     { label: 'Steady',     bg: 'bg-green-500/10',  border: 'border-green-500/30',  text: 'text-success',      dot: 'bg-green-400' },
  new:        { label: 'New',        bg: 'bg-primary/10',    border: 'border-primary/30',    text: 'text-primary',      dot: 'bg-primary' },
  quiet:      { label: 'Quiet',      bg: 'bg-slate-500/10',  border: 'border-slate-500/30',  text: 'text-slate-600',    dot: 'bg-slate-400' },
  watch:      { label: 'Watch',      bg: 'bg-yellow-500/10', border: 'border-yellow-500/30', text: 'text-amber-600',    dot: 'bg-yellow-400' },
  needs_help: { label: 'Needs help', bg: 'bg-red-500/10',    border: 'border-red-500/30',    text: 'text-destructive',  dot: 'bg-red-400' },
};

export const BUCKET_STYLE: Record<Bucket, { label: string; hint: string; bg: string; border: string; text: string; dot: string; bar: string }> = {
  act:       { label: 'Act now',        hint: 'Numbers falling, or gone quiet on you', bg: 'bg-red-500/10',    border: 'border-red-500/30',    text: 'text-destructive',      dot: 'bg-red-400',    bar: 'bg-red-400' },
  reach:     { label: 'Reach out',      hint: 'Overdue a message, or their numbers',   bg: 'bg-yellow-500/10', border: 'border-yellow-500/30', text: 'text-amber-600',        dot: 'bg-yellow-400', bar: 'bg-yellow-400' },
  quarterly: { label: 'Quarterly call', hint: 'Due soon or overdue',                   bg: 'bg-primary/10',    border: 'border-primary/30',    text: 'text-primary',          dot: 'bg-primary',    bar: 'bg-primary' },
  new:       { label: 'Settling in',    hint: 'Joined in the last 45 days',            bg: 'bg-muted',         border: 'border-border',        text: 'text-muted-foreground', dot: 'bg-primary/40', bar: 'bg-primary/30' },
  good:      { label: 'Doing well',     hint: 'Nothing needed',                        bg: 'bg-green-500/10',  border: 'border-green-500/30',  text: 'text-success',          dot: 'bg-green-400',  bar: 'bg-green-400' },
};

/** 'numbers' is a display refinement, not a real bucket: it's "reach out" where the only thing wrong is overdue numbers — a nudge, not a conversation. One source of truth for every status color, shared by the page, the client card and the Monday digest. */
export type Group = Bucket | 'numbers';
export const GROUP_STYLE: Record<Group, { label: string; hint: string; bg: string; border: string; text: string; dot: string; bar: string }> = {
  ...BUCKET_STYLE,
  reach: { ...BUCKET_STYLE.reach, label: 'Reach out', hint: 'Worth a message or a call' },
  numbers: { label: 'Numbers overdue', hint: 'Needs a nudge, not a call', bg: 'bg-orange-500/10', border: 'border-orange-500/30', text: 'text-orange-600', dot: 'bg-orange-300', bar: 'bg-orange-300' },
};
export const groupOf = (a: Attention): Group => (a.numbersOnly ? 'numbers' : a.bucket);

export function describeQuarterly(q: QuarterlyInfo): string {
  if (!q.dueAt || q.daysUntil === null) return '—';
  if (q.state === 'unscheduled') return 'Not planned';
  if (q.state === 'overdue') return `Overdue ${Math.abs(q.daysUntil)}d`;
  return q.daysUntil === 0 ? 'Due today' : `In ${q.daysUntil}d`;
}

export const formatShortDate = (d: Date | null) =>
  d ? d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' }) : '—';

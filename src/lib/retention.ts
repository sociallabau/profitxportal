/**
 * Retention & unit economics for the admin's OWN business (ProfitX itself) —
 * how members retain, not members' clients. Admin-only; never member-facing.
 *
 * Pure functions, no JSX and no hooks, so the maths can be tested and changed
 * without touching the page.
 */

export type MemberRow = {
  id: string;
  created_at: string | null;
  archived_at: string | null;
};

export type MonthPoint = {
  /** 'YYYY-MM' */
  key: string;
  label: string;
  activeStart: number;
  churned: number;
  newMembers: number;
  /** churned ÷ activeStart, 0–1. Null when nobody was active. */
  churnRate: number | null;
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function monthKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

function startOfMonth(year: number, monthIndex: number): Date {
  return new Date(Date.UTC(year, monthIndex, 1));
}

/** The last `count` months including the current one, oldest first. */
export function lastMonths(count: number, now: Date = new Date()): { key: string; label: string; start: Date; end: Date }[] {
  const out: { key: string; label: string; start: Date; end: Date }[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const start = startOfMonth(now.getUTCFullYear(), now.getUTCMonth() - i);
    const end = startOfMonth(now.getUTCFullYear(), now.getUTCMonth() - i + 1);
    out.push({
      key: monthKey(start),
      label: MONTHS[start.getUTCMonth()],
      start,
      end,
    });
  }
  return out;
}

/** Churn, new members and churn rate for each of the last `count` months. */
export function monthlyChurnTrend(members: MemberRow[], count = 6, now: Date = new Date()): MonthPoint[] {
  return lastMonths(count, now).map(({ key, label, start, end }) => {
    const activeStart = members.filter(m => {
      const joined = m.created_at ? new Date(m.created_at) : null;
      const left = m.archived_at ? new Date(m.archived_at) : null;
      // A member counts at the start of the month if they joined before it
      // began and had not left before it began.
      return (!joined || joined < start) && (!left || left >= start);
    }).length;
    const churned = members.filter(m => {
      const left = m.archived_at ? new Date(m.archived_at) : null;
      return left !== null && left >= start && left < end;
    }).length;
    const newMembers = members.filter(m => {
      const joined = m.created_at ? new Date(m.created_at) : null;
      return joined !== null && joined >= start && joined < end;
    }).length;
    return {
      key,
      label,
      activeStart,
      churned,
      newMembers,
      churnRate: activeStart > 0 ? churned / activeStart : null,
    };
  });
}

export function activeChurnedCounts(members: MemberRow[]): { active: number; churned: number } {
  return {
    active: members.filter(m => !m.archived_at).length,
    churned: members.filter(m => !!m.archived_at).length,
  };
}

/**
 * Member LTV = ARPU ÷ monthly churn rate. A 0% churn rate means lifetime is
 * unbounded — return null so the UI can show "∞" rather than a fake number.
 */
export function memberLtv(arpu: number, monthlyChurnRate: number | null): number | null {
  if (arpu <= 0) return null;
  if (monthlyChurnRate === null || monthlyChurnRate <= 0) return null;
  return arpu / monthlyChurnRate;
}

/** CAC = acquisition spend ÷ new members. Null when either side is missing. */
export function cac(acquisitionSpend: number, newMembers: number): number | null {
  if (acquisitionSpend <= 0 || newMembers <= 0) return null;
  return acquisitionSpend / newMembers;
}

/** LTV:CAC target band — "the big purple monster": ≥3 green, 1–3 amber, <1 red. */
export function ltvCacBand(ratio: number | null): 'green' | 'amber' | 'red' | null {
  if (ratio === null) return null;
  if (ratio >= 3) return 'green';
  if (ratio >= 1) return 'amber';
  return 'red';
}

/**
 * Renewal rate for a period: of the members whose monthly anniversary fell in
 * the period, how many stayed. Billing isn't stored, so a renewal "coming up"
 * is approximated by the member's join-date anniversary; "stayed" means they
 * were not archived at that anniversary.
 */
export function renewalRate(members: MemberRow[], periodStart: Date, periodEnd: Date): { due: number; renewed: number; rate: number | null } {
  let due = 0;
  let renewed = 0;
  for (const m of members) {
    if (!m.created_at) continue;
    const joined = new Date(m.created_at);
    // Walk each monthly anniversary that lands inside the period.
    for (let n = 1; n <= 600; n++) {
      const anniversary = new Date(Date.UTC(joined.getUTCFullYear(), joined.getUTCMonth() + n, joined.getUTCDate()));
      if (anniversary >= periodEnd) break;
      if (anniversary >= periodStart) {
        due++;
        const left = m.archived_at ? new Date(m.archived_at) : null;
        if (!left || left > anniversary) renewed++;
      }
    }
  }
  return { due, renewed, rate: due > 0 ? renewed / due : null };
}

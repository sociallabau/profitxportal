import { describeQuarterly, touchLabel } from '@/lib/clientCare';
import type { ClientWithHealth } from '@/lib/clientHealth';

/** $850, $1.5k, $19k: short enough to sit in a row. */
export const money = (n: number) => (n >= 10000 ? `$${Math.round(n / 1000)}k` : n >= 1000 ? `$${(n / 1000).toFixed(1).replace(/\.0$/, '')}k` : `$${n}`);

export const initials = (name: string | null) =>
  (name ?? '?').split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]?.toUpperCase()).join('') || '?';

/** Revenue with its direction since the last check-in, e.g. "$19.6k ▲ 37%". */
export function revenueLine(c: ClientWithHealth) {
  const [latest, previous] = c.revenueSeries;
  const change = c.revenueSeries.length > 1 && previous ? Math.round(((latest - previous) / previous) * 100) : null;
  return { text: money(c.monthlyRevenue), change };
}

/**
 * One quiet line of facts under the reason: when we last spoke, when they last answered, the quarterly call, the money.
 * Anything the reason line above already says is left out, so nothing is read twice.
 */
export function factsLine(c: ClientWithHealth): string {
  const said = (test: (r: string) => boolean) => c.attention.reasons.some(test);
  const parts: string[] = [];
  if (!said(r => r.startsWith('Last spoke') || r === 'No contact logged')) {
    parts.push(c.contact.days === null ? 'No contact logged' : `Spoke ${c.contact.days === 0 ? 'today' : `${c.contact.days}d ago`}${c.contact.kind ? ` (${touchLabel(c.contact.kind)})` : ''}`);
  }
  if (c.reply.days !== null && !said(r => r.startsWith("Hasn't replied"))) parts.push(`they replied ${c.reply.days === 0 ? 'today' : `${c.reply.days}d ago`}`);
  const q = describeQuarterly(c.quarterly);
  if (q !== '—' && !said(r => r.startsWith('Quarterly'))) parts.push(`quarterly ${q === 'None logged' ? 'not booked' : q.toLowerCase()}`);
  const r = revenueLine(c);
  parts.push(`${r.text}${r.change !== null && Math.abs(r.change) >= 5 ? ` ${r.change > 0 ? '▲' : '▼'}${Math.abs(r.change)}%` : ''}`);
  return parts.join(' · ');
}

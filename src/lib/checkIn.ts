import type { GateNumber } from '@/lib/growthHub';

/**
 * The Monthly Check-In's activity boxes, each tied to the gate whose numbers it
 * proves. A member sees their own gate's boxes and the next gate's, so the form
 * grows with them instead of asking a Gate 1 member about ad leads.
 */
export type CheckInKey =
  | 'active_retainers' | 'new_clients' | 'retainers_lost'
  | 'content_posts' | 'retainer_convos' | 'meetings' | 'case_studies_posted'
  | 'ad_spend_awareness' | 'ad_spend_leadgen' | 'ad_leads' | 'booked_calls' | 'calls_showed';

export type CheckInField = { key: CheckInKey; label: string; hint?: string; placeholder: string; gate: GateNumber; money?: boolean };
export type CheckInSection = { title: string; fields: CheckInField[] };

export const CHECK_IN_SECTIONS: CheckInSection[] = [
  { title: 'Clients', fields: [
    { key: 'active_retainers', label: 'Paying retainers right now', hint: 'Gate I is 3', placeholder: '3', gate: 1 },
    { key: 'new_clients', label: 'New clients signed', placeholder: '1', gate: 1 },
    { key: 'retainers_lost', label: 'Retainers lost', placeholder: '0', gate: 1 },
  ] },
  { title: 'Content & conversations', fields: [
    { key: 'content_posts', label: 'Posts on your own account', placeholder: '8', gate: 1 },
    { key: 'retainer_convos', label: 'Retainer conversations started', hint: 'DMs, warm outreach, referrals', placeholder: '6', gate: 1 },
    { key: 'meetings', label: 'Sales calls held', placeholder: '3', gate: 1 },
    { key: 'case_studies_posted', label: 'Case studies posted', hint: 'Gate II needs 4', placeholder: '1', gate: 2 },
  ] },
  { title: 'Ads & leads', fields: [
    { key: 'ad_spend_awareness', label: 'Awareness ad spend ($)', hint: 'Boosting your best posts', placeholder: '50', gate: 2, money: true },
    { key: 'ad_spend_leadgen', label: 'Lead gen ad spend ($)', placeholder: '1500', gate: 3, money: true },
    { key: 'ad_leads', label: 'Ad leads', placeholder: '40', gate: 3 },
    { key: 'booked_calls', label: 'Calls booked', placeholder: '10', gate: 3 },
    { key: 'calls_showed', label: 'Calls that showed', placeholder: '7', gate: 3 },
  ] },
];

/** Sections with only the boxes for the member's gate and the one above. No gate yet: everything. */
export function visibleSections(gate: GateNumber | null): CheckInSection[] {
  return CHECK_IN_SECTIONS
    .map(s => ({ ...s, fields: s.fields.filter(f => !gate || f.gate <= gate + 1) }))
    .filter(s => s.fields.length > 0);
}

const num = (v: string | undefined, int: boolean) => {
  if (v == null || v.trim() === '') return null;
  const n = int ? parseInt(v, 10) : parseFloat(v);
  return Number.isFinite(n) ? n : null;
};

/**
 * The row values for the activity boxes. Hidden boxes save as null (not asked,
 * rather than zero), and the older combined columns stay filled so existing
 * charts keep working: leads = conversations + ad leads, ad spend = both kinds.
 */
export function checkInValues(form: Partial<Record<CheckInKey, string>>, gate: GateNumber | null) {
  const shown = new Set(visibleSections(gate).flatMap(s => s.fields.map(f => f.key)));
  const out = {} as Record<CheckInKey, number | null>;
  for (const f of CHECK_IN_SECTIONS.flatMap(s => s.fields)) out[f.key] = shown.has(f.key) ? num(form[f.key], !f.money) : null;
  const sum = (a: number | null, b: number | null) => (a == null && b == null ? null : (a ?? 0) + (b ?? 0));
  return {
    ...out,
    leads_generated: sum(out.retainer_convos, out.ad_leads) ?? 0,
    ad_spend: sum(out.ad_spend_awareness, out.ad_spend_leadgen) ?? 0,
  };
}

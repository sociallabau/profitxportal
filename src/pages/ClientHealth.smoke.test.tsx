import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const ago = (d: number) => new Date(Date.now() - d * 86400000).toISOString();
const month = (m: number) => { const x = new Date(); x.setMonth(x.getMonth() - m, 1); return x.toISOString().slice(0, 10); };

const people = [
  { id: 'admin', full_name: 'Dan', is_admin: true, created_at: ago(900), gate: null, archived_at: null },
  { id: 'tobias', full_name: 'Tobias', created_at: ago(300), gate: 'Gate 2 (Fuel)' },
  { id: 'harry', full_name: 'Harry Hopkins', created_at: ago(10), gate: null },
  { id: 'jake', full_name: 'Jake Nelson', created_at: ago(300), gate: 'Gate 1 (Fix)' },
  { id: 'lachlan', full_name: 'Lachlan Beale', created_at: ago(300), gate: 'Gate 1 (Fix)' },
  { id: 'marc', full_name: 'Marc', created_at: ago(300), gate: 'Gate 1 (Fix)' },
  { id: 'ethan', full_name: 'Ethan Fagan', created_at: ago(300), gate: null },
  { id: 'emily', full_name: 'Emily Phillips', created_at: ago(500), gate: null },
];
const overview = (id: string, name: string, rev: number, daysSub: number | null, extra: Record<string, unknown> = {}) => ({
  id, full_name: name, tier: 'in_flow_starter', is_admin: false, last_total_revenue: rev, last_expenses: rev * 0.5, last_mrr: rev,
  days_since_submission: daysSub, days_since_last_login: 60, last_submission_at: daysSub === null ? null : ago(daysSub), last_submission_month: month(0), ...extra,
});
const fixtures: Record<string, unknown[]> = {
  profiles: people,
  admin_client_overview: [
    overview('tobias', 'Tobias', 19600, 5), overview('harry', 'Harry Hopkins', 0, null), overview('jake', 'Jake Nelson', 6000, 70),
    overview('lachlan', 'Lachlan Beale', 5000, 12), overview('marc', 'Marc', 2500, 80), overview('ethan', 'Ethan Fagan', 0, 134),
    overview('emily', 'Emily Phillips', 2, 3, { is_admin: true }),
  ],
  monthly_totals: [
    { user_id: 'tobias', month: month(0), total_revenue: 19600, business_confidence: 8 },
    { user_id: 'tobias', month: month(1), total_revenue: 14350, business_confidence: 7 },
    { user_id: 'lachlan', month: month(0), total_revenue: 5000, business_confidence: 7 },
    { user_id: 'lachlan', month: month(1), total_revenue: 4900, business_confidence: 7 },
    { user_id: 'jake', month: month(3), total_revenue: 6000, business_confidence: 7 },
    { user_id: 'marc', month: month(3), total_revenue: 2500, business_confidence: 6 },
    { user_id: 'ethan', month: month(5), total_revenue: 3000, business_confidence: 6 },
  ],
  client_touchpoints: [
    { client_id: 'tobias', kind: 'whatsapp', occurred_at: ago(6) },
    { client_id: 'tobias', kind: 'quarterly_call', occurred_at: ago(30) },
    { client_id: 'harry', kind: 'call', occurred_at: ago(3) },
    { client_id: 'jake', kind: 'whatsapp', occurred_at: ago(50) },
    { client_id: 'jake', kind: 'quarterly_call', occurred_at: ago(40) },
    { client_id: 'lachlan', kind: 'whatsapp', occurred_at: ago(5) },
    { client_id: 'lachlan', kind: 'client_message', occurred_at: ago(2) },
    { client_id: 'lachlan', kind: 'quarterly_call', occurred_at: ago(20) },
    { client_id: 'marc', kind: 'whatsapp', occurred_at: ago(80) },
    { client_id: 'marc', kind: 'quarterly_call', occurred_at: ago(100) },
    { client_id: 'ethan', kind: 'whatsapp', occurred_at: ago(1) },
    { client_id: 'ethan', kind: 'client_message', occurred_at: ago(21) },
    { client_id: 'ethan', kind: 'quarterly_call', occurred_at: ago(30) },
  ],
  client_care: [{ client_id: 'jake', touch_every_days: null, dan_read: 'good', dan_read_note: 'Quiet but sweet', snapshot: 'Jake runs a small video studio. MRR $6,000, steady.', checkin_bullets: ['Signed one new client'], snapshot_at: ago(1) }],
};

vi.mock('@/lib/supabase', () => {
  const builder = (table: string) => {
    let empty = false;
    const rows = () => (empty ? [] : fixtures[table] ?? []);
    const b: Record<string, unknown> = {};
    for (const m of ['select', 'order', 'limit', 'eq', 'gte', 'in', 'is', 'insert', 'update', 'upsert', 'delete']) b[m] = () => b;
    b.not = () => { empty = true; return b; };
    b.single = () => Promise.resolve({ data: rows()[0] ?? null, error: null });
    b.maybeSingle = () => Promise.resolve({ data: rows()[0] ?? null, error: null });
    b.then = (res: (v: unknown) => unknown) => Promise.resolve({ data: rows(), error: null }).then(res);
    return b;
  };
  return {
    supabase: {
      from: (t: string) => builder(t),
      auth: { getUser: async () => ({ data: { user: { id: 'admin' } } }) },
      functions: { invoke: vi.fn(async () => ({ data: { snapshot: 'x' }, error: null })) },
    },
  };
});
vi.mock('@/hooks/useAuth', () => ({ useRequireAuth: () => ({ user: { id: 'admin' } }) }));
vi.mock('@/hooks/useGrowthHub', () => ({ useGrowthHubContent: () => ({ data: { tasks: [] } }) }));
vi.mock('@/components/PageLayout', () => ({ default: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));
vi.mock('@/components/ContextRoom', () => ({ default: () => <div>context room</div> }));
vi.mock('@/components/client-health/GrowthHubPanel', () => ({ default: () => <div>growth hub</div> }));

import ClientHealth from './ClientHealth';

const renderPage = () => render(
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><ClientHealth /></QueryClientProvider>,
);

const card = async (name: string) =>
  (await screen.findAllByText(name)).map(e => e.closest('[role="button"]')).find(Boolean) as HTMLElement | undefined;

describe('Client Health page', () => {
  it('shows only the people who need you, and hides the ones doing well', async () => {
    renderPage();
    await screen.findByText('Reach out', { selector: 'h2' });

    // Needs you: Marc (silent + quarterly overdue), Jake (not spoken to), Ethan (stopped replying).
    expect((await card('Marc'))?.textContent).toContain('Last spoke 80d ago');
    expect((await card('Marc'))?.textContent).toContain('Quarterly call overdue 10d');
    expect((await card('Jake Nelson'))?.textContent).toContain('Last spoke 40d ago');

    // Hidden: Tobias and Lachlan are fine (Lachlan never logs in but chats and replies), Harry is settling in.
    expect(await card('Tobias')).toBeUndefined();
    expect(await card('Lachlan Beale')).toBeUndefined();
    expect(await card('Harry Hopkins')).toBeUndefined();

    // Emily and Dan are staff, not clients.
    expect(screen.queryByText('Emily Phillips')).toBeNull();
    expect(screen.queryByText('Dan')).toBeNull();
  });

  it('puts someone who has stopped replying under Act now, marked Drifting', async () => {
    renderPage();
    const ethan = await waitFor(async () => {
      const c = await card('Ethan Fagan');
      expect(c).toBeTruthy();
      return c!;
    });
    expect(ethan.textContent).toContain('Drifting');
    expect(ethan.textContent).toContain("Hasn't replied in 21d");
    const section = ethan.closest('section')!;
    expect(section.textContent).toContain('Act now');
  });

  it('tucks the quiet people away but keeps their names reachable', async () => {
    renderPage();
    const summary = await screen.findByText(/Doing well/, { selector: 'summary span' });
    const details = summary.closest('details')!;
    expect(details.hasAttribute('open')).toBe(false);
    expect(details.textContent).toContain('Tobias');
    expect(details.textContent).toContain('Lachlan Beale');
    const settling = (await screen.findByText(/Settling in/, { selector: 'summary span' })).closest('details')!;
    expect(settling.textContent).toContain('Harry Hopkins');
  });

  it('summarises how many need you', async () => {
    renderPage();
    expect(await screen.findByText(/people need you/)).toBeTruthy();
  });

  it('opens a client with the short summary and no hot list or roadmap progress', async () => {
    renderPage();
    fireEvent.click((await card('Jake Nelson'))!);
    await waitFor(() => expect(screen.getByText('Quick summary')).toBeTruthy());
    expect(await screen.findByText(/Jake runs a small video studio/)).toBeTruthy();
    expect(screen.getByText('Signed one new client', { exact: false })).toBeTruthy();
    expect(screen.getByText('Notes & contact log')).toBeTruthy();
    expect(screen.getAllByText('Quarterly call').length).toBeGreaterThan(0);
    expect(screen.getByText('Prep me')).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/Hot List|Roadmap Progress|What Dan AI knows/);
  });

  it('offers to spread the first quarterly calls on the quarterly tab', async () => {
    renderPage();
    fireEvent.click(await screen.findByText('Quarterly calls', { selector: 'button' }));
    // Marc's last quarterly call was logged, Harry is new, so nobody here is waiting on a first date.
    expect(screen.queryByText(/first calls over 90 days/)).toBeNull();
    expect(await screen.findByText('Last quarterly call')).toBeTruthy();
  });
});

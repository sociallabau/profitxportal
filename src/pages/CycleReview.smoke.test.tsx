import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

/**
 * The reflect-month loop, end to end: what the banner asks for in each kind of month,
 * and what the review page shows and refuses to save.
 *
 * The cycle is reflect-first, so these dates matter: December opens the Dec–Feb cycle
 * and reviews Sep–Nov, the three months that just ran.
 */

type Rows = Record<string, unknown[]>;
let fixtures: Rows = {};
let profile: Record<string, unknown> = { id: 'member', tier: 'in_flow_starter', gate: 'Gate 1 (Fix)' };

vi.mock('@/lib/supabase', () => {
  const builder = (table: string) => {
    const rows = () => fixtures[table] ?? [];
    const b: Record<string, unknown> = {};
    for (const m of ['select', 'order', 'limit', 'eq', 'gte', 'in', 'is', 'not', 'insert', 'update', 'upsert', 'delete']) b[m] = () => b;
    b.single = () => Promise.resolve({ data: rows()[0] ?? null, error: null });
    b.maybeSingle = () => Promise.resolve({ data: rows()[0] ?? null, error: null });
    b.then = (res: (v: unknown) => unknown) => Promise.resolve({ data: rows(), error: null }).then(res);
    return b;
  };
  return {
    supabase: {
      from: (t: string) => builder(t),
      auth: { getUser: async () => ({ data: { user: { id: 'member' } } }) },
    },
  };
});
vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'member' } }),
  useRequireAuth: () => ({ user: { id: 'member' } }),
}));
vi.mock('@/hooks/useProfile', () => ({ useProfile: () => ({ data: profile }) }));
vi.mock('@/hooks/usePageTracking', () => ({ usePageTracking: () => undefined }));
vi.mock('@/components/PageLayout', () => ({ default: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));

import CycleBanner from '@/components/CycleBanner';
import CycleReview from './CycleReview';

const month = (key: string, over: Record<string, unknown> = {}) => ({
  month: `${key}-01`, total_revenue: 10000, expenses: 4000, active_retainers: 3,
  retainers_lost: 0, new_clients: 1, content_posts: 8, retainer_convos: 6, business_confidence: 6, ...over,
});

const wrap = (ui: React.ReactElement) => render(
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <MemoryRouter>{ui}</MemoryRouter>
  </QueryClientProvider>,
);

beforeEach(() => {
  fixtures = { monthly_totals: [], roadmap_audits: [] };
  profile = { id: 'member', tier: 'in_flow_starter', gate: 'Gate 1 (Fix)' };
});

describe('CycleBanner', () => {
  const december = new Date(2026, 11, 15);
  const november = new Date(2026, 10, 15);

  it('asks for both steps in a reflect month when nothing is in', async () => {
    wrap(<CycleBanner userId="member" now={december} />);
    expect(await screen.findByText(/Submit your November numbers/)).toBeTruthy();
    expect(screen.getByText(/Review the cycle and pick your two projects/)).toBeTruthy();
    expect(screen.getByText(/This is a Reflect month/)).toBeTruthy();
    expect(screen.getByText(/Two things to get out of the way/)).toBeTruthy();
  });

  it('crosses off the numbers once last month is submitted, and still asks for the review', async () => {
    fixtures.monthly_totals = [month('2026-11')];
    wrap(<CycleBanner userId="member" now={december} />);
    const numbers = await screen.findByText(/Submit your November numbers/);
    expect(numbers.className).toContain('line-through');
    expect(screen.getByText(/One thing left/)).toBeTruthy();
    expect(screen.getByRole('button', { name: /Start the review/ })).toBeTruthy();
  });

  it('only wants the numbers outside a reflect month', async () => {
    wrap(<CycleBanner userId="member" now={november} />);
    expect(await screen.findByText(/Submit your October numbers/)).toBeTruthy();
    expect(screen.getByText(/This is an Implement month/)).toBeTruthy();
    expect(screen.queryByText(/Review the cycle/)).toBeNull();
  });

  it('disappears entirely once the month has nothing left to ask for', async () => {
    fixtures.monthly_totals = [month('2026-10')];
    const { container } = wrap(<CycleBanner userId="member" now={november} />);
    // Nothing outstanding, so the banner renders nothing at all rather than an empty card.
    await vi.waitFor(() => expect(container.textContent).toBe(''));
  });
});

describe('CycleReview page', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date(2026, 11, 15));
  });
  afterEach(() => vi.useRealTimers());

  it('totals the cycle that just ran, not the one starting', async () => {
    fixtures.monthly_totals = [
      month('2026-09'), month('2026-10', { total_revenue: 12000 }),
      month('2026-11', { total_revenue: 15000, active_retainers: 5, new_clients: 2 }),
      month('2026-12', { total_revenue: 99000 }), // this cycle's own month: must not be counted
    ];
    wrap(<CycleReview />);
    expect(await screen.findByText('$37,000')).toBeTruthy();
    expect(screen.getByText(/3 of 3 months submitted/)).toBeTruthy();
    expect(screen.queryByText('$136,000')).toBeNull();
  });

  it('will not save until every question is answered and both projects are picked', async () => {
    wrap(<CycleReview />);
    const save = await screen.findByRole('button', { name: /Save my review/ });
    expect(save).toBeDisabled();
    expect(screen.getByText(/9 diagnostic questions left/)).toBeTruthy();
  });

  it('offers a launchpad member only launchpad projects, never team or leadership work', async () => {
    wrap(<CycleReview />);
    await screen.findByText('Get better');
    const better = screen.getByText('Get better').parentElement!;
    expect(better.textContent).toContain('Getting Help');
    expect(better.textContent).not.toContain('Build Your A-Team');
    expect(better.textContent).not.toContain('Leadership System');
  });

  it('still holds the line for a member with no gate set, where the gate cap cannot help', async () => {
    // pickOptions caps by gate, so with no gate it would happily offer scale work. What keeps
    // it out is that a project is only offered for an area the page actually asked them to rate.
    profile = { id: 'member', tier: 'in_flow_starter', gate: null };
    wrap(<CycleReview />);
    await screen.findByText('Get better');
    const better = screen.getByText('Get better').parentElement!;
    expect(better.textContent).toContain('Getting Help');
    expect(better.textContent).not.toContain('Build Your A-Team');
  });

  it('shows the full diagnostic to a scale member', async () => {
    profile = { id: 'member', tier: 'in_flow_scale', gate: 'Gate 4 (Supercharge)' };
    wrap(<CycleReview />);
    expect(await screen.findByText(/0\/18 answered/)).toBeTruthy();
  });

  it('says the numbers are missing rather than quietly totalling two months as three', async () => {
    fixtures.monthly_totals = [month('2026-09'), month('2026-10')];
    wrap(<CycleReview />);
    expect(await screen.findByText(/Last month's numbers aren't in yet/)).toBeTruthy();
    expect(screen.getByText(/2 of 3 months submitted/)).toBeTruthy();
  });

  it('shows the saved picks back instead of the form once the review is in', async () => {
    fixtures.roadmap_audits = [{
      id: 'a1', created_at: '2026-12-02T00:00:00Z', bigger_code: 'C1', better_code: 'D1',
      moved_needle: 'Outreach', stalled: 'Editing', not_doing: 'Paid ads',
      confidence_offer: 6, confidence_content: 4, confidence_conversations: 5, confidence_delivery: 7,
    }];
    wrap(<CycleReview />);
    expect(await screen.findByText(/Your review is in for this cycle/)).toBeTruthy();
    expect(screen.getByText('Organic Content Flywheel')).toBeTruthy();
    expect(screen.getByText('Delivery Roadmap')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Save my review/ })).toBeNull();
  });
});

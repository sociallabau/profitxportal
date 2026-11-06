import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

/**
 * Which portal pages get used across everyone, and when. A content/curriculum usage
 * signal — what to build, fix or promote next — never a per-client read: Client Health
 * deliberately doesn't judge an individual client by their portal logins (plenty of good
 * clients live on WhatsApp and barely open the portal). This is the aggregate view that
 * is safe to look at instead.
 */

const PAGE_LABELS: Record<string, string> = {
  dashboard: 'Dashboard', financials: 'Financials', 'cash-menu': 'Cash Menu', roadmap: 'Roadmap',
  'growth-hub': 'Growth Hub', 'wins-wall': 'Wins Wall', 'monthly-totals': 'Monthly Check-In',
  'client-journey': 'Client Journey', 'content-generator': 'Content Generator', 'content-studio': 'Content Studio',
  'dan-ai': 'Dan AI', calls: 'Calls', 'hot-list': 'Hot List', 'launch-hq': 'Launch HQ', vault: 'Vault',
  onboarding: 'Onboarding', settings: 'Settings', 'new-clients': 'New Clients',
};
const pageLabel = (page: string) => PAGE_LABELS[page] ?? page;

type PagePopularity = { page: string; views: number; unique_members: number };
type ActivityDay = { day: string; views: number; unique_members: number };

export default function EngagementPanel() {
  const { data: pages, isLoading: loadingPages } = useQuery({
    queryKey: ['engagement-page-popularity'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('admin_page_popularity', { _days: 90 });
      if (error) throw error;
      return (data ?? []) as PagePopularity[];
    },
  });
  const { data: days, isLoading: loadingDays } = useQuery({
    queryKey: ['engagement-activity-by-day'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('admin_activity_by_day', { _days: 30 });
      if (error) throw error;
      return (data ?? []) as ActivityDay[];
    },
  });

  if (loadingPages || loadingDays) return <p className="text-sm text-muted-foreground">Loading activity…</p>;
  if (!pages?.length) return <p className="text-sm text-muted-foreground">No portal activity logged in the last 90 days.</p>;

  const maxViews = Math.max(1, ...pages.map(p => p.views));
  const maxDayViews = Math.max(1, ...(days ?? []).map(d => d.views));

  return (
    <div className="space-y-6 rounded-2xl border border-border bg-card/70 p-4 shadow-sm backdrop-blur-sm">
      <p className="text-xs text-muted-foreground">
        Which pages get used across everyone, last 90 days — a signal for what to build or fix in the curriculum next.
        Not a per-client read: nobody's individual risk is judged by this.
      </p>

      <div>
        <h3 className="mb-2 text-sm font-bold text-foreground">Page popularity</h3>
        <div className="space-y-1.5">
          {pages.map(p => (
            <div key={p.page} className="flex items-center gap-3">
              <span className="w-36 shrink-0 truncate text-xs text-muted-foreground">{pageLabel(p.page)}</span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-primary/60" style={{ width: `${(p.views / maxViews) * 100}%` }} />
              </div>
              <span className="w-28 shrink-0 text-right text-xs text-muted-foreground">{p.views} views · {p.unique_members} people</span>
            </div>
          ))}
        </div>
      </div>

      {!!days?.length && (
        <div>
          <h3 className="mb-2 text-sm font-bold text-foreground">Activity, last 30 days</h3>
          <div className="flex h-16 items-end gap-0.5">
            {days.map(d => (
              <div
                key={d.day}
                title={`${d.day}: ${d.views} views, ${d.unique_members} people`}
                className="flex-1 rounded-sm bg-primary/50"
                style={{ height: `${Math.max(4, (d.views / maxDayViews) * 100)}%` }}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

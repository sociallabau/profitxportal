import { useQuery } from '@tanstack/react-query';
import PageLayout from '@/components/PageLayout';
import { supabase } from '@/lib/supabase';
import { useRequireAuth } from '@/hooks/useAuth';

export default function ClientHealth() {
  const { user, loading } = useRequireAuth();

  const { data: clients } = useQuery({
    queryKey: ['all-clients'],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email, tier, created_at');
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: allMonthly } = useQuery({
    queryKey: ['all-monthly'],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from('monthly_totals')
        .select('user_id, month, mrr, new_clients')
        .order('month', { ascending: false });
      return data ?? [];
    },
  });

  const getLatest = (userId: string) =>
    allMonthly?.find((m: any) => m.user_id === userId);

  const TIER_COLORS: Record<string, string> = {
    onramp: 'bg-warning/20 text-warning',
    growth: 'bg-primary/20 text-primary',
    scale: 'bg-primary/20 text-primary',
  };

  return (
    <PageLayout>
      <h1 className="text-2xl mb-1">Client Health</h1>
      <p className="text-sm text-muted-foreground mb-6">
        {clients?.length ?? 0} clients in ProfitX
      </p>

      <div className="space-y-3">
        {clients?.map((c: any) => {
          const latest = getLatest(c.id);
          return (
            <div key={c.id} className="bg-card border border-border rounded-xl px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <p className="font-semibold text-foreground">{c.full_name || 'Unnamed'}</p>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-semibold capitalize ${TIER_COLORS[c.tier] ?? ''}`}>
                    {c.tier}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">{c.email}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Joined {new Date(c.created_at).toLocaleDateString()}
                </p>
              </div>
              <div className="flex gap-6 text-center">
                <div>
                  <p className="text-xs text-muted-foreground">Latest MRR</p>
                  <p className="font-bold text-primary text-sm">
                    {latest ? `$${Number(latest.mrr).toLocaleString()}` : '—'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">New Clients</p>
                  <p className="font-bold text-foreground text-sm">{latest?.new_clients ?? '—'}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {(!clients || clients.length === 0) && (
        <p className="text-sm text-muted-foreground text-center py-12">
          No clients yet. Add them via Lovable Cloud → Authentication → Invite User.
        </p>
      )}
    </PageLayout>
  );
}

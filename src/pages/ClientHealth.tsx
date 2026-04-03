import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowUpCircle, ArrowDownCircle } from 'lucide-react';
import { toast } from 'sonner';
import PageLayout from '@/components/PageLayout';
import { supabase } from '@/lib/supabase';
import { useRequireAuth } from '@/hooks/useAuth';

const TIERS = ['onramp', 'growth', 'scale'] as const;

const TIER_COLORS: Record<string, string> = {
  onramp: 'bg-warning/20 text-warning border-warning/30',
  growth: 'bg-primary/20 text-primary border-primary/30',
  scale: 'bg-success/20 text-success border-success/30',
};

export default function ClientHealth() {
  const { user, loading } = useRequireAuth();
  const queryClient = useQueryClient();

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

  const getMrrAlert = (mrr: number | null | undefined, currentTier: string | null) => {
    if (!mrr) return null;
    if (mrr >= 20000 && currentTier !== 'scale') {
      return { message: 'Ready for Scale tier ($20k+ MRR)', suggested: 'scale', color: 'text-success' };
    }
    if (mrr >= 15000 && currentTier !== 'scale' && currentTier !== 'growth') {
      return { message: 'Ready for Growth tier ($15k+ MRR)', suggested: 'growth', color: 'text-primary' };
    }
    return null;
  };

  const handleTierChange = async (userId: string, newTier: string, name: string) => {
    const { error } = await supabase
      .from('profiles')
      .update({ tier: newTier })
      .eq('id', userId);
    if (error) {
      toast.error('Failed to update tier');
    } else {
      toast.success(`${name || 'Client'} upgraded to ${newTier}`);
      queryClient.invalidateQueries({ queryKey: ['all-clients'] });
    }
  };

  if (loading) return null;

  return (
    <PageLayout>
      <h1 className="text-2xl mb-1">Client Health</h1>
      <p className="text-sm text-muted-foreground mb-6">
        {clients?.length ?? 0} clients in ProfitX
      </p>

      <div className="space-y-3">
        {clients?.map((c: any) => {
          const latest = getLatest(c.id);
          const alert = getMrrAlert(latest?.mrr, c.tier);
          return (
            <div key={c.id} className="bg-card border border-border rounded-xl px-5 py-4 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-semibold text-foreground">{c.full_name || 'Unnamed'}</p>
                    <select
                      value={c.tier ?? 'onramp'}
                      onChange={(e) => handleTierChange(c.id, e.target.value, c.full_name)}
                      className={`text-xs px-2 py-0.5 rounded-full font-semibold capitalize border cursor-pointer appearance-none text-center ${TIER_COLORS[c.tier] ?? TIER_COLORS.onramp} bg-transparent focus:outline-none focus:ring-1 focus:ring-primary/40`}
                    >
                      {TIERS.map((t) => (
                        <option key={t} value={t} className="bg-card text-foreground">{t}</option>
                      ))}
                    </select>
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

              {alert && (
                <div className={`flex items-center gap-2 text-xs font-semibold ${alert.color} bg-muted/50 rounded-lg px-3 py-2`}>
                  <ArrowUpCircle className="w-4 h-4 shrink-0" />
                  <span className="flex-1">{alert.message}</span>
                  <button
                    onClick={() => handleTierChange(c.id, alert.suggested, c.full_name)}
                    className="ml-2 px-3 py-1 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors text-xs font-semibold"
                  >
                    Upgrade →
                  </button>
                </div>
              )}
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

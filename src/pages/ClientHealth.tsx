import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
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

const PILLARS = [
  { key: 'build', label: 'Build', color: 'bg-purple-400' },
  { key: 'traffic', label: 'Traffic', color: 'bg-violet-400' },
  { key: 'sales', label: 'Sales', color: 'bg-fuchsia-400' },
  { key: 'scale', label: 'Scale', color: 'bg-indigo-400' },
];

const SCORE_COLORS: Record<string, string> = {
  green: 'bg-success',
  amber: 'bg-warning',
  red: 'bg-destructive',
};

const MODULES_PER_PILLAR = 6;

export default function ClientHealth() {
  const { user, loading } = useRequireAuth();
  const queryClient = useQueryClient();

  const { data: clients } = useQuery({
    queryKey: ['all-clients'],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email, tier, created_at, coach_notes');
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

  const { data: allScores } = useQuery({
    queryKey: ['all-roadmap-scores'],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from('roadmap_scores')
        .select('user_id, pillar, module_number, score');
      return data ?? [];
    },
  });

  const getLatest = (userId: string) =>
    allMonthly?.find((m: any) => m.user_id === userId);

  const getUserScores = (userId: string) => {
    const userScores = allScores?.filter((s: any) => s.user_id === userId) ?? [];
    return PILLARS.map((pillar) => {
      const pillarScores = userScores.filter((s: any) => s.pillar === pillar.key);
      const green = pillarScores.filter((s: any) => s.score === 'green').length;
      const amber = pillarScores.filter((s: any) => s.score === 'amber').length;
      const red = pillarScores.filter((s: any) => s.score === 'red').length;
      return { ...pillar, green, amber, red, total: pillarScores.length };
    });
  };

  const getMrrAlert = (mrr: number | null | undefined, currentTier: string | null) => {
    if (!mrr) return null;
    if (mrr >= 20000 && currentTier !== 'scale') {
      return { type: 'upgrade' as const, message: 'Ready for Scale tier ($20k+ MRR)', suggested: 'scale', color: 'text-success' };
    }
    if (mrr >= 15000 && currentTier !== 'scale' && currentTier !== 'growth') {
      return { type: 'upgrade' as const, message: 'Ready for Growth tier ($15k+ MRR)', suggested: 'growth', color: 'text-primary' };
    }
    if (mrr < 15000 && currentTier === 'growth') {
      return { type: 'drop' as const, message: 'MRR dropped below $15k — consider moving back to Onramp', suggested: 'onramp', color: 'text-warning' };
    }
    if (mrr < 20000 && currentTier === 'scale') {
      return { type: 'drop' as const, message: 'MRR dropped below $20k — consider moving back to Growth', suggested: 'growth', color: 'text-destructive' };
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
      toast.success(`${name || 'Client'} updated to ${newTier}`);
      queryClient.invalidateQueries({ queryKey: ['all-clients'] });
    }
  };

  const updateNotes = useMutation({
    mutationFn: async ({ id, notes }: { id: string; notes: string }) => {
      const { error } = await supabase
        .from('profiles')
        .update({ coach_notes: notes })
        .eq('id', id);
      if (error) throw error;
    },
  });

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
          const scores = getUserScores(c.id);
          const totalGreen = scores.reduce((sum, s) => sum + s.green, 0);
          const totalModules = PILLARS.length * MODULES_PER_PILLAR;

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
                  <div>
                    <p className="text-xs text-muted-foreground">Roadmap</p>
                    <p className="font-bold text-foreground text-sm">{totalGreen}/{totalModules}</p>
                  </div>
                </div>
              </div>

              {/* Roadmap health bar */}
              {totalGreen + scores.reduce((s, p) => s + p.amber + p.red, 0) === 0 ? (
                <p className="text-xs text-muted-foreground italic px-1">No roadmap scores yet</p>
              ) : (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-semibold text-muted-foreground">Roadmap</p>
                    <div className="flex gap-3 text-xs text-muted-foreground ml-auto">
                      <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-success inline-block" /> {totalGreen} green</span>
                      <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-warning inline-block" /> {scores.reduce((s, p) => s + p.amber, 0)} amber</span>
                      <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-destructive inline-block" /> {scores.reduce((s, p) => s + p.red, 0)} red</span>
                    </div>
                  </div>
                  <div className="flex h-2.5 rounded-full overflow-hidden bg-muted-foreground/10">
                    {totalGreen > 0 && (
                      <div className="bg-success transition-all" style={{ width: `${(totalGreen / totalModules) * 100}%` }} />
                    )}
                    {scores.reduce((s, p) => s + p.amber, 0) > 0 && (
                      <div className="bg-warning transition-all" style={{ width: `${(scores.reduce((s, p) => s + p.amber, 0) / totalModules) * 100}%` }} />
                    )}
                    {scores.reduce((s, p) => s + p.red, 0) > 0 && (
                      <div className="bg-destructive transition-all" style={{ width: `${(scores.reduce((s, p) => s + p.red, 0) / totalModules) * 100}%` }} />
                    )}
                  </div>
                </div>
              )}

              {alert && (
                <div className={`flex items-center gap-2 text-xs font-semibold ${alert.color} bg-muted/50 rounded-lg px-3 py-2`}>
                  {alert.type === 'upgrade' ? <ArrowUpCircle className="w-4 h-4 shrink-0" /> : <ArrowDownCircle className="w-4 h-4 shrink-0" />}
                  <span className="flex-1">{alert.message}</span>
                  <button
                    onClick={() => handleTierChange(c.id, alert.suggested, c.full_name)}
                    className={`ml-2 px-3 py-1 rounded-md transition-colors text-xs font-semibold ${
                      alert.type === 'upgrade'
                        ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                        : 'bg-destructive/20 text-destructive hover:bg-destructive/30 border border-destructive/30'
                    }`}
                  >
                    {alert.type === 'upgrade' ? 'Upgrade →' : 'Downgrade →'}
                  </button>
                </div>
              )}

              {/* Coach Notes */}
              <div className="mt-3 pt-3 border-t border-border/50">
                <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                  Coach Notes <span className="font-normal opacity-60">(private)</span>
                </label>
                <textarea
                  defaultValue={c.coach_notes ?? ''}
                  onBlur={(e) => updateNotes.mutate({ id: c.id, notes: e.target.value })}
                  placeholder="Add private notes about this client..."
                  rows={2}
                  className="w-full px-3 py-2 bg-input border border-border rounded-lg text-foreground placeholder:text-muted-foreground text-xs focus:outline-none focus:ring-2 focus:ring-primary/40 transition resize-none"
                />
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

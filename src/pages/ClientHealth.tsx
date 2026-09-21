import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  HeartPulse, X, ChevronRight, TrendingUp, Trophy, Eye, Clock, ArrowUpCircle, AlertTriangle, DollarSign
} from 'lucide-react';
import PageLayout from '@/components/PageLayout';
import { supabase } from '@/lib/supabase';
import ClientDetailPanel from '@/components/client-health/ClientDetailPanel';
import { useRequireAuth } from '@/hooks/useAuth';
import { OWNER_USER_ID } from '@/lib/owner';
import { toast } from 'sonner';
import type { Row, ViewRow } from '@/lib/db';

/** One client as the admin overview returns them. */
import {
  type ClientOverview,
  type ClientWithHealth,
  TIER_OPTIONS,
  normalizeTier,
  formatTierLabel,
  ON_RAMP_MODULE_IDS,
  LOW_CONFIDENCE,
  LOW_NPS,
  TARGET_MARGIN,
  MIN_MARGIN,
  getMarginBand,
  calcHealthScoreV2,
  calcHealthScore,
  generateConclusion,
  BAND,
} from '@/lib/clientHealth';

export default function ClientHealth() {
  const { user } = useRequireAuth();
  const qc = useQueryClient();
  const [selectedClient, setSelectedClient] = useState<ClientWithHealth | null>(null);

  const { data: selfProfile } = useQuery({
    queryKey: ['self-profile', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('is_admin').eq('id', user!.id).single();
      return data;
    },
  });

  const { data: clients = [], isLoading } = useQuery({
    queryKey: ['admin-client-overview'],
    enabled: !!selfProfile?.is_admin,
    queryFn: async () => {
      const { data, error } = await supabase.from('admin_client_overview').select('*').order('full_name');
      if (error) throw error;
      return data ?? [];
    },
  });

  const changeTier = useMutation({
    mutationFn: async ({ clientId, tier }: { clientId: string; tier: string }) => {
      const nextTier = normalizeTier(tier);
      const { data, error } = await supabase
        .from('profiles')
        .update({ tier: nextTier })
        .eq('id', clientId)
        .select('id, tier');
      if (error) throw error;
      if (!data || data.length === 0) {
        throw new Error('Tier update blocked — no rows updated. Check admin permissions.');
      }
      return nextTier;
    },
    onSuccess: (nextTier) => {
      qc.invalidateQueries({ queryKey: ['admin-client-overview'] });
      setSelectedClient(prev => prev ? { ...prev, tier: nextTier } : prev);
      toast.success(`Tier updated to ${formatTierLabel(nextTier)}`);
    },
    onError: (err: Error) => {
      toast.error(err?.message || 'Failed to update tier');
    },
  });

  // Direction matters more than position: 20k -> 15k -> 10k and a flat 10k
  // look identical on a last-month-only view, and only one needs a call.
  const { data: revenueTrends = {} } = useQuery({
    queryKey: ['client-revenue-trends'],
    queryFn: async () => {
      const { data } = await supabase
        .from('monthly_totals')
        .select('user_id, month, total_revenue, mrr, mrr_manual, oneoff_revenue')
        .order('month', { ascending: false })
        .limit(600);

      const byUser: Record<string, number[]> = {};
      for (const row of data ?? []) {
        const revenue = Number(row.total_revenue)
          || (Number(row.mrr_manual || row.mrr || 0) + Number(row.oneoff_revenue || 0));
        (byUser[row.user_id] ??= []).push(revenue);
      }
      return byUser;
    },
  });


  // Fetch all checklist completions to detect on-ramp graduates
  const { data: allCompletions = [] } = useQuery({
    queryKey: ['all-checklist-completions'],
    enabled: !!selfProfile?.is_admin,
    queryFn: async () => {
      const { data } = await supabase.from('checklist_progress').select('user_id, task_key, completed').eq('completed', true);
      return data ?? [];
    },
  });

  // Both scorings are computed so the difference can be seen before committing.
  const [scoringMode, setScoringMode] = useState<'current' | 'new'>('current');

  const clientsWithHealth = useMemo(() =>
    clients.map((c: ClientOverview) => {
      const clientCompletedKeys = allCompletions
        .filter(cp => cp.user_id === c.id)
        .map(cp => cp.task_key);
      const allOnRampDone = ON_RAMP_MODULE_IDS.every(id => clientCompletedKeys.includes(id));

      const tier = normalizeTier(c.tier);
      const monthlyRevenue = Number(c.last_total_revenue || 0);

      // Ready to move from Onboarding → In Flow (under $20k) once all on-ramp modules are done.
      const readyForInFlow = tier === 'onboarding' && allOnRampDone;
      // Ready to step up from "under $20k" → "over $20k" once they cross $20k/mth.
      const readyForOver20k = tier === 'in_flow_starter' && monthlyRevenue >= 20000;

      return {
        ...c,
        health: scoringMode === 'new' ? calcHealthScoreV2(c) : calcHealthScore(c),
        healthCurrent: calcHealthScore(c),
        healthNew: calcHealthScoreV2(c),
        conclusion: generateConclusion(c),
        readyForInFlow,
        readyForOver20k,
        monthlyRevenue,
      };
    }).sort((a, b) => b.health.score - a.health.score),
    [clients, allCompletions, scoringMode]
  );


  const bandMoves = useMemo(() =>
    clientsWithHealth
      .filter(c => c.healthCurrent.band !== c.healthNew.band)
      .map(c => ({
        name: c.full_name || 'Unnamed Client',
        from: c.healthCurrent.band as 'green' | 'amber' | 'red',
        to: c.healthNew.band as 'green' | 'amber' | 'red',
      })),
    [clientsWithHealth],
  );

  const greenCount = clientsWithHealth.filter(c => c.health.band === 'green').length;
  const amberCount = clientsWithHealth.filter(c => c.health.band === 'amber').length;
  const redCount   = clientsWithHealth.filter(c => c.health.band === 'red').length;
  const readyForInFlow = clientsWithHealth.filter(c => c.readyForInFlow);
  const readyForOver20k = clientsWithHealth.filter(c => c.readyForOver20k);



  const { data: pageViewAgg = [] } = useQuery({
    queryKey: ['page-view-agg'],
    enabled: !!selfProfile?.is_admin,
    queryFn: async () => {
      const { data } = await supabase.from('page_views').select('page').limit(500);
      return data ?? [];
    },
  });
  const pageCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    pageViewAgg.forEach(v => { counts[v.page] = (counts[v.page] || 0) + 1; });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [pageViewAgg]);

  if (!selfProfile?.is_admin) {
    return <PageLayout><p className="text-muted-foreground">Admin access required.</p></PageLayout>;
  }

  return (
    <PageLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <HeartPulse className="w-6 h-6 text-primary" /> Client Health
        </h1>
        <p className="text-sm text-muted-foreground">Click any client to view their full profile and manage their tier.</p>
      </div>

      <div className="mb-6 border border-border rounded-xl p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">Scoring</p>
            <p className="text-xs text-muted-foreground max-w-xl">
              {scoringMode === 'current'
                ? 'Current: bands come from net margin alone — the score underneath never moves anyone between colours.'
                : 'New: net margin carries the most weight, with revenue, leads, cost to acquire and conversion alongside it — and the score sets the band rather than margin alone.'}
            </p>
          </div>
          <div className="flex gap-1 shrink-0">
            {(['current', 'new'] as const).map(mode => (
              <button
                key={mode}
                onClick={() => setScoringMode(mode)}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                  scoringMode === mode
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                }`}
              >
                {mode === 'current' ? 'Current' : 'New'}
              </button>
            ))}
          </div>
        </div>

        {bandMoves.length > 0 ? (
          <div className="mt-3 pt-3 border-t border-border">
            <p className="text-xs text-muted-foreground mb-2">
              {bandMoves.length} client{bandMoves.length === 1 ? '' : 's'} would change band:
            </p>
            <div className="flex flex-wrap gap-2">
              {bandMoves.map(move => (
                <span key={move.name} className="text-xs border border-border rounded-full px-2.5 py-1">
                  <span className="text-foreground font-medium">{move.name}</span>
                  <span className="text-muted-foreground"> {BAND[move.from].label} → </span>
                  <span className={BAND[move.to].text}>{BAND[move.to].label}</span>
                </span>
              ))}
            </div>
          </div>
        ) : (
          <p className="mt-3 pt-3 border-t border-border text-xs text-muted-foreground">
            Both scorings put every client in the same band right now.
          </p>
        )}
      </div>

      {user?.id === OWNER_USER_ID && <TotalNewMrrCard />}


      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: 'On Track',   count: greenCount, band: 'green' as const },
          { label: 'Good',       count: amberCount, band: 'amber' as const },
          { label: 'Needs Help', count: redCount,   band: 'red'   as const },
        ].map(({ label, count, band }) => {
          const s = BAND[band];
          return (
            <div key={band} className={`${s.bg} border ${s.border} rounded-xl p-4 text-center`}>
              <p className={`text-3xl font-bold ${s.text}`}>{count}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
            </div>
          );
        })}
      </div>


      {/* Ready to graduate from Onboarding → In Flow (under $20k) */}
      {readyForInFlow.length > 0 && (
        <div className="bg-purple-500/10 border border-purple-500/30 rounded-xl p-4 mb-4">
          <div className="flex items-center gap-2 mb-2">
            <ArrowUpCircle className="w-5 h-5 text-purple-400" />
            <h2 className="text-sm font-bold text-purple-400">Ready to Move to In Flow</h2>
          </div>
          <p className="text-xs text-muted-foreground mb-3">
            {readyForInFlow.length === 1 ? 'This client has' : `${readyForInFlow.length} clients have`} finished all On-Ramp modules — ready to graduate from Onboarding.
          </p>
          <div className="space-y-2">
            {readyForInFlow.map(client => (
              <div key={client.id} className="flex items-center justify-between bg-card/50 rounded-lg p-3 border border-border">
                <div>
                  <span className="text-sm font-semibold text-foreground">{client.full_name}</span>
                  {client.monthlyRevenue > 0 && (
                    <span className="ml-2 text-xs text-muted-foreground">${Number(client.monthlyRevenue).toLocaleString()}/mo</span>
                  )}
                </div>
                <button
                  onClick={() => changeTier.mutate({ clientId: client.id, tier: 'in_flow_starter' })}
                  className="px-3 py-1 text-xs font-bold rounded-lg bg-purple-500/20 text-purple-400 hover:bg-purple-500/30 transition"
                >
                  Move to In Flow →
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Ready to step up from under $20k → over $20k */}
      {readyForOver20k.length > 0 && (
        <div className="bg-orange-500/10 border border-orange-500/30 rounded-xl p-4 mb-6">
          <div className="flex items-center gap-2 mb-2">
            <ArrowUpCircle className="w-5 h-5 text-orange-400" />
            <h2 className="text-sm font-bold text-orange-400">Ready to Step Up — Over $20k/mth</h2>
          </div>
          <p className="text-xs text-muted-foreground mb-3">
            {readyForOver20k.length === 1 ? 'This client has' : `${readyForOver20k.length} clients have`} crossed $20k/month — unlock the full roadmap.
          </p>
          <div className="space-y-2">
            {readyForOver20k.map(client => (
              <div key={client.id} className="flex items-center justify-between bg-card/50 rounded-lg p-3 border border-border">
                <div>
                  <span className="text-sm font-semibold text-foreground">{client.full_name}</span>
                  <span className="ml-2 text-xs text-muted-foreground">${Number(client.monthlyRevenue).toLocaleString()}/mo</span>
                </div>
                <button
                  onClick={() => changeTier.mutate({ clientId: client.id, tier: 'in_flow_scale' })}
                  className="px-3 py-1 text-xs font-bold rounded-lg bg-orange-500/20 text-orange-400 hover:bg-orange-500/30 transition"
                >
                  Unlock Over $20k →
                </button>
              </div>
            ))}

          </div>
        </div>
      )}

      {pageCounts.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-5 mb-6">
          <div className="flex items-center gap-2 mb-2">
            <Eye className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-semibold text-foreground">Where Clients Spend Time</h2>
          </div>
          <p className="text-xs text-muted-foreground mb-3">Total page visits across all clients — tells you where to focus your coaching.</p>
          <div className="space-y-2">
            {pageCounts.slice(0, 6).map(([page, count]) => {
              const pct = Math.round((count / (pageCounts[0]?.[1] || 1)) * 100);
              return (
                <div key={page} className="flex items-center gap-3">
                  <span className="text-sm text-foreground capitalize w-28 shrink-0">{page.replace('-', ' ')}</span>
                  <div className="flex-1 bg-muted rounded-full h-2">
                    <div className="bg-primary rounded-full h-2" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-xs text-muted-foreground w-14 text-right">{count} visits</span>
                </div>
              );
            })}
          </div>
          {pageCounts[0] && (
            <p className="text-xs text-primary mt-3">
              💡 Most visited: <strong className="capitalize">{pageCounts[0][0].replace('-', ' ')}</strong> — focus coaching effort here.
            </p>
          )}
        </div>
      )}

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading clients...</p>
      ) : clientsWithHealth.length === 0 ? (
        <p className="text-sm text-muted-foreground">No clients have submitted data yet.</p>
      ) : (
        <div className="space-y-3">
          {clientsWithHealth.map(client => {
            const { health, conclusion } = client;
            const s = BAND[health.band as keyof typeof BAND];
            return (
              <button
                key={client.id}
                onClick={() => setSelectedClient(client)}
                className={`w-full text-left bg-card border ${s.border} rounded-xl p-4 hover:border-primary/50 transition-all flex items-center gap-4`}
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className={`w-3 h-3 rounded-full shrink-0 ${s.dot}`} />
                  <div className="min-w-0">
                    <p className="font-semibold text-foreground truncate">{client.full_name || 'Unnamed Client'}</p>
                    <p className="text-xs text-muted-foreground">{formatTierLabel(client.tier)} tier</p>
                  </div>
                </div>

                <div className="hidden sm:flex items-center gap-6 text-xs text-muted-foreground shrink-0">
                  <span>{formatTierLabel(client.tier)}</span>
                  <span className="flex items-center gap-1.5">
                    ${Number(client.last_total_revenue || 0).toLocaleString()}/mo
                    {(() => {
                      const series = (revenueTrends as Record<string, number[]>)[client.id];
                      if (!series || series.length < 2) return null;
                      const [latest, previous] = series;
                      if (!previous) return null;
                      const change = Math.round(((latest - previous) / previous) * 100);
                      if (Math.abs(change) < 5) return <span className="text-muted-foreground">flat</span>;
                      return (
                        <span className={change > 0 ? 'text-green-400' : 'text-orange-400'}>
                          {change > 0 ? '▲' : '▼'} {Math.abs(change)}%
                        </span>
                      );
                    })()}
                  </span>
                  {client.days_since_last_login !== null && (
                    <span className={Number(client.days_since_last_login) > 14 ? 'text-orange-400' : ''}>
                      Last login: {client.days_since_last_login}d ago
                    </span>
                  )}
                </div>

                <span className={`hidden sm:inline-block px-2 py-0.5 rounded-full text-xs font-semibold shrink-0 ${s.bg} ${s.text}`}>
                  {s.label}
                </span>

                <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
              </button>
            );
          })}
        </div>
      )}

      {/* SLIDE-OVER PANEL */}
      {selectedClient && (
        <ClientDetailPanel
          client={clientsWithHealth.find(x => x.id === selectedClient.id) || selectedClient}
          onClose={() => setSelectedClient(null)}
          changeTier={changeTier}
        />
      )}
    </PageLayout>
  );
}

function TotalNewMrrCard() {
  const { data: rows = [] } = useQuery({
    queryKey: ['owner-total-mrr-growth'],
    queryFn: async () => {
      const { data } = await supabase
        .from('monthly_totals')
        .select('user_id, month, mrr, mrr_manual, new_clients_total_value, new_clients_is_mrr')
        .order('month', { ascending: true });
      return data ?? [];
    },
  });

  // Per-student MRR growth: (latest MRR − first MRR), floored at 0. Sums total MRR
  // students have gained since their first submission — "how much MRR I've helped my clients add".
  const byUser: Record<string, { first: number; last: number }> = {};
  for (const r of rows) {
    const m = Number(r.mrr_manual ?? r.mrr ?? 0) || 0;
    const u = r.user_id;
    if (!byUser[u]) byUser[u] = { first: m, last: m };
    else byUser[u].last = m; // rows are sorted ascending, so the last one wins
  }
  const perUserGrowth = Object.entries(byUser).map(([u, v]) => ({ u, growth: Math.max(v.last - v.first, 0) }));
  const totalGrowth = perUserGrowth.reduce((s, x) => s + x.growth, 0);
  const contributors = perUserGrowth.filter((x) => x.growth > 0).length;
  const studentCount = Object.keys(byUser).length;

  // Secondary metric: cumulative new-client revenue booked across every submission.
  const totalNewClientRevenue = rows.reduce((sum, r) => sum + (Number(r.new_clients_total_value) || 0), 0);

  return (
    <div className="bg-gradient-to-br from-primary/20 to-purple-600/10 border border-primary/40 rounded-xl p-5 mb-6">
      <div className="flex items-center gap-2 mb-1">
        <DollarSign className="w-5 h-5 text-primary" />
        <h2 className="text-xs font-bold uppercase tracking-wider text-primary">Total ProfitX MRR Generated (Owner Only)</h2>
      </div>
      <p className="text-3xl font-bold text-foreground">
        ${totalGrowth.toLocaleString()}
        <span className="text-sm font-normal text-muted-foreground"> MRR gained</span>
      </p>
      <p className="text-xs text-muted-foreground mt-1">
        Sum of every student's MRR growth from their first submission to their latest. {contributors} of {studentCount} student{studentCount === 1 ? '' : 's'} showing MRR growth.
      </p>
      <div className="mt-3 pt-3 border-t border-primary/20 flex items-baseline gap-2">
        <span className="text-xs uppercase tracking-wider text-muted-foreground">New client revenue booked:</span>
        <span className="text-lg font-bold text-foreground">${totalNewClientRevenue.toLocaleString()}</span>
      </div>
    </div>
  );
}



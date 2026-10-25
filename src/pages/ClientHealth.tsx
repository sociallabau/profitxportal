import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { HeartPulse, ArrowUpCircle, Trophy, Search, LayoutGrid, Table2, ClipboardCheck, ChevronRight, ChevronLeft, CheckCircle2 } from 'lucide-react';
import PageLayout from '@/components/PageLayout';
import { supabase } from '@/lib/supabase';
import ClientDetailPanel from '@/components/client-health/ClientDetailPanel';
import { useRequireAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import type { Row, ViewRow } from '@/lib/db';

/** One client as the admin overview returns them. */
import {
  type ClientOverview,
  type ClientWithHealth,
  TIER_OPTIONS,
  normalizeTier,
  formatTierLabel,
  LOW_CONFIDENCE,
  LOW_NPS,
  TARGET_MARGIN,
  MIN_MARGIN,
  getMarginBand,
  calcHealthScore,
  generateConclusion,
  BAND,
} from '@/lib/clientHealth';
import { computeDrift, DRIFT_BAND, gateNumber, type DriftBand } from '@/lib/driftRisk';
import { gateHealth, type GateMonth } from '@/lib/gateHealth';
import { ROMAN, gateNumber as gateNum, monthKey, type TaskProgress, type TaskTracking } from '@/lib/growthHub';
import { useGrowthHubContent } from '@/hooks/useGrowthHub';

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
  const { data: revenueTrends = { revenue: {}, confidence: {} } } = useQuery({
    queryKey: ['client-revenue-trends'],
    queryFn: async (): Promise<{ revenue: Record<string, number[]>; confidence: Record<string, (number | null)[]> }> => {
      const { data } = await supabase
        .from('monthly_totals')
        .select('user_id, month, total_revenue, mrr, mrr_manual, oneoff_revenue, business_confidence')
        .order('month', { ascending: false })
        .limit(600);

      const byUser: Record<string, number[]> = {};
      const confidenceByUser: Record<string, (number | null)[]> = {};
      for (const row of data ?? []) {
        const revenue = Number(row.total_revenue)
          || (Number(row.mrr_manual || row.mrr || 0) + Number(row.oneoff_revenue || 0));
        (byUser[row.user_id] ??= []).push(revenue);
        (confidenceByUser[row.user_id] ??= []).push(row.business_confidence ?? null);
      }
      return { revenue: byUser, confidence: confidenceByUser };
    },
  });

  // profiles.gate per member — drives the stalled-gate drift signal.
  const { data: clientGates = {} } = useQuery({
    queryKey: ['client-gates'],
    enabled: !!selfProfile?.is_admin,
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('id, gate');
      const byId: Record<string, string | null> = {};
      for (const row of data ?? []) byId[row.id] = row.gate ?? null;
      return byId;
    },
  });


  // The gate system: every build task, each member's ticks, their gate-bar numbers and Dan AI's read on them.
  const { data: content } = useGrowthHubContent();
  const { data: gateData = { progress: {}, months: {}, focus: {}, tracking: {}, newClients: {} } } = useQuery({
    queryKey: ['client-gate-health'],
    enabled: !!selfProfile?.is_admin,
    queryFn: async () => {
      const thisMonth = monthKey();
      const [progress, months, memory, tracking, signed] = await Promise.all([
        supabase.from('member_task_progress').select('*'),
        supabase.from('monthly_totals').select('user_id, month, content_posts, leads_generated, new_clients').order('month', { ascending: false }).limit(1000),
        supabase.from('member_memory').select('user_id, memory, brief'),
        // Live this month, before the check-in: build-list tallies and clients logged as signed.
        supabase.from('member_task_tracking').select('user_id, task_id, period, working, count').eq('period', thisMonth),
        supabase.from('new_clients').select('user_id').gte('signed_date', `${thisMonth}-01`),
      ]);
      const byUser = <T extends { user_id: string }>(rows: T[]) =>
        rows.reduce<Record<string, T[]>>((acc, r) => ((acc[r.user_id] ??= []).push(r), acc), {});
      const focus: Record<string, string> = {};
      for (const m of memory.data ?? []) {
        const f = (m.memory as { next_focus?: string } | null)?.next_focus ?? m.brief;
        if (f) focus[m.user_id] = f;
      }
      return {
        progress: byUser((progress.data ?? []) as (TaskProgress & { user_id: string })[]),
        months: byUser((months.data ?? []) as (GateMonth & { user_id: string })[]),
        focus,
        tracking: byUser((tracking.data ?? []) as (TaskTracking & { user_id: string })[]),
        newClients: (signed.data ?? []).reduce<Record<string, number>>((acc, r) => ((acc[r.user_id] = (acc[r.user_id] ?? 0) + 1), acc), {}),
      };
    },
  });

  // Both scorings are computed so the difference can be seen before committing.

  const { data: archivedIds = [] } = useQuery({
    queryKey: ['archived-clients'],
    queryFn: async () => {
      const { data } = await supabase
        .from('profiles')
        .select('id')
        .not('archived_at', 'is', null);
      return (data ?? []).map(row => row.id);
    },
  });

  const [search, setSearch] = useState('');
  const [bandFilter, setBandFilter] = useState<'all' | 'green' | 'amber' | 'red'>('all');
  const [needsSupportOnly, setNeedsSupportOnly] = useState(false);
  const [sortByDrift, setSortByDrift] = useState(false);
  const [viewMode, setViewMode] = useState<'table' | 'board' | 'quarterly'>('table');
  const [flaggedIds, setFlaggedIds] = useState<string[]>([]);
  const [reviewIndex, setReviewIndex] = useState(0);

  const clientsWithHealth = useMemo(() => {
    return clients
      .filter((c: ClientOverview) => !archivedIds.includes(c.id))
      .map((c: ClientOverview) => {
      const monthlyRevenue = Number(c.last_total_revenue || 0);
      const gh = gateHealth(gateNum(clientGates[c.id]), content?.tasks ?? [], gateData.progress[c.id] ?? [], gateData.months[c.id] ?? [], monthKey(), {
        tracking: gateData.tracking[c.id] ?? [], newClientsThisMonth: gateData.newClients[c.id] ?? 0,
      });

      const drift = computeDrift({
        revenueSeries: revenueTrends.revenue?.[c.id] ?? [],
        daysSinceSubmission: c.days_since_submission != null ? Number(c.days_since_submission) : null,
        confidenceSeries: revenueTrends.confidence?.[c.id] ?? [],
      });

      return {
        ...c,
        health: calcHealthScore(c),
        conclusion: generateConclusion(c),
        gh,
        danFocus: gateData.focus[c.id] ?? null,
        monthlyRevenue,
        drift,
        gate: clientGates[c.id] ?? null,
      };
    }).sort((a, b) => b.health.score - a.health.score);
  }, [clients, archivedIds, revenueTrends, clientGates, content, gateData]);


  const greenCount = clientsWithHealth.filter(c => c.health.band === 'green').length;
  const amberCount = clientsWithHealth.filter(c => c.health.band === 'amber').length;
  const redCount   = clientsWithHealth.filter(c => c.health.band === 'red').length;
  const readyToMoveUp = clientsWithHealth.filter(c => c.gh.readyToMoveUp);
  const hitThisMonth = clientsWithHealth.filter(c => c.gh.hitThisMonth && !c.gh.readyToMoveUp);
  const waitingOnDan = clientsWithHealth.filter(c => c.gh.toApprove > 0);




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



      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: 'On Track',   count: greenCount, band: 'green' as const },
          { label: 'Good',       count: amberCount, band: 'amber' as const },
          { label: 'Needs Help', count: redCount,   band: 'red'   as const },
        ].map(({ label, count, band }) => {
          const s = BAND[band];
          const active = bandFilter === band;
          return (
            <button
              key={band}
              onClick={() => setBandFilter(active ? 'all' : band)}
              className={`${s.bg} border ${active ? 'border-primary ring-2 ring-primary/30' : s.border} rounded-xl p-4 text-center`}
            >
              <p className={`text-3xl font-bold ${s.text}`}>{count}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
            </button>
          );
        })}
      </div>


      {/* Ready to move up a gate: every gate goal hit 2 months running (check-ins, or last month's check-in + this month live) */}
      {readyToMoveUp.length > 0 && (
        <div className="bg-purple-500/10 border border-purple-500/30 rounded-xl p-4 mb-4">
          <div className="flex items-center gap-2 mb-2">
            <ArrowUpCircle className="w-5 h-5 text-primary" />
            <h2 className="text-sm font-bold text-primary">Ready to move up a gate</h2>
          </div>
          <p className="text-xs text-muted-foreground mb-3">
            Hit every gate goal 2 months running. Check their build list, then move them up in their profile.
          </p>
          <div className="space-y-2">
            {readyToMoveUp.map(client => (
              <button
                key={client.id}
                onClick={() => setSelectedClient(client)}
                className="w-full flex items-center justify-between bg-card/50 rounded-lg p-3 border border-border hover:bg-card transition text-left"
              >
                <span className="text-sm font-semibold text-foreground">{client.full_name}</span>
                <span className="text-xs text-muted-foreground">
                  Gate {ROMAN[client.gh.gate!]} → {ROMAN[client.gh.gate! + 1]} · {client.gh.goals.map(g => `${g.label} ${g.live}/${g.target}`).join(' · ')} ·{' '}
                  <span className={client.gh.buildApproved ? 'text-primary font-semibold' : 'text-orange-600 font-semibold'}>
                    {client.gh.buildApproved ? 'build list approved' : `build list ${client.gh.build.approved}/${client.gh.build.total} approved`}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Hit every gate goal this month, live from check-ins, build-list tallies and logged clients */}
      {hitThisMonth.length > 0 && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4 mb-4">
          <div className="flex items-center gap-2 mb-2">
            <Trophy className="w-5 h-5 text-emerald-600" />
            <h2 className="text-sm font-bold text-emerald-700">Hit their gate goals this month ({hitThisMonth.length})</h2>
          </div>
          <p className="text-xs text-muted-foreground mb-3">
            Every goal for their gate is at target this month. Hold it next month and they show up above, ready to move up.
          </p>
          <div className="space-y-2">
            {hitThisMonth.map(client => (
              <button
                key={client.id}
                onClick={() => setSelectedClient(client)}
                className="w-full flex items-center justify-between bg-card/50 rounded-lg p-3 border border-border hover:bg-card transition text-left"
              >
                <span className="text-sm font-semibold text-foreground">{client.full_name}</span>
                <span className="text-xs text-muted-foreground">
                  Gate {ROMAN[client.gh.gate!]} · {client.gh.goals.map(g => `${g.label} ${g.live}/${g.target}`).join(' · ')}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Ticks waiting on Dan's approval (proof comes in on WhatsApp) */}
      {waitingOnDan.length > 0 && (
        <div className="bg-orange-500/10 border border-orange-500/30 rounded-xl p-4 mb-6">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle2 className="w-5 h-5 text-orange-600" />
            <h2 className="text-sm font-bold text-orange-600">
              Waiting on your approval ({waitingOnDan.reduce((n, c) => n + c.gh.toApprove, 0)})
            </h2>
          </div>
          <p className="text-xs text-muted-foreground mb-3">
            They've ticked these off and sent proof on WhatsApp. Approve or send back in their Growth Hub.
          </p>
          <div className="flex flex-wrap gap-2">
            {waitingOnDan.map(client => (
              <button
                key={client.id}
                onClick={() => setSelectedClient(client)}
                className="px-3 py-1.5 rounded-lg bg-card/60 border border-border text-xs font-semibold hover:bg-card transition"
              >
                {client.full_name} · {client.gh.toApprove}
              </button>
            ))}
          </div>
        </div>
      )}

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading clients...</p>
      ) : clientsWithHealth.length === 0 ? (
        <p className="text-sm text-muted-foreground">No clients have submitted data yet.</p>
      ) : (() => {
        const term = search.trim().toLowerCase();
        const driftWeight: Record<DriftBand, number> = { red: 2, amber: 1, green: 0 };
        const visible = clientsWithHealth
          .filter(c =>
            (bandFilter === 'all' || c.health.band === bandFilter) &&
            (!needsSupportOnly || c.drift?.band === 'red') &&
            (!term || (c.full_name ?? '').toLowerCase().includes(term)),
          )
          .sort((a, b) => sortByDrift
            ? driftWeight[b.drift?.band ?? 'green'] - driftWeight[a.drift?.band ?? 'green']
            : 0);
        const needsSupport = clientsWithHealth.filter(c => c.drift?.band === 'red');

        const modeBtn = (mode: typeof viewMode, label: string, Icon: typeof Table2) => (
          <button
            key={mode}
            onClick={() => setViewMode(mode)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              viewMode === mode ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/70'
            }`}
          >
            <Icon className="w-3.5 h-3.5" /> {label}
          </button>
        );

        return (
          <>
          <div className="flex flex-wrap items-center gap-2 mb-4">
            {modeBtn('table', 'Table', Table2)}
            {modeBtn('board', 'Board', LayoutGrid)}
            {modeBtn('quarterly', 'Quarterly Review', ClipboardCheck)}
            <button
              onClick={() => setNeedsSupportOnly(v => !v)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                needsSupportOnly ? 'bg-red-500/20 text-destructive ring-1 ring-red-500/40' : 'bg-muted text-muted-foreground hover:bg-muted/70'
              }`}
            >
              Needs Support ({needsSupport.length})
            </button>
            {viewMode === 'table' && (
              <button
                onClick={() => setSortByDrift(v => !v)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  sortByDrift ? 'bg-primary/20 text-primary ring-1 ring-primary/40' : 'bg-muted text-muted-foreground hover:bg-muted/70'
                }`}
              >
                Sort by drift risk
              </button>
            )}
          </div>

          {viewMode === 'board' ? (
            <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-4">
              {([
                { gate: '1', name: 'Fix' },
                { gate: '2', name: 'Fuel' },
                { gate: '3', name: 'Scale' },
                { gate: '4', name: 'Supercharge' },
              ]).map(({ gate, name }) => {
                const members = visible.filter(c => gateNumber(c.gate) === gate);
                return (
                  <div key={gate} className="bg-card border border-border rounded-xl p-4">
                    <h3 className="text-sm font-bold text-foreground mb-3">
                      Gate {gate} · {name}
                      <span className="ml-2 text-xs font-normal text-muted-foreground">{members.length}</span>
                    </h3>
                    <div className="space-y-2">
                      {members.length === 0 && (
                        <p className="text-xs text-muted-foreground">No one here.</p>
                      )}
                      {members.map(client => {
                        const d = DRIFT_BAND[client.drift?.band ?? 'green'];
                        return (
                          <button
                            key={client.id}
                            onClick={() => setSelectedClient(client)}
                            className="w-full text-left bg-muted/30 border border-border rounded-lg p-3 hover:bg-muted/50 transition"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-sm font-semibold text-foreground truncate">{client.full_name || 'Unnamed'}</span>
                              <span className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold ${d.bg} ${d.text}`}>{d.label}</span>
                            </div>
                            {client.drift && client.drift.signals.length > 0 && (
                              <p className="mt-1 text-[11px] text-muted-foreground">{client.drift.signals.join(' · ')}</p>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : viewMode === 'quarterly' ? (() => {
            const queue = clientsWithHealth;
            const done = reviewIndex >= queue.length;
            const current = queue[reviewIndex];
            const advance = (flag: boolean) => {
              if (flag && current) setFlaggedIds(prev => [...new Set([...prev, current.id])]);
              setReviewIndex(i => i + 1);
            };
            return (
              <div className="bg-card border border-border rounded-xl p-6 max-w-xl mx-auto">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-bold text-foreground">Quarterly Review</h3>
                  <span className="text-xs text-muted-foreground">
                    {Math.min(reviewIndex + 1, queue.length)} of {queue.length}
                  </span>
                </div>
                <div className="w-full bg-muted rounded-full h-1.5 mb-6">
                  <div className="bg-primary rounded-full h-1.5 transition-all" style={{ width: `${(reviewIndex / Math.max(queue.length, 1)) * 100}%` }} />
                </div>
                {done ? (
                  <div>
                    <p className="text-sm font-semibold text-foreground mb-3">
                      Review done — {flaggedIds.length} flagged for support.
                    </p>
                    {flaggedIds.length > 0 && (
                      <ul className="space-y-1.5 mb-4">
                        {queue.filter(c => flaggedIds.includes(c.id)).map(c => (
                          <li key={c.id} className="flex items-center justify-between text-sm">
                            <button onClick={() => setSelectedClient(c)} className="font-semibold text-foreground hover:text-primary transition">
                              {c.full_name}
                            </button>
                            <span className="text-xs text-muted-foreground">{c.drift?.signals.join(' · ') || 'flagged manually'}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                    <button
                      onClick={() => { setReviewIndex(0); setFlaggedIds([]); }}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-muted text-muted-foreground hover:bg-muted/70 transition"
                    >
                      Start again
                    </button>
                  </div>
                ) : current && (
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <p className="text-lg font-bold text-foreground">{current.full_name}</p>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${DRIFT_BAND[current.drift?.band ?? 'green'].bg} ${DRIFT_BAND[current.drift?.band ?? 'green'].text}`}>
                        {DRIFT_BAND[current.drift?.band ?? 'green'].label}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mb-3">
                      {current.gate ?? `Gate ${gateNumber(current.gate)}`} · {formatTierLabel(current.tier)} · ${Number(current.last_total_revenue || 0).toLocaleString()}/mo
                    </p>
                    {current.drift && current.drift.signals.length > 0 ? (
                      <ul className="space-y-1 mb-5">
                        {current.drift.signals.map(sig => (
                          <li key={sig} className="text-sm text-orange-600">• {sig}</li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-success mb-5">No drift signals — numbers are moving.</p>
                    )}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => advance(true)}
                        className="flex-1 py-2 rounded-lg text-sm font-semibold bg-red-500/15 text-destructive hover:bg-red-500/25 transition"
                      >
                        Flag for support
                      </button>
                      <button
                        onClick={() => advance(false)}
                        className="flex-1 py-2 rounded-lg text-sm font-semibold bg-green-500/15 text-success hover:bg-green-500/25 transition"
                      >
                        Looks fine
                      </button>
                    </div>
                    <div className="flex items-center justify-between mt-3">
                      <button
                        onClick={() => setReviewIndex(i => Math.max(0, i - 1))}
                        disabled={reviewIndex === 0}
                        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition disabled:opacity-40"
                      >
                        <ChevronLeft className="w-3.5 h-3.5" /> Back
                      </button>
                      <button
                        onClick={() => setSelectedClient(current)}
                        className="text-xs text-primary hover:underline"
                      >
                        Open full profile
                      </button>
                      <button
                        onClick={() => advance(false)}
                        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition"
                      >
                        Skip <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })() : (
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="flex flex-wrap items-center gap-3 p-3 border-b border-border">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search clients"
                  className="w-full pl-9 pr-3 py-2 bg-input border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>
              <span className="text-xs text-muted-foreground">
                {visible.length} of {clientsWithHealth.length}
                {bandFilter !== 'all' && (
                  <button onClick={() => setBandFilter('all')} className="ml-2 text-primary hover:underline">
                    clear filter
                  </button>
                )}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[780px]">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border">
                    <th className="py-2.5 px-4 font-semibold">Client</th>
                    <th className="py-2.5 px-3 font-semibold">Gate</th>
                    <th className="py-2.5 px-3 font-semibold">Build list</th>
                    <th className="py-2.5 px-3 font-semibold">Revenue</th>
                    <th className="py-2.5 px-3 font-semibold">Drift</th>
                    <th className="py-2.5 px-3 font-semibold">Last login</th>
                    <th className="py-2.5 px-4 font-semibold text-right">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map(client => {
                    const s = BAND[client.health.band as keyof typeof BAND];
                    const d = DRIFT_BAND[client.drift?.band ?? 'green'];
                    const series = revenueTrends.revenue?.[client.id];
                    const [latest, previous] = series ?? [];
                    const change = series && series.length > 1 && previous
                      ? Math.round(((latest - previous) / previous) * 100)
                      : null;
                    const days = client.days_since_last_login;

                    return (
                      <tr
                        key={client.id}
                        onClick={() => setSelectedClient(client)}
                        className="border-b border-border/60 last:border-0 cursor-pointer hover:bg-muted/40 transition-colors"
                      >
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${s.dot}`} />
                            <span className="font-semibold text-foreground truncate">
                              {client.full_name || 'Unnamed Client'}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-3 text-muted-foreground whitespace-nowrap">
                          {client.gh.gate ? `Gate ${ROMAN[client.gh.gate]}` : 'No gate'}
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap">
                          {client.gh.build.total ? (
                            <>
                              <span className="text-foreground">{client.gh.build.approved}/{client.gh.build.total}</span>
                              {client.gh.toApprove > 0 && <span className="ml-1.5 text-xs text-orange-600">{client.gh.toApprove} to approve</span>}
                              {client.gh.sentBack > 0 && <span className="ml-1.5 text-xs text-destructive">{client.gh.sentBack} sent back</span>}
                              {client.gh.behind.length > 0 && (
                                <p className="mt-0.5 text-[10px] text-muted-foreground">{client.gh.behind.join(' · ')}</p>
                              )}
                            </>
                          ) : <span className="text-muted-foreground">—</span>}
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap">
                          <span className="text-foreground">${Number(client.last_total_revenue || 0).toLocaleString()}</span>
                          {change !== null && (
                            Math.abs(change) < 5
                              ? <span className="ml-1.5 text-xs text-muted-foreground">flat</span>
                              : <span className={`ml-1.5 text-xs ${change > 0 ? 'text-success' : 'text-orange-600'}`}>
                                  {change > 0 ? '▲' : '▼'} {Math.abs(change)}%
                                </span>
                          )}
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap">
                          <span
                            title={client.drift?.signals.join(' · ')}
                            className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${d.bg} ${d.text}`}
                          >
                            {d.label}
                          </span>
                          {client.drift && client.drift.signals.length > 0 && (
                            <p className="mt-0.5 text-[10px] text-muted-foreground max-w-[180px] truncate">
                              {client.drift.signals.join(' · ')}
                            </p>
                          )}
                          {client.danFocus && (
                            <p className="mt-0.5 text-[10px] text-primary max-w-[220px] truncate" title={client.danFocus}>
                              Dan AI: {client.danFocus}
                            </p>
                          )}
                        </td>
                        <td className={`py-3 px-3 whitespace-nowrap ${days !== null && Number(days) > 14 ? 'text-orange-600' : 'text-muted-foreground'}`}>
                          {days !== null ? `${days}d ago` : '—'}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${s.bg} ${s.text}`}>
                            {s.label}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {visible.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-8">No clients match that.</p>
              )}
            </div>
          </div>
          )}
          </>
        );
      })()}

      {/* SLIDE-OVER PANEL */}
      {selectedClient && (
        <ClientDetailPanel
          key={selectedClient.id}
          client={clientsWithHealth.find(x => x.id === selectedClient.id) || selectedClient}
          onClose={() => setSelectedClient(null)}
          changeTier={changeTier}
        />
      )}
    </PageLayout>
  );
}

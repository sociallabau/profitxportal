import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  HeartPulse, X, ChevronRight, TrendingUp, Trophy, Eye, Clock, ArrowUpCircle, AlertTriangle
} from 'lucide-react';
import PageLayout from '@/components/PageLayout';
import { supabase } from '@/lib/supabase';
import { useRequireAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

const TIER_OPTIONS = [
  { value: 'onboarding', label: 'Onboarding' },
  { value: 'in_flow_starter', label: 'In Flow · Under $20k/mth' },
  { value: 'in_flow_scale', label: 'In Flow · Over $20k/mth' },
] as const;

// Maps any legacy tier value to the new tier system so older rows still display correctly.
function normalizeTier(tier?: string | null) {
  if (!tier) return 'onboarding';
  if (tier === 'onramp' || tier === 'on-ramp') return 'onboarding';
  if (tier === 'growth') return 'in_flow_starter';
  if (tier === 'scale' || tier === 'starter') return 'in_flow_scale';
  return tier;
}

function formatTierLabel(tier?: string | null) {
  return TIER_OPTIONS.find((option) => option.value === normalizeTier(tier))?.label ?? 'Onboarding';
}


// On-ramp module IDs — must match Roadmap.tsx
const ON_RAMP_MODULE_IDS = [
  'design-retainer-offer', 'client-onboarding',
  'optimise-profile', 'stupidly-simple-ad', 'warm-outreach',
  'discovery-call', 'follow-up-system',
];

// Margin thresholds (net profit margin %)
// >= TARGET_MARGIN  => On Track (green)
// >= MIN_MARGIN     => Good (amber)
// <  MIN_MARGIN     => Needs Help (red)
const TARGET_MARGIN = 30;
const MIN_MARGIN = 20;

// Low-score thresholds for survey alerts (out of 10)
const LOW_CONFIDENCE = 4;
const LOW_NPS = 6;

function getMarginBand(netMargin: number): 'green' | 'amber' | 'red' {
  if (netMargin >= TARGET_MARGIN) return 'green';
  if (netMargin >= MIN_MARGIN) return 'amber';
  return 'red';
}

function calcHealthScore(client: any) {
  // Margin-based scoring across 4 pillars: revenue, margin %, content posted, new clients
  const revenue   = Number(client.last_total_revenue || 0);
  const expenses  = Number(client.last_expenses || 0);
  const netMargin = revenue > 0 ? ((revenue - expenses) / revenue) * 100 : -1;
  const content   = Number(client.last_content_posts || 0);
  const newClients = Number(client.last_new_clients || 0);

  // Revenue (max 25)
  let revenueScore = 0;
  if (revenue >= 30000) revenueScore = 25;
  else if (revenue >= 15000) revenueScore = 18;
  else if (revenue >= 5000) revenueScore = 12;
  else if (revenue > 0) revenueScore = 6;

  // Margin (max 35) — primary driver
  let marginScore = 0;
  if (netMargin >= TARGET_MARGIN) marginScore = 35;
  else if (netMargin >= MIN_MARGIN) marginScore = 22;
  else if (netMargin >= 10) marginScore = 12;
  else if (netMargin >= 0) marginScore = 5;

  // Content posted (max 20)
  let contentScore = 0;
  if (content >= 12) contentScore = 20;
  else if (content >= 8) contentScore = 14;
  else if (content >= 4) contentScore = 8;
  else if (content >= 1) contentScore = 3;

  // New clients (max 20)
  let clientsScore = 0;
  if (newClients >= 3) clientsScore = 20;
  else if (newClients >= 2) clientsScore = 14;
  else if (newClients >= 1) clientsScore = 8;

  const score = revenueScore + marginScore + contentScore + clientsScore;

  // Overall band is driven by the margin band, refined by score for edge cases
  const marginBand = getMarginBand(netMargin);
  let band: 'green' | 'amber' | 'red' = marginBand;
  // If they have no revenue at all, force red
  if (revenue <= 0) band = 'red';

  return {
    score,
    band,
    netMargin: revenue > 0 ? netMargin : 0,
    revenueScore,
    marginScore,
    contentScore,
    clientsScore,
  };
}

function generateConclusion(client: any) {
  const name = client.full_name?.split(' ')[0] || 'This client';
  const parts: string[] = [];
  const revenue   = Number(client.last_total_revenue || 0);
  const expenses  = Number(client.last_expenses || 0);
  const netMargin = revenue > 0 ? ((revenue - expenses) / revenue) * 100 : 0;
  const newClients = Number(client.last_new_clients || 0);
  const content    = Number(client.last_content_posts || 0);
  const daysSub    = Number(client.days_since_submission ?? 999);

  if (revenue <= 0) parts.push(`no revenue submitted yet`);
  else if (netMargin >= TARGET_MARGIN) parts.push(`margin ${netMargin.toFixed(0)}% — above target`);
  else if (netMargin >= MIN_MARGIN) parts.push(`margin ${netMargin.toFixed(0)}% — within range`);
  else parts.push(`margin ${netMargin.toFixed(0)}% — below ${MIN_MARGIN}%, needs help`);

  if (newClients >= 2) parts.push(`signed ${newClients} new clients`);
  else if (newClients === 0 && content >= 8) parts.push(`posting content but not converting`);
  else if (newClients === 0) parts.push(`no new clients this month`);

  if (content === 0) parts.push(`no content posted`);
  else if (content >= 12) parts.push(`${content} posts — strong output`);

  if (daysSub > 45) parts.push(`monthly submission overdue (${daysSub} days)`);

  return `${name}: ${parts.join('; ')}.`;
}

const BAND = {
  green: { bg: 'bg-green-500/10', border: 'border-green-500/30', text: 'text-green-400', dot: 'bg-green-400', label: 'On Track' },
  amber: { bg: 'bg-yellow-500/10', border: 'border-yellow-500/30', text: 'text-yellow-400', dot: 'bg-yellow-400', label: 'Good' },
  red:   { bg: 'bg-red-500/10', border: 'border-red-500/30', text: 'text-red-400', dot: 'bg-red-400', label: 'Needs Help' },
};

export default function ClientHealth() {
  const { user } = useRequireAuth();
  const qc = useQueryClient();
  const [selectedClient, setSelectedClient] = useState<any | null>(null);

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
      setSelectedClient((prev: any) => prev ? { ...prev, tier: nextTier } : prev);
      toast.success(`Tier updated to ${formatTierLabel(nextTier)}`);
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Failed to update tier');
    },
  });

  const { data: clientHistory = [] } = useQuery({
    queryKey: ['client-monthly-history', selectedClient?.id],
    enabled: !!selectedClient,
    queryFn: async () => {
      const { data } = await supabase
        .from('monthly_totals')
        .select('month, mrr_manual, mrr, oneoff_revenue, total_revenue, expenses, business_confidence, nps, content_posts, leads_generated, new_clients')
        .eq('user_id', selectedClient!.id)
        .order('month', { ascending: false })
        .limit(6);
      return data ?? [];
    },
  });

  const { data: clientCompletions = [] } = useQuery({
    queryKey: ['client-completions', selectedClient?.id],
    enabled: !!selectedClient,
    queryFn: async () => {
      const { data } = await supabase
        .from('checklist_progress')
        .select('task_key, completed')
        .eq('user_id', selectedClient!.id)
        .eq('completed', true);
      return data ?? [];
    },
  });

  const { data: clientHotList = [] } = useQuery({
    queryKey: ['client-hot-list', selectedClient?.id],
    enabled: !!selectedClient,
    queryFn: async () => {
      const { data } = await supabase
        .from('hot_list')
        .select('column_id, deal_value')
        .eq('user_id', selectedClient!.id);
      return data ?? [];
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

  const clientsWithHealth = useMemo(() =>
    clients.map((c: any) => {
      const clientCompletedKeys = allCompletions
        .filter((cp: any) => cp.user_id === c.id)
        .map((cp: any) => cp.task_key);
      const allOnRampDone = ON_RAMP_MODULE_IDS.every(id => clientCompletedKeys.includes(id));

      const tier = normalizeTier(c.tier);
      const monthlyRevenue = Number(c.last_total_revenue || 0);

      // Ready to move from Onboarding → In Flow (under $20k) once all on-ramp modules are done.
      const readyForInFlow = tier === 'onboarding' && allOnRampDone;
      // Ready to step up from "under $20k" → "over $20k" once they cross $20k/mth.
      const readyForOver20k = tier === 'in_flow_starter' && monthlyRevenue >= 20000;

      return {
        ...c,
        health: calcHealthScore(c),
        conclusion: generateConclusion(c),
        readyForInFlow,
        readyForOver20k,
        monthlyRevenue,
      };
    }).sort((a: any, b: any) => b.health.score - a.health.score),
    [clients, allCompletions]
  );


  const greenCount = clientsWithHealth.filter((c: any) => c.health.band === 'green').length;
  const amberCount = clientsWithHealth.filter((c: any) => c.health.band === 'amber').length;
  const redCount   = clientsWithHealth.filter((c: any) => c.health.band === 'red').length;
  const readyForInFlow = clientsWithHealth.filter((c: any) => c.readyForInFlow);
  const readyForOver20k = clientsWithHealth.filter((c: any) => c.readyForOver20k);


  const lowSurveys = clientsWithHealth.filter((c: any) => {
    const conf = Number(c.last_confidence ?? 0);
    const nps = Number(c.last_nps ?? 0);
    const hasConf = c.last_confidence !== null && c.last_confidence !== undefined;
    const hasNps = c.last_nps !== null && c.last_nps !== undefined;
    return (hasConf && conf > 0 && conf <= LOW_CONFIDENCE) || (hasNps && nps > 0 && nps <= LOW_NPS);
  });

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
    pageViewAgg.forEach((v: any) => { counts[v.page] = (counts[v.page] || 0) + 1; });
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

      {/* Low survey-score alerts */}
      {lowSurveys.length > 0 && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 mb-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-5 h-5 text-red-400" />
            <h2 className="text-sm font-bold text-red-400">Low Survey Scores — Reach Out</h2>
          </div>
          <p className="text-xs text-muted-foreground mb-3">
            {lowSurveys.length === 1 ? 'This client' : `${lowSurveys.length} clients`} reported low business confidence (≤{LOW_CONFIDENCE}/10) or coaching satisfaction (≤{LOW_NPS}/10).
          </p>
          <div className="space-y-2">
            {lowSurveys.map((client: any) => {
              const conf = Number(client.last_confidence ?? 0);
              const nps = Number(client.last_nps ?? 0);
              const flags: string[] = [];
              if (conf > 0 && conf <= LOW_CONFIDENCE) flags.push(`Confidence ${conf}/10`);
              if (nps > 0 && nps <= LOW_NPS) flags.push(`Coaching ${nps}/10`);
              return (
                <button
                  key={client.id}
                  onClick={() => setSelectedClient(client)}
                  className="w-full flex items-center justify-between bg-card/50 rounded-lg p-3 border border-border hover:border-red-500/40 transition text-left"
                >
                  <span className="text-sm font-semibold text-foreground">{client.full_name || 'Unnamed Client'}</span>
                  <span className="text-xs text-red-400 font-medium">{flags.join(' · ')}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

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
            {readyForInFlow.map((client: any) => (
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
            {readyForOver20k.map((client: any) => (
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
          {clientsWithHealth.map((client: any) => {
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
                  <span>Score: <strong className={s.text}>{health.score}/100</strong></span>
                  {client.last_total_revenue > 0 && <span>Rev: ${Number(client.last_total_revenue).toLocaleString()}</span>}
                  {client.modules_completed > 0 && <span>{client.modules_completed} modules</span>}
                  {client.days_since_last_login !== null && (
                    <span className={Number(client.days_since_last_login) > 14 ? 'text-orange-400' : ''}>
                      Login: {client.days_since_last_login}d ago
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
      {selectedClient && (() => {
        const c = clientsWithHealth.find((x: any) => x.id === selectedClient.id) || selectedClient;
        const h = c.health || calcHealthScore(c);
        const s = BAND[h.band as keyof typeof BAND];
        const daysLogin = Number(c.days_since_last_login ?? null);
        const daysSub   = Number(c.days_since_submission ?? null);

        return (
          <>
            <div
              className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
              onClick={() => setSelectedClient(null)}
            />

            <div className="fixed top-0 right-0 z-50 h-full w-full max-w-xl bg-card border-l border-border shadow-2xl overflow-y-auto">
              <div className={`sticky top-0 z-10 ${s.bg} border-b ${s.border} px-6 py-4 flex items-center justify-between`}>
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${s.dot}`} />
                  <div>
                    <h2 className="font-bold text-foreground text-lg">{c.full_name}</h2>
                    <p className={`text-xs font-semibold ${s.text}`}>
                      Health Score: {h.score}/100 — {s.label}
                    </p>
                  </div>
                </div>
                <button onClick={() => setSelectedClient(null)} className="p-2 rounded-lg hover:bg-muted/50 transition">
                  <X className="w-5 h-5 text-muted-foreground" />
                </button>
              </div>

              <div className="p-6 space-y-5">
                {/* Tier change */}
                <div className="bg-muted/30 border border-border rounded-xl p-4">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Tier</p>
                  <div className="flex gap-2">
                    {TIER_OPTIONS.map((option) => {
                      const isActive = normalizeTier(selectedClient.tier ?? c.tier) === option.value;

                      return (
                        <button
                          key={option.value}
                          onClick={() => changeTier.mutate({ clientId: c.id, tier: option.value })}
                          disabled={changeTier.isPending}
                          className={`flex-1 py-2 px-3 rounded-lg text-sm font-semibold transition ${
                            isActive
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-muted text-muted-foreground hover:bg-muted/70'
                          }`}
                        >
                          {option.label}
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Changing tier unlocks different roadmap modules for this client.
                  </p>
                </div>

                {/* Financials snapshot — margin focus */}
                {(() => {
                  const revenue = Number(c.last_total_revenue || 0);
                  const expenses = Number(c.last_expenses || 0);
                  const netProfit = revenue - expenses;
                  const netMargin = revenue > 0 ? (netProfit / revenue) * 100 : 0;
                  const marginBand = getMarginBand(netMargin);
                  const ms = BAND[marginBand];
                  const marginLabel = marginBand === 'green' ? 'Above target' : marginBand === 'amber' ? 'In range' : 'Below target';

                  return (
                    <div className="bg-card border border-border rounded-xl p-4">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Financials Snapshot</p>

                      {/* Margin highlight */}
                      <div className={`${ms.bg} border ${ms.border} rounded-lg p-3 mb-3`}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-muted-foreground">Net Profit Margin</span>
                          <span className={`text-xs font-bold ${ms.text}`}>{marginLabel}</span>
                        </div>
                        <div className="flex items-baseline justify-between">
                          <span className={`text-2xl font-bold ${ms.text}`}>{netMargin.toFixed(1)}%</span>
                          <span className="text-xs text-muted-foreground">Target ≥ {TARGET_MARGIN}% · Min {MIN_MARGIN}%</span>
                        </div>
                      </div>

                      {/* Stat grid */}
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        {[
                          { label: 'Revenue',    value: `$${revenue.toLocaleString()}`,                                   color: 'text-foreground' },
                          { label: 'Expenses',   value: `$${expenses.toLocaleString()}`,                                  color: 'text-orange-400' },
                          { label: 'Net Profit', value: `$${netProfit.toLocaleString()}`,                                 color: netProfit >= 0 ? 'text-green-400' : 'text-red-400' },
                          { label: 'MRR',        value: `$${Number(c.last_mrr || 0).toLocaleString()}`,                   color: 'text-primary' },
                          { label: 'Ad Spend',   value: Number(c.last_ad_spend) > 0 ? `$${Number(c.last_ad_spend).toLocaleString()}` : '—', color: 'text-blue-400' },
                          { label: 'New Clients',value: `${c.last_new_clients ?? '—'}`,                                   color: 'text-green-400' },
                          { label: 'Content',    value: `${c.last_content_posts ?? '—'} posts`,                           color: 'text-foreground' },
                          { label: 'Leads',      value: `${c.last_leads ?? '—'}`,                                         color: 'text-foreground' },
                        ].map(({ label, value, color }) => (
                          <div key={label} className="flex justify-between">
                            <span className="text-muted-foreground">{label}</span>
                            <span className={`font-semibold ${color}`}>{value}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}

                {/* Hot List stats */}
                {(() => {
                  const total = clientHotList.length;
                  const closed = clientHotList.filter((h: any) => h.column_id === 'closed' || h.column_id === 'won').length;
                  const pipelineValue = clientHotList
                    .filter((h: any) => h.column_id !== 'closed' && h.column_id !== 'won' && h.column_id !== 'lost')
                    .reduce((sum: number, h: any) => sum + Number(h.deal_value || 0), 0);
                  const closedValue = clientHotList
                    .filter((h: any) => h.column_id === 'closed' || h.column_id === 'won')
                    .reduce((sum: number, h: any) => sum + Number(h.deal_value || 0), 0);

                  return (
                    <div className="bg-card border border-border rounded-xl p-4">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Hot List</p>
                      {total === 0 ? (
                        <p className="text-xs text-muted-foreground">No leads in their hot list yet.</p>
                      ) : (
                        <div className="grid grid-cols-2 gap-3 text-sm">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Total Leads</span>
                            <span className="font-semibold text-foreground">{total}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Closed</span>
                            <span className="font-semibold text-green-400">{closed}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Pipeline Value</span>
                            <span className="font-semibold text-primary">${pipelineValue.toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Closed Value</span>
                            <span className="font-semibold text-green-400">${closedValue.toLocaleString()}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* Login & submission recency */}
                <div className="grid grid-cols-2 gap-3">
                  <div className={`p-3 rounded-xl border ${!isNaN(daysLogin) && daysLogin > 14 ? 'bg-orange-500/10 border-orange-500/30' : 'bg-card border-border'}`}>
                    <div className="flex items-center gap-1.5 mb-1">
                      <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                      <p className="text-xs text-muted-foreground">Last login</p>
                    </div>
                    <p className={`text-sm font-semibold ${!isNaN(daysLogin) && daysLogin > 14 ? 'text-orange-400' : 'text-foreground'}`}>
                      {!isNaN(daysLogin) ? `${daysLogin} days ago` : 'No data'}
                    </p>
                  </div>
                  <div className={`p-3 rounded-xl border ${!isNaN(daysSub) && daysSub > 40 ? 'bg-orange-500/10 border-orange-500/30' : 'bg-card border-border'}`}>
                    <div className="flex items-center gap-1.5 mb-1">
                      <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                      <p className="text-xs text-muted-foreground">Last submission</p>
                    </div>
                    <p className={`text-sm font-semibold ${!isNaN(daysSub) && daysSub > 40 ? 'text-orange-400' : 'text-foreground'}`}>
                      {!isNaN(daysSub) ? `${daysSub} days ago` : 'Never'}
                    </p>
                  </div>
                </div>

                {/* Login & submission recency */}
                <div className="grid grid-cols-2 gap-3">
                  <div className={`p-3 rounded-xl border ${!isNaN(daysLogin) && daysLogin > 14 ? 'bg-orange-500/10 border-orange-500/30' : 'bg-card border-border'}`}>
                    <div className="flex items-center gap-1.5 mb-1">
                      <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                      <p className="text-xs text-muted-foreground">Last login</p>
                    </div>
                    <p className={`text-sm font-semibold ${!isNaN(daysLogin) && daysLogin > 14 ? 'text-orange-400' : 'text-foreground'}`}>
                      {!isNaN(daysLogin) ? `${daysLogin} days ago` : 'No data'}
                    </p>
                  </div>
                  <div className={`p-3 rounded-xl border ${!isNaN(daysSub) && daysSub > 40 ? 'bg-orange-500/10 border-orange-500/30' : 'bg-card border-border'}`}>
                    <div className="flex items-center gap-1.5 mb-1">
                      <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                      <p className="text-xs text-muted-foreground">Last submission</p>
                    </div>
                    <p className={`text-sm font-semibold ${!isNaN(daysSub) && daysSub > 40 ? 'text-orange-400' : 'text-foreground'}`}>
                      {!isNaN(daysSub) ? `${daysSub} days ago` : 'Never'}
                    </p>
                  </div>
                </div>


                {/* Wellbeing scores */}
                {(c.last_confidence || c.last_nps) && (
                  <div className="bg-card border border-border rounded-xl p-4">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Wellbeing</p>
                    <div className="space-y-2">
                      {c.last_confidence && (
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-foreground">Business confidence</span>
                          <div className="flex items-center gap-2">
                            <div className="w-24 bg-muted rounded-full h-1.5">
                              <div className="h-1.5 rounded-full bg-blue-400" style={{ width: `${(c.last_confidence/10)*100}%` }} />
                            </div>
                            <span className={`text-sm font-bold ${c.last_confidence >= 7 ? 'text-green-400' : c.last_confidence >= 5 ? 'text-yellow-400' : 'text-red-400'}`}>
                              {c.last_confidence}/10
                            </span>
                          </div>
                        </div>
                      )}
                      {c.last_nps && (
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-foreground">Coaching satisfaction</span>
                          <div className="flex items-center gap-2">
                            <div className="w-24 bg-muted rounded-full h-1.5">
                              <div className="h-1.5 rounded-full bg-purple-400" style={{ width: `${(c.last_nps/10)*100}%` }} />
                            </div>
                            <span className={`text-sm font-bold ${c.last_nps >= 7 ? 'text-green-400' : c.last_nps >= 5 ? 'text-yellow-400' : 'text-red-400'}`}>
                              {c.last_nps}/10
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Roadmap progress */}
                <div className="bg-card border border-border rounded-xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Roadmap Progress</p>
                    <span className="text-sm font-bold text-primary">{c.modules_completed || 0} modules</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2 mb-2">
                    <div
                      className="bg-primary rounded-full h-2 transition-all"
                      style={{ width: `${Math.min(100, ((c.modules_completed || 0) / 18) * 100)}%` }}
                    />
                  </div>
                  {clientCompletions.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {clientCompletions.map((comp: any) => (
                        <span key={comp.task_key} className="px-2 py-0.5 bg-green-500/10 text-green-400 text-xs rounded-full capitalize">
                          {comp.task_key.replace(/-/g, ' ')}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* What they need */}
                {c.last_needs && (
                  <div className="p-4 bg-primary/5 border border-primary/20 rounded-xl">
                    <p className="text-xs text-primary font-semibold mb-1">They need from you:</p>
                    <p className="text-sm text-foreground italic">"{c.last_needs}"</p>
                  </div>
                )}

                {/* Insight */}
                <div className="p-4 bg-muted/20 border border-border rounded-xl">
                  <p className="text-xs text-muted-foreground mb-1">Insight</p>
                  <p className="text-sm text-foreground italic">{c.conclusion}</p>
                </div>

                {/* Submission history */}
                {clientHistory.length > 0 && (
                  <div className="bg-card border border-border rounded-xl p-4">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Submission History</p>
                    <div className="space-y-2">
                      {clientHistory.map((row: any) => {
                        const r = Number(row.total_revenue) || (Number(row.mrr_manual || row.mrr || 0) + Number(row.oneoff_revenue || 0));
                        return (
                          <div key={row.month} className="flex items-center justify-between text-xs border-b border-border/50 pb-2 last:border-0 last:pb-0">
                            <span className="text-muted-foreground">
                              {new Date(row.month).toLocaleString('default', { month: 'short', year: 'numeric' })}
                            </span>
                            <span className="text-foreground">${r.toLocaleString()} rev</span>
                            <span className="text-foreground">{row.content_posts ?? '—'} posts</span>
                            <span className="text-green-400">{row.new_clients ?? '—'} clients</span>
                            <span className={`font-semibold ${(row.business_confidence || 0) >= 7 ? 'text-green-400' : 'text-yellow-400'}`}>
                              {row.business_confidence ? `${row.business_confidence}/10` : '—'}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </>
        );
      })()}
    </PageLayout>
  );
}

import { useQuery, type UseMutationResult } from '@tanstack/react-query';
import { X, ChevronRight, TrendingUp, Trophy, Eye, Clock, ArrowUpCircle, AlertTriangle, DollarSign } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import {
  type ClientWithHealth,
  TIER_OPTIONS,
  normalizeTier,
  formatTierLabel,
  LOW_CONFIDENCE,
  LOW_NPS,
  BAND,
  calcHealthScore,
  getMarginBand,
  TARGET_MARGIN,
  MIN_MARGIN,
} from '@/lib/clientHealth';

/**
 * The slide-over for a single client: their numbers, what they wrote in their
 * check-in, their tier, pipeline, module progress and submission history.
 *
 * It fetches its own per-client data rather than taking it as props, so the
 * list page does not hold queries it never renders.
 */
export default function ClientDetailPanel({
  client,
  onClose,
  changeTier,
}: {
  client: ClientWithHealth;
  onClose: () => void;
  /** Passed whole rather than as a callback: the panel shows its pending state. */
  changeTier: UseMutationResult<string, Error, { clientId: string; tier: string }>;
}) {
  const { data: clientHistory = [] } = useQuery({
  queryKey: ['client-monthly-history', client.id],
      queryFn: async () => {
    const { data } = await supabase
      .from('monthly_totals')
      .select('month, mrr_manual, mrr, oneoff_revenue, total_revenue, expenses, content_posts, leads_generated, new_clients, new_clients_total_value, new_clients_is_mrr')
      .eq('user_id', client.id)
      .order('month', { ascending: false })
      .limit(6);
    return data ?? [];
  },
  });


  const { data: clientCompletions = [] } = useQuery({
  queryKey: ['client-completions', client.id],
      queryFn: async () => {
    const { data } = await supabase
      .from('checklist_progress')
      .select('task_key, completed')
      .eq('user_id', client.id)
      .eq('completed', true);
    return data ?? [];
  },
  });

  const { data: clientHotList = [] } = useQuery({
  queryKey: ['client-hot-list', client.id],
      queryFn: async () => {
    const { data } = await supabase
      .from('hot_list')
      .select('column_id, deal_value')
      .eq('user_id', client.id);
    return data ?? [];
  },
  });

  const c = client;
  const h = c.health || calcHealthScore(c);
  const s = BAND[h.band as keyof typeof BAND];
  const daysLogin = Number(c.days_since_last_login ?? null);
  const daysSub = Number(c.days_since_submission ?? null);


  return (
          <>
            <div
              className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
              onClick={() => onClose()}
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
                <button onClick={() => onClose()} className="p-2 rounded-lg hover:bg-muted/50 transition">
                  <X className="w-5 h-5 text-muted-foreground" />
                </button>
              </div>

              <div className="p-6 space-y-5">
                {/* Tier change */}
                {(() => {
                  const currentTier = normalizeTier(client.tier ?? c.tier);
                  const isInFlow = currentTier === 'in_flow_starter' || currentTier === 'in_flow_scale';
                  const btn = (active: boolean) =>
                    `flex-1 py-2 px-3 rounded-lg text-sm font-semibold transition ${
                      active ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/70'
                    }`;
                  return (
                    <div className="bg-muted/30 border border-border rounded-xl p-4 space-y-3">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Stage</p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => changeTier.mutate({ clientId: c.id, tier: 'onboarding' })}
                          disabled={changeTier.isPending}
                          className={btn(currentTier === 'onboarding')}
                        >
                          Onboarding
                        </button>
                        <button
                          onClick={() => changeTier.mutate({ clientId: c.id, tier: 'in_flow_starter' })}
                          disabled={changeTier.isPending}
                          className={btn(isInFlow)}
                        >
                          In Flow
                        </button>
                      </div>

                      {isInFlow && (
                        <div>
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">In Flow level</p>
                          <div className="flex gap-2">
                            <button
                              onClick={() => changeTier.mutate({ clientId: c.id, tier: 'in_flow_starter' })}
                              disabled={changeTier.isPending}
                              className={btn(currentTier === 'in_flow_starter')}
                            >
                              Under $20k/mth
                            </button>
                            <button
                              onClick={() => changeTier.mutate({ clientId: c.id, tier: 'in_flow_scale' })}
                              disabled={changeTier.isPending}
                              className={btn(currentTier === 'in_flow_scale')}
                            >
                              Over $20k/mth
                            </button>
                          </div>
                        </div>
                      )}

                      <p className="text-xs text-muted-foreground">
                        Onboarding = On-Ramp legacy modules only. In Flow under $20k = first 9 roadmap modules. Over $20k = full roadmap.
                      </p>
                    </div>
                  );
                })()}



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
                  const closed = clientHotList.filter(h => h.column_id === 'closed' || h.column_id === 'won').length;
                  const pipelineValue = clientHotList
                    .filter(h => h.column_id !== 'closed' && h.column_id !== 'won' && h.column_id !== 'lost')
                    .reduce((sum, h) => sum + Number(h.deal_value || 0), 0);
                  const closedValue = clientHotList
                    .filter(h => h.column_id === 'closed' || h.column_id === 'won')
                    .reduce((sum, h) => sum + Number(h.deal_value || 0), 0);

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
                      {clientCompletions.map(comp => (
                        <span key={comp.task_key} className="px-2 py-0.5 bg-green-500/10 text-green-400 text-xs rounded-full capitalize">
                          {comp.task_key.replace(/-/g, ' ')}
                        </span>
                      ))}
                    </div>
                  )}
                </div>


                {/* Insight */}
                <div className="p-4 bg-muted/20 border border-border rounded-xl">
                  <p className="text-xs text-muted-foreground mb-1">Insight</p>
                  <p className="text-sm text-foreground italic">{c.conclusion}</p>
                </div>

                {/* What they told him on their last check-in — collected every
                    month and, until now, never shown anywhere. */}
                {(c.last_needs || c.last_biggest_win) && (
                  <div className="bg-card border border-primary/25 rounded-xl p-4">
                    <p className="text-xs font-semibold text-primary uppercase tracking-wider mb-3">
                      In their words{c.last_submission_month ? ` · ${new Date(c.last_submission_month).toLocaleString('default', { month: 'long', year: 'numeric' })}` : ''}
                    </p>
                    {c.last_biggest_win && (
                      <div className="mb-3">
                        <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">Biggest win</p>
                        <p className="text-sm text-foreground leading-relaxed">{c.last_biggest_win}</p>
                      </div>
                    )}
                    {c.last_needs && (
                      <div>
                        <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">What they're working on next</p>
                        <p className="text-sm text-foreground leading-relaxed">{c.last_needs}</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Submission history */}
                {clientHistory.length > 0 && (
                  <div className="bg-card border border-border rounded-xl p-4">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Submission History</p>
                    <div className="space-y-2">
                      {clientHistory.map(row => {
                        const r = Number(row.total_revenue) || (Number(row.mrr_manual || row.mrr || 0) + Number(row.oneoff_revenue || 0));
                        return (
                          <div key={row.month} className="flex items-center justify-between text-xs border-b border-border/50 pb-2 last:border-0 last:pb-0">
                            <span className="text-muted-foreground">
                              {new Date(row.month).toLocaleString('default', { month: 'short', year: 'numeric' })}
                            </span>
                            <span className="text-foreground">${r.toLocaleString()} rev</span>
                            <span className="text-foreground">{row.content_posts ?? '—'} posts</span>
                            <span className="text-green-400">{row.new_clients ?? '—'} clients</span>
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
}

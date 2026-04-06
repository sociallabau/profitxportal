import { useQuery } from '@tanstack/react-query';
import { LineChart, Line, ResponsiveContainer, Tooltip } from 'recharts';
import { TrendingUp, CheckCircle2, AlertTriangle, ArrowRight } from 'lucide-react';
import PageLayout from '@/components/PageLayout';
import { supabase } from '@/lib/supabase';
import { useRequireAuth } from '@/hooks/useAuth';
import { usePageTracking } from '@/hooks/usePageTracking';

const MARGIN_TARGETS: Record<string, { grossMin: number; grossMax: number; netMin: number; netMax: number; label: string }> = {
  'on-ramp': { grossMin: 65, grossMax: 80, netMin: 35, netMax: 50, label: 'On-Ramp' },
  'growth':  { grossMin: 60, grossMax: 75, netMin: 30, netMax: 45, label: 'Growth' },
  'scale':   { grossMin: 50, grossMax: 60, netMin: 20, netMax: 30, label: 'Scale' },
};

function Sparkline({ data, dataKey, color }: { data: any[]; dataKey: string; color: string }) {
  if (!data || data.length < 2) return null;
  return (
    <ResponsiveContainer width="100%" height={40}>
      <LineChart data={data} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
        <Line type="monotone" dataKey={dataKey} stroke={color} strokeWidth={1.5} dot={false} />
        <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '6px', fontSize: '11px' }} formatter={(v: any) => [`$${Number(v).toLocaleString()}`, '']} labelFormatter={() => ''} />
      </LineChart>
    </ResponsiveContainer>
  );
}

function MarginBar({ label, value, min, max }: { label: string; value: number; min: number; max: number }) {
  const clampedValue = Math.max(0, Math.min(value, 100));
  const inRange = value >= min && value <= max;
  const low = value < min;
  const barColor = inRange ? '#4ade80' : low ? '#f97316' : '#60a5fa';

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-foreground">{label}</span>
        <span className={`text-sm font-bold ${inRange ? 'text-green-400' : low ? 'text-orange-400' : 'text-blue-400'}`}>{value.toFixed(1)}%</span>
      </div>
      <div className="relative w-full bg-muted rounded-full h-3 overflow-hidden">
        <div className="absolute top-0 h-3 bg-primary/25 rounded" style={{ left: `${min}%`, width: `${max - min}%` }} title={`Target: ${min}–${max}%`} />
        <div className="absolute top-0 left-0 h-3 rounded-full transition-all" style={{ width: `${clampedValue}%`, backgroundColor: barColor, opacity: 0.85 }} />
      </div>
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>0%</span><span className="text-primary/70">Target {min}–{max}%</span><span>100%</span>
      </div>
    </div>
  );
}

function FlagCard({ type, message }: { type: 'warning' | 'good' | 'tip'; message: string }) {
  const cfg = {
    warning: { cls: 'bg-orange-500/10 border-orange-500/30', icon: <AlertTriangle className="w-4 h-4 text-orange-400 shrink-0" /> },
    good:    { cls: 'bg-green-500/10 border-green-500/30',   icon: <CheckCircle2  className="w-4 h-4 text-green-400 shrink-0"  /> },
    tip:     { cls: 'bg-primary/10 border-primary/30',       icon: <TrendingUp    className="w-4 h-4 text-primary shrink-0"    /> },
  }[type];
  return (
    <div className={`flex items-start gap-3 p-3 rounded-lg border ${cfg.cls}`}>{cfg.icon}<p className="text-sm text-foreground">{message}</p></div>
  );
}

export default function Financials() {
  const { user } = useRequireAuth();
  usePageTracking('financials');

  const { data: profile } = useQuery({
    queryKey: ['profile-tier', user?.id], enabled: !!user,
    queryFn: async () => { const { data } = await supabase.from('profiles').select('tier').eq('id', user!.id).single(); return data; },
  });

  const { data: history = [] } = useQuery({
    queryKey: ['financials-history', user?.id], enabled: !!user,
    queryFn: async () => { const { data } = await supabase.from('monthly_totals').select('*').eq('user_id', user!.id).order('month', { ascending: true }).limit(6); return data ?? []; },
  });

  const tier = profile?.tier || 'on-ramp';
  const targets = MARGIN_TARGETS[tier] || MARGIN_TARGETS['on-ramp'];
  const latest = history[history.length - 1];

  if (!latest) {
    return <PageLayout><h1 className="text-2xl font-bold mb-2">Financials</h1><p className="text-sm text-muted-foreground">Submit your monthly data to see your financial breakdown.</p></PageLayout>;
  }

  const mrr = Number(latest.mrr_manual || latest.mrr) || 0;
  const oneoffs = Number(latest.oneoff_revenue) || 0;
  const revenue = Number(latest.total_revenue) || (mrr + oneoffs);
  const expenses = Number(latest.expenses) || 0;
  const adSpend = Number(latest.ad_spend) || 0;
  const grossProfit = revenue - adSpend;
  const netProfit = revenue - expenses;
  const grossMargin = revenue > 0 ? (grossProfit / revenue) * 100 : 0;
  const netMargin = revenue > 0 ? (netProfit / revenue) * 100 : 0;

  const trendData = history.map((m: any) => {
    const r = Number(m.total_revenue) || (Number(m.mrr_manual || m.mrr || 0) + Number(m.oneoff_revenue || 0));
    return { month: new Date(m.month).toLocaleString('default', { month: 'short' }), revenue: r, mrr: Number(m.mrr_manual || m.mrr) || 0, grossProfit: r - (Number(m.ad_spend) || 0), netProfit: r - (Number(m.expenses) || 0) };
  });

  const content = Number(latest.content_posts) || 0;
  const leads = Number(latest.leads_generated) || 0;
  const meetings = Number(latest.meetings) || 0;
  const newClients = Number(latest.new_clients) || 0;
  const newClientVal = Number((latest as any).new_clients_total_value) || 0;
  const isNewMRR = (latest as any).new_clients_is_mrr;

  const revenuePerPost = content > 0 && newClientVal > 0 ? newClientVal / content : null;
  const revenuePerLead = leads > 0 && newClientVal > 0 ? newClientVal / leads : null;
  const revenuePerMeeting = meetings > 0 && newClientVal > 0 ? newClientVal / meetings : null;
  const revenuePerClient = newClients > 0 && newClientVal > 0 ? newClientVal / newClients : null;
  const netAfterAds = newClientVal > 0 ? newClientVal - adSpend : revenue - adSpend;

  const flags: { type: 'warning' | 'good' | 'tip'; message: string }[] = [];
  if (grossMargin > targets.grossMax) flags.push({ type: 'good', message: `Gross margin at ${grossMargin.toFixed(0)}% — excellent, above target.` });
  else if (grossMargin < targets.grossMin) flags.push({ type: 'warning', message: `Gross margin at ${grossMargin.toFixed(0)}% — below ${targets.grossMin}% target. Review direct costs.` });
  if (netMargin < targets.netMin) flags.push({ type: 'warning', message: `Net margin at ${netMargin.toFixed(0)}% — below ${targets.netMin}% target. Review recurring expenses.` });
  if (mrr / revenue < 0.4 && revenue > 0) flags.push({ type: 'tip', message: `${Math.round((mrr/revenue)*100)}% of revenue is MRR. Increasing retainer clients = more predictable income.` });
  if (newClients >= 2) flags.push({ type: 'good', message: `Signed ${newClients} new clients this month — great acquisition momentum!` });
  if (content >= 8 && newClients === 0) flags.push({ type: 'warning', message: `Consistent content but no new clients — the bottleneck is likely DM follow-up or discovery call conversion.` });

  const StatBox = ({ label, value, color, sparkKey, sparkColor }: any) => (
    <div className="bg-card border border-border rounded-xl p-4">
      <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">{label}</p>
      <p className={`text-xl font-bold ${color}`}>{value}</p>
      <div className="mt-2"><Sparkline data={trendData} dataKey={sparkKey} color={sparkColor} /></div>
    </div>
  );

  return (
    <PageLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Financials</h1>
        <p className="text-sm text-muted-foreground">{new Date(latest.month).toLocaleString('default', { month: 'long', year: 'numeric' })} · <span className="text-primary capitalize">{targets.label} tier targets</span></p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-5">
        <StatBox label="Total Revenue" value={`$${revenue.toLocaleString()}`} color="text-foreground" sparkKey="revenue" sparkColor="hsl(var(--primary))" />
        <StatBox label="MRR" value={`$${mrr.toLocaleString()}`} color="text-primary" sparkKey="mrr" sparkColor="hsl(var(--primary))" />
        <StatBox label="Gross Profit" value={`$${grossProfit.toLocaleString()}`} color={grossProfit >= 0 ? 'text-green-400' : 'text-destructive'} sparkKey="grossProfit" sparkColor="#4ade80" />
        <StatBox label="Net Profit" value={`$${netProfit.toLocaleString()}`} color={netProfit >= 0 ? 'text-green-400' : 'text-destructive'} sparkKey="netProfit" sparkColor="#4ade80" />
      </div>

      <div className="bg-card border border-border rounded-xl p-5 mb-5">
        <h2 className="text-sm font-semibold text-foreground mb-1">Margin Benchmarks — <span className="text-primary capitalize">{targets.label}</span></h2>
        <p className="text-xs text-muted-foreground mb-4">The shaded band shows your target range. Green = on track, orange = below target.</p>
        <div className="space-y-5">
          <MarginBar label="Gross Margin" value={grossMargin} min={targets.grossMin} max={targets.grossMax} />
          <MarginBar label="Net Margin" value={netMargin} min={targets.netMin} max={targets.netMax} />
        </div>
      </div>

      {flags.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-5 mb-5">
          <h2 className="text-sm font-semibold text-foreground mb-3">Areas to Watch</h2>
          <div className="space-y-2.5">{flags.map((f, i) => <FlagCard key={i} type={f.type} message={f.message} />)}</div>
        </div>
      )}

      <div className="bg-card border border-border rounded-xl p-5 mb-5">
        <h2 className="text-sm font-semibold text-foreground mb-1">Growth Funnel</h2>
        <p className="text-xs text-muted-foreground mb-4">
          How your content and activity converts to revenue — every step has a $ value.
          {newClientVal === 0 && ' Add "New clients total value" in your monthly submission to unlock the full breakdown.'}
        </p>
        <div className="flex flex-wrap items-center gap-2 mb-5">
          {[
            { label: 'Content Posts', value: content || '—', subValue: revenuePerPost ? `$${Math.round(revenuePerPost).toLocaleString()}/post` : null, color: 'bg-purple-500/20 text-purple-300 border-purple-500/30' },
            { label: 'Ad Spend', value: adSpend > 0 ? `$${adSpend.toLocaleString()}` : '—', subValue: null, color: 'bg-blue-500/20 text-blue-300 border-blue-500/30' },
            { label: 'Leads', value: leads || '—', subValue: revenuePerLead ? `$${Math.round(revenuePerLead).toLocaleString()}/lead` : null, color: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30' },
            { label: 'Meetings', value: meetings || '—', subValue: revenuePerMeeting ? `$${Math.round(revenuePerMeeting).toLocaleString()}/meeting` : null, color: 'bg-orange-500/20 text-orange-300 border-orange-500/30' },
            { label: 'New Clients', value: newClients || '—', subValue: revenuePerClient ? `$${Math.round(revenuePerClient).toLocaleString()}/client` : null, color: 'bg-green-500/20 text-green-300 border-green-500/30' },
          ].map(({ label, value, subValue, color }, i, arr) => (
            <div key={label} className="flex items-center gap-2">
              <div className={`flex flex-col items-center px-3 py-2 rounded-xl border text-center min-w-[80px] ${color}`}>
                <span className="text-lg font-bold leading-tight">{value}</span>
                <span className="text-xs font-medium opacity-80">{label}</span>
                {subValue && <span className="text-xs font-bold mt-1 opacity-100 text-white/90">{subValue}</span>}
              </div>
              {i < arr.length - 1 && <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0" />}
            </div>
          ))}
        </div>

        {revenuePerPost && (
          <div className="p-4 bg-primary/5 border border-primary/20 rounded-xl mb-3">
            <p className="text-sm font-semibold text-foreground mb-1">💡 Each piece of content was worth ~${Math.round(revenuePerPost).toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">Based on ${newClientVal.toLocaleString()} in new business from {content} pieces of content.</p>
          </div>
        )}

        {isNewMRR && newClientVal > 0 && (
          <div className="p-3 bg-green-500/10 border border-green-500/30 rounded-lg mb-3">
            <p className="text-sm text-green-400 font-semibold">🔄 These are retainer clients — their actual LTV is ${newClientVal.toLocaleString()}+/month recurring.</p>
          </div>
        )}

        {adSpend > 0 && (
          <div className="flex items-center justify-between p-3 bg-muted/30 border border-border rounded-lg">
            <div><p className="text-sm text-foreground">Minus ad spend</p><p className="text-xs text-muted-foreground">Shown separately</p></div>
            <div className="text-right">
              <p className="text-sm font-bold text-orange-400">−${adSpend.toLocaleString()}</p>
              <p className="text-sm font-bold text-green-400">Net: ${Math.max(0, netAfterAds).toLocaleString()}</p>
            </div>
          </div>
        )}
      </div>

      {history.length > 1 && (
        <div className="bg-card border border-border rounded-xl p-5">
          <h2 className="text-sm font-semibold text-foreground mb-3">6-Month History</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  {['Month','Revenue','MRR','Expenses','Ad Spend','Gross%','Net%','Content','Leads','Clients','New Value'].map(h => (
                    <th key={h} className="pb-2 text-xs font-semibold text-muted-foreground pr-4 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[...history].reverse().map((row: any) => {
                  const r = Number(row.total_revenue) || (Number(row.mrr_manual || row.mrr || 0) + Number(row.oneoff_revenue || 0));
                  const exp = Number(row.expenses) || 0;
                  const ads = Number(row.ad_spend) || 0;
                  const gm = r > 0 ? ((r - ads) / r * 100).toFixed(0) : '—';
                  const nm = r > 0 ? ((r - exp) / r * 100).toFixed(0) : '—';
                  return (
                    <tr key={row.id} className="border-b border-border/50">
                      <td className="py-2 pr-4 whitespace-nowrap">{new Date(row.month).toLocaleString('default', { month: 'short', year: '2-digit' })}</td>
                      <td className="py-2 pr-4">${r.toLocaleString()}</td>
                      <td className="py-2 pr-4 text-primary">${(Number(row.mrr_manual || row.mrr) || 0).toLocaleString()}</td>
                      <td className="py-2 pr-4 text-orange-400">${exp.toLocaleString()}</td>
                      <td className="py-2 pr-4 text-blue-400">{ads > 0 ? `$${ads.toLocaleString()}` : '—'}</td>
                      <td className={`py-2 pr-4 font-semibold ${Number(gm) >= targets.grossMin ? 'text-green-400' : 'text-orange-400'}`}>{gm !== '—' ? `${gm}%` : '—'}</td>
                      <td className={`py-2 pr-4 font-semibold ${Number(nm) >= targets.netMin ? 'text-green-400' : 'text-orange-400'}`}>{nm !== '—' ? `${nm}%` : '—'}</td>
                      <td className="py-2 pr-4">{row.content_posts ?? '—'}</td>
                      <td className="py-2 pr-4">{row.leads_generated ?? '—'}</td>
                      <td className="py-2 pr-4">{row.new_clients ?? '—'}</td>
                      <td className="py-2">{Number(row.new_clients_total_value) > 0 ? `$${Number(row.new_clients_total_value).toLocaleString()}` : '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </PageLayout>
  );
}

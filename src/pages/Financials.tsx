import { useQuery } from '@tanstack/react-query';
import { LineChart, Line, ResponsiveContainer, Tooltip } from 'recharts';
import { TrendingUp, CheckCircle2, AlertTriangle, ArrowRight, Eye } from 'lucide-react';
import PageLayout from '@/components/PageLayout';
import FinancialAudit from '@/components/FinancialAudit';
import GrowthEngine from '@/components/GrowthEngine';
import { supabase } from '@/lib/supabase';
import { useRequireAuth } from '@/hooks/useAuth';
import { usePageTracking } from '@/hooks/usePageTracking';

const MARGIN_TARGETS: Record<string, { grossMin: number; grossMax: number; netMin: number; netMax: number; label: string }> = {
  'on-ramp': { grossMin: 65, grossMax: 80, netMin: 35, netMax: 50, label: 'On-Ramp' },
  'onramp':  { grossMin: 65, grossMax: 80, netMin: 35, netMax: 50, label: 'On-Ramp' },
  'onboarding': { grossMin: 65, grossMax: 80, netMin: 35, netMax: 50, label: 'On-Ramp' },
  'growth':  { grossMin: 60, grossMax: 75, netMin: 30, netMax: 45, label: 'Growth' },
  'scale':   { grossMin: 50, grossMax: 60, netMin: 20, netMax: 30, label: 'Scale' },
};

const EXAMPLE_HISTORY = [
  { month: 'Dec', revenue: 8200, mrr: 5400, grossProfit: 7400, netProfit: 5100, expenses: 3100, adSpend: 800 },
  { month: 'Jan', revenue: 11400, mrr: 7200, grossProfit: 10100, netProfit: 7800, expenses: 3600, adSpend: 1300 },
  { month: 'Feb', revenue: 13800, mrr: 8800, grossProfit: 12300, netProfit: 9600, expenses: 4200, adSpend: 1500 },
  { month: 'Mar', revenue: 17500, mrr: 11200, grossProfit: 15700, netProfit: 12700, expenses: 4800, adSpend: 1800 },
  { month: 'Apr', revenue: 21300, mrr: 13500, grossProfit: 19200, netProfit: 15900, expenses: 5400, adSpend: 2100 },
  { month: 'May', revenue: 26900, mrr: 17400, grossProfit: 24500, netProfit: 20800, expenses: 6100, adSpend: 2400 },
];

const EXAMPLE_LATEST = {
  monthLabel: 'May 2026', revenue: 26900, mrr: 17400, expenses: 6100, adSpend: 2400,
  content: 12, leads: 38, meetings: 14, newClients: 4, newClientVal: 14800,
};

function ExampleBadge() {
  return (
    <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full bg-blue-500/15 border border-blue-500/40 text-blue-400">
      <Eye className="w-3 h-3" /> Example
    </span>
  );
}

function Sparkline({ data, dataKey, color }: { data: any[]; dataKey: string; color: string }) {
  if (data.length < 2) return <div className="h-[40px]" />;
  return (
    <ResponsiveContainer width="100%" height={40}>
      <LineChart data={data} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
        <Line type="monotone" dataKey={dataKey} stroke={color} strokeWidth={1.5} dot={false} />
        <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '6px', fontSize: '11px' }} formatter={(v: any) => [`$${Number(v).toLocaleString()}`, '']} labelFormatter={() => ''} />
      </LineChart>
    </ResponsiveContainer>
  );
}

function MarginBar({ label, value, min, max, isExample }: { label: string; value: number; min: number; max: number; isExample: boolean }) {
  const clampedValue = Math.max(0, Math.min(value, 100));
  const inRange = value >= min && value <= max;
  const low = value < min;
  const barColor = isExample ? '#60a5fa' : (inRange ? '#4ade80' : low ? '#f97316' : '#60a5fa');
  const valColor = isExample ? 'text-blue-400' : (inRange ? 'text-green-400' : low ? 'text-orange-400' : 'text-blue-400');
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-foreground">{label}</span>
        <span className={`text-sm font-bold ${valColor}`}>{value.toFixed(1)}%</span>
      </div>
      <div className="relative w-full bg-muted rounded-full h-3 overflow-hidden">
        <div className="absolute top-0 h-3 bg-primary/25 rounded" style={{ left: `${min}%`, width: `${max - min}%` }} />
        <div className="absolute top-0 left-0 h-3 rounded-full" style={{ width: `${clampedValue}%`, backgroundColor: barColor, opacity: 0.85 }} />
      </div>
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>0%</span><span className="text-primary/70">Target {min}–{max}%</span><span>100%</span>
      </div>
    </div>
  );
}

export default function Financials() {
  const { user } = useRequireAuth();
  usePageTracking('financials');

  const { data: profile } = useQuery({
    queryKey: ['financials-profile', user?.id], enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('tier, is_admin').eq('id', user!.id).single();
      return data;
    },
  });

  const { data: history = [] } = useQuery({
    queryKey: ['financials-history', user?.id], enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from('monthly_totals').select('*').eq('user_id', user!.id).order('month', { ascending: true }).limit(12);
      return data ?? [];
    },
  });

  const isExample = !!profile?.is_admin;
  const tier = profile?.tier || 'on-ramp';
  const targets = MARGIN_TARGETS[tier] || MARGIN_TARGETS['on-ramp'];

  // Build real data
  const realHistory = history.map((m: any) => {
    const mrrVal = Number(m.mrr_manual || m.mrr || 0);
    const oneoffs = Number(m.oneoff_revenue || 0);
    const rev = Number(m.total_revenue || 0) || (mrrVal + oneoffs);
    const exp = Number(m.expenses || 0);
    const ads = Number(m.ad_spend || 0);
    return {
      month: new Date(m.month).toLocaleString('default', { month: 'short' }),
      revenue: rev, mrr: mrrVal, expenses: exp, adSpend: ads,
      grossProfit: rev - ads, netProfit: rev - exp,
    };
  });
  const realLatest = history[history.length - 1] as any;

  const historyData = isExample ? EXAMPLE_HISTORY : realHistory;

  let revenue = 0, mrr = 0, expenses = 0, adSpend = 0, content = 0, leads = 0, meetings = 0, newClients = 0, newClientVal = 0, monthLabel = '';
  if (isExample) {
    ({ revenue, mrr, expenses, adSpend, content, leads, meetings, newClients, newClientVal, monthLabel } = EXAMPLE_LATEST);
  } else if (realLatest) {
    mrr = Number(realLatest.mrr_manual || realLatest.mrr || 0);
    const oneoffs = Number(realLatest.oneoff_revenue || 0);
    revenue = Number(realLatest.total_revenue || 0) || (mrr + oneoffs);
    expenses = Number(realLatest.expenses || 0);
    adSpend = Number(realLatest.ad_spend || 0);
    content = Number(realLatest.content_posts || 0);
    leads = Number(realLatest.leads_generated || 0);
    meetings = Number(realLatest.meetings || 0);
    newClients = Number(realLatest.new_clients || 0);
    newClientVal = Number(realLatest.new_clients_total_value || 0);
    monthLabel = new Date(realLatest.month).toLocaleString('default', { month: 'long', year: 'numeric' });
  }

  const grossProfit = revenue - adSpend;
  const netProfit = revenue - expenses;
  const grossMargin = revenue > 0 ? (grossProfit / revenue) * 100 : 0;
  const netMargin = revenue > 0 ? (netProfit / revenue) * 100 : 0;
  const revenuePerPost = content > 0 ? newClientVal / content : 0;

  const hasData = isExample || !!realLatest;

  // Empty state for real users with no check-ins
  if (!hasData) {
    return (
      <PageLayout>
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Financials</h1>
          <p className="text-sm text-muted-foreground"><span className="text-primary capitalize">{targets.label} tier targets</span></p>
        </div>
        <div className="bg-card border border-border border-dashed rounded-xl p-10 text-center">
          <p className="text-base font-semibold text-foreground mb-2">No financial data yet</p>
          <p className="text-sm text-muted-foreground">Submit your monthly check-in to see your real numbers, margins, and growth funnel here.</p>
        </div>
        <FinancialAudit />
      </PageLayout>
    );
  }

  const accent = isExample ? 'text-blue-400' : 'text-primary';
  const accentBorder = isExample ? 'border-blue-500/30' : 'border-border';
  const sparkColor = isExample ? '#60a5fa' : 'hsl(var(--primary))';

  const StatBox = ({ label, value, sparkKey }: any) => (
    <div className={`bg-card border ${accentBorder} rounded-xl p-4`}>
      <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">{label}{isExample ? ' *example*' : ''}</p>
      <p className={`text-xl font-bold ${accent}`}>{value}</p>
      <div className="mt-2"><Sparkline data={historyData} dataKey={sparkKey} color={sparkColor} /></div>
    </div>
  );

  const flags: { type: 'warning' | 'good' | 'tip'; message: string }[] = [];
  if (isExample) {
    flags.push({ type: 'good', message: `Gross margin at ${grossMargin.toFixed(0)}% — excellent, above target.` });
    flags.push({ type: 'tip', message: `${Math.round((mrr / revenue) * 100)}% of revenue is MRR — strong recurring base.` });
  } else if (revenue > 0) {
    if (grossMargin > targets.grossMax) flags.push({ type: 'good', message: `Gross margin at ${grossMargin.toFixed(0)}% — excellent, above target.` });
    else if (grossMargin < targets.grossMin) flags.push({ type: 'warning', message: `Gross margin at ${grossMargin.toFixed(0)}% — below ${targets.grossMin}% target.` });
    if (netMargin < targets.netMin) flags.push({ type: 'warning', message: `Net margin at ${netMargin.toFixed(0)}% — below ${targets.netMin}% target.` });
    if (mrr > 0) flags.push({ type: 'tip', message: `${Math.round((mrr / revenue) * 100)}% of revenue is MRR.` });
  }

  return (
    <PageLayout>
      {isExample && (
        <div className="bg-blue-500/10 border border-blue-500/40 rounded-xl p-4 mb-6 flex items-center gap-3 flex-wrap">
          <Eye className="w-5 h-5 text-blue-400 shrink-0" />
          <div className="flex-1 min-w-[200px]">
            <p className="text-sm font-bold text-blue-400">Example data shown (admin view)</p>
            <p className="text-xs text-muted-foreground mt-0.5">Clients see their real check-in numbers on this page.</p>
          </div>
        </div>
      )}

      <div className="mb-6">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold">Financials</h1>
          {isExample && <ExampleBadge />}
        </div>
        <p className="text-sm text-muted-foreground">{monthLabel} · <span className="text-primary capitalize">{targets.label} tier targets</span></p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-5">
        <StatBox label="Total Revenue" value={`$${revenue.toLocaleString()}`} sparkKey="revenue" />
        <StatBox label="MRR" value={`$${mrr.toLocaleString()}`} sparkKey="mrr" />
        <StatBox label="Gross Profit" value={`$${grossProfit.toLocaleString()}`} sparkKey="grossProfit" />
        <StatBox label="Net Profit" value={`$${netProfit.toLocaleString()}`} sparkKey="netProfit" />
      </div>

      <div className={`bg-card border ${accentBorder} rounded-xl p-5 mb-5`}>
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-sm font-semibold text-foreground">Margin Benchmarks — <span className="text-primary capitalize">{targets.label}</span></h2>
          {isExample && <ExampleBadge />}
        </div>
        <p className="text-xs text-muted-foreground mb-4">The shaded band shows the target range for this tier.</p>
        <div className="space-y-5">
          <MarginBar label="Gross Margin" value={grossMargin} min={targets.grossMin} max={targets.grossMax} isExample={isExample} />
          <MarginBar label="Net Margin" value={netMargin} min={targets.netMin} max={targets.netMax} isExample={isExample} />
        </div>
      </div>

      {flags.length > 0 && (
        <div className={`bg-card border ${accentBorder} rounded-xl p-5 mb-5`}>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-foreground">Areas to Watch</h2>
            {isExample && <ExampleBadge />}
          </div>
          <div className="space-y-2.5">
            {flags.map((f, i) => {
              const cfg = {
                warning: { cls: 'bg-orange-500/10 border-orange-500/30', icon: <AlertTriangle className="w-4 h-4 text-orange-400 shrink-0" /> },
                good:    { cls: 'bg-green-500/10 border-green-500/30',   icon: <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0" /> },
                tip:     { cls: 'bg-primary/10 border-primary/30',       icon: <TrendingUp className="w-4 h-4 text-primary shrink-0" /> },
              }[f.type];
              return (
                <div key={i} className={`flex items-start gap-3 p-3 rounded-lg border ${cfg.cls}`}>
                  {cfg.icon}
                  <p className="text-sm text-foreground">{f.message}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className={`bg-card border ${accentBorder} rounded-xl p-5 mb-5`}>
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-sm font-semibold text-foreground">Growth Funnel</h2>
          {isExample && <ExampleBadge />}
        </div>
        <p className="text-xs text-muted-foreground mb-4">How content and activity converts to revenue.</p>
        <div className="flex flex-wrap items-center gap-2 mb-5">
          {[
            { label: 'Content Posts', value: content || '—', subValue: revenuePerPost > 0 ? `$${Math.round(revenuePerPost).toLocaleString()}/post` : null },
            { label: 'Ad Spend', value: adSpend > 0 ? `$${adSpend.toLocaleString()}` : '—', subValue: null },
            { label: 'Leads', value: leads || '—', subValue: null },
            { label: 'Meetings', value: meetings || '—', subValue: null },
            { label: 'New Clients', value: newClients || '—', subValue: newClients > 0 ? `$${Math.round(newClientVal / newClients).toLocaleString()}/client` : null },
          ].map(({ label, value, subValue }, i, arr) => (
            <div key={label} className="flex items-center gap-2">
              <div className={`flex flex-col items-center px-3 py-2 rounded-xl border text-center min-w-[80px] ${isExample ? 'bg-blue-500/15 text-blue-300 border-blue-500/30' : 'bg-primary/15 text-primary border-primary/30'}`}>
                <span className="text-lg font-bold leading-tight">{value}</span>
                <span className="text-xs font-medium opacity-80">{label}</span>
                {subValue && <span className="text-xs font-bold mt-1 opacity-100">{subValue}</span>}
              </div>
              {i < arr.length - 1 && <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0" />}
            </div>
          ))}
        </div>
        {revenuePerPost > 0 && (
          <div className={`p-4 rounded-xl border ${isExample ? 'bg-blue-500/10 border-blue-500/30' : 'bg-primary/10 border-primary/30'}`}>
            <p className={`text-sm font-semibold mb-1 ${accent}`}>💡 Each piece of content was worth ~${Math.round(revenuePerPost).toLocaleString()}{isExample ? ' *example*' : ''}</p>
            <p className="text-xs text-muted-foreground">Based on ${newClientVal.toLocaleString()} in new business from {content} pieces of content.</p>
          </div>
        )}
      </div>

      {historyData.length > 0 && (
        <div className={`bg-card border ${accentBorder} rounded-xl p-5`}>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-foreground">{isExample ? '6-Month History' : `${historyData.length}-Month History`}</h2>
            {isExample && <ExampleBadge />}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  {['Month', 'Revenue', 'MRR', 'Gross Profit', 'Net Profit'].map((h) => (
                    <th key={h} className="pb-2 text-xs font-semibold text-muted-foreground pr-4 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[...historyData].reverse().map((row: any, idx: number) => (
                  <tr key={`${row.month}-${idx}`} className="border-b border-border/50">
                    <td className="py-2 pr-4 whitespace-nowrap">{row.month}</td>
                    <td className={`py-2 pr-4 ${accent}`}>${Number(row.revenue || 0).toLocaleString()}</td>
                    <td className={`py-2 pr-4 ${accent}`}>${Number(row.mrr || 0).toLocaleString()}</td>
                    <td className={`py-2 pr-4 ${accent}`}>${Number(row.grossProfit || 0).toLocaleString()}</td>
                    <td className={`py-2 ${accent}`}>${Number(row.netProfit || 0).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      <GrowthEngine />
      <FinancialAudit />
    </PageLayout>
  );
}

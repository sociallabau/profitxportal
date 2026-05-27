import { LineChart, Line, ResponsiveContainer, Tooltip } from 'recharts';
import { TrendingUp, CheckCircle2, ArrowRight, Eye } from 'lucide-react';
import PageLayout from '@/components/PageLayout';
import { useRequireAuth } from '@/hooks/useAuth';
import { usePageTracking } from '@/hooks/usePageTracking';

// EXAMPLE / DEMO DATA — real numbers live on /admin/my-finances
const TARGETS = { grossMin: 65, grossMax: 80, netMin: 35, netMax: 50, label: 'On-Ramp' };

const EXAMPLE_HISTORY = [
  { month: 'Dec', revenue: 8200, mrr: 5400, grossProfit: 7400, netProfit: 5100 },
  { month: 'Jan', revenue: 11400, mrr: 7200, grossProfit: 10100, netProfit: 7800 },
  { month: 'Feb', revenue: 13800, mrr: 8800, grossProfit: 12300, netProfit: 9600 },
  { month: 'Mar', revenue: 17500, mrr: 11200, grossProfit: 15700, netProfit: 12700 },
  { month: 'Apr', revenue: 21300, mrr: 13500, grossProfit: 19200, netProfit: 15900 },
  { month: 'May', revenue: 26900, mrr: 17400, grossProfit: 24500, netProfit: 20800 },
];

const LATEST = {
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

function Sparkline({ dataKey }: { dataKey: string }) {
  return (
    <ResponsiveContainer width="100%" height={40}>
      <LineChart data={EXAMPLE_HISTORY} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
        <Line type="monotone" dataKey={dataKey} stroke="#60a5fa" strokeWidth={1.5} dot={false} />
        <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '6px', fontSize: '11px' }} formatter={(v: any) => [`$${Number(v).toLocaleString()}`, '']} labelFormatter={() => ''} />
      </LineChart>
    </ResponsiveContainer>
  );
}

function MarginBar({ label, value, min, max }: { label: string; value: number; min: number; max: number }) {
  const clampedValue = Math.max(0, Math.min(value, 100));
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-foreground">{label}</span>
        <span className="text-sm font-bold text-blue-400">{value.toFixed(1)}%</span>
      </div>
      <div className="relative w-full bg-muted rounded-full h-3 overflow-hidden">
        <div className="absolute top-0 h-3 bg-primary/25 rounded" style={{ left: `${min}%`, width: `${max - min}%` }} />
        <div className="absolute top-0 left-0 h-3 rounded-full" style={{ width: `${clampedValue}%`, backgroundColor: '#60a5fa', opacity: 0.85 }} />
      </div>
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>0%</span><span className="text-primary/70">Target {min}–{max}%</span><span>100%</span>
      </div>
    </div>
  );
}

export default function Financials() {
  useRequireAuth();
  usePageTracking('financials');

  const { revenue, mrr, expenses, adSpend, content, leads, meetings, newClients, newClientVal } = LATEST;
  const grossProfit = revenue - adSpend;
  const netProfit = revenue - expenses;
  const grossMargin = (grossProfit / revenue) * 100;
  const netMargin = (netProfit / revenue) * 100;
  const revenuePerPost = newClientVal / content;

  const StatBox = ({ label, value, sparkKey }: any) => (
    <div className="bg-card border border-blue-500/30 rounded-xl p-4">
      <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">{label}</p>
      <p className="text-xl font-bold text-blue-400">{value}</p>
      <div className="mt-2"><Sparkline dataKey={sparkKey} /></div>
    </div>
  );

  return (
    <PageLayout>
      <div className="bg-blue-500/10 border border-blue-500/40 rounded-xl p-4 mb-6 flex items-center gap-3 flex-wrap">
        <Eye className="w-5 h-5 text-blue-400 shrink-0" />
        <div className="flex-1 min-w-[200px]">
          <p className="text-sm font-bold text-blue-400">Example data shown for demo purposes</p>
          <p className="text-xs text-muted-foreground mt-0.5">All financial numbers on this page are illustrative.</p>
        </div>
      </div>

      <div className="mb-6">
        <div className="flex items-center gap-2"><h1 className="text-2xl font-bold">Financials</h1><ExampleBadge /></div>
        <p className="text-sm text-muted-foreground">{LATEST.monthLabel} · <span className="text-primary capitalize">{TARGETS.label} tier targets</span></p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-5">
        <StatBox label="Total Revenue *example*" value={`$${revenue.toLocaleString()}`} sparkKey="revenue" />
        <StatBox label="MRR *example*" value={`$${mrr.toLocaleString()}`} sparkKey="mrr" />
        <StatBox label="Gross Profit *example*" value={`$${grossProfit.toLocaleString()}`} sparkKey="grossProfit" />
        <StatBox label="Net Profit *example*" value={`$${netProfit.toLocaleString()}`} sparkKey="netProfit" />
      </div>

      <div className="bg-card border border-blue-500/30 rounded-xl p-5 mb-5">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-sm font-semibold text-foreground">Margin Benchmarks — <span className="text-primary capitalize">{TARGETS.label}</span></h2>
          <ExampleBadge />
        </div>
        <p className="text-xs text-muted-foreground mb-4">The shaded band shows the target range for this tier.</p>
        <div className="space-y-5">
          <MarginBar label="Gross Margin" value={grossMargin} min={TARGETS.grossMin} max={TARGETS.grossMax} />
          <MarginBar label="Net Margin" value={netMargin} min={TARGETS.netMin} max={TARGETS.netMax} />
        </div>
      </div>

      <div className="bg-card border border-blue-500/30 rounded-xl p-5 mb-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-foreground">Areas to Watch</h2>
          <ExampleBadge />
        </div>
        <div className="space-y-2.5">
          <div className="flex items-start gap-3 p-3 rounded-lg border bg-blue-500/10 border-blue-500/30">
            <CheckCircle2 className="w-4 h-4 text-blue-400 shrink-0" />
            <p className="text-sm text-foreground">Gross margin at {grossMargin.toFixed(0)}% — excellent, above target.</p>
          </div>
          <div className="flex items-start gap-3 p-3 rounded-lg border bg-blue-500/10 border-blue-500/30">
            <TrendingUp className="w-4 h-4 text-blue-400 shrink-0" />
            <p className="text-sm text-foreground">{Math.round((mrr / revenue) * 100)}% of revenue is MRR — strong recurring base.</p>
          </div>
        </div>
      </div>

      <div className="bg-card border border-blue-500/30 rounded-xl p-5 mb-5">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-sm font-semibold text-foreground">Growth Funnel</h2>
          <ExampleBadge />
        </div>
        <p className="text-xs text-muted-foreground mb-4">How content and activity converts to revenue.</p>
        <div className="flex flex-wrap items-center gap-2 mb-5">
          {[
            { label: 'Content Posts', value: content, subValue: `$${Math.round(revenuePerPost).toLocaleString()}/post` },
            { label: 'Ad Spend', value: `$${adSpend.toLocaleString()}`, subValue: null },
            { label: 'Leads', value: leads, subValue: null },
            { label: 'Meetings', value: meetings, subValue: null },
            { label: 'New Clients', value: newClients, subValue: `$${Math.round(newClientVal / newClients).toLocaleString()}/client` },
          ].map(({ label, value, subValue }, i, arr) => (
            <div key={label} className="flex items-center gap-2">
              <div className="flex flex-col items-center px-3 py-2 rounded-xl border text-center min-w-[80px] bg-blue-500/15 text-blue-300 border-blue-500/30">
                <span className="text-lg font-bold leading-tight">{value}</span>
                <span className="text-xs font-medium opacity-80">{label}</span>
                {subValue && <span className="text-xs font-bold mt-1 opacity-100">{subValue}</span>}
              </div>
              {i < arr.length - 1 && <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0" />}
            </div>
          ))}
        </div>
        <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-xl">
          <p className="text-sm font-semibold text-blue-400 mb-1">💡 Each piece of content was worth ~${Math.round(revenuePerPost).toLocaleString()} *example*</p>
          <p className="text-xs text-muted-foreground">Based on ${newClientVal.toLocaleString()} in new business from {content} pieces of content.</p>
        </div>
      </div>

      <div className="bg-card border border-blue-500/30 rounded-xl p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-foreground">6-Month History</h2>
          <ExampleBadge />
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
              {[...EXAMPLE_HISTORY].reverse().map((row) => (
                <tr key={row.month} className="border-b border-border/50">
                  <td className="py-2 pr-4 whitespace-nowrap">{row.month}</td>
                  <td className="py-2 pr-4 text-blue-400">${row.revenue.toLocaleString()}</td>
                  <td className="py-2 pr-4 text-blue-400">${row.mrr.toLocaleString()}</td>
                  <td className="py-2 pr-4 text-blue-400">${row.grossProfit.toLocaleString()}</td>
                  <td className="py-2 text-blue-400">${row.netProfit.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </PageLayout>
  );
}

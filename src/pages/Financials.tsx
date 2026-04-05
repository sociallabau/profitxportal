import { useQuery } from '@tanstack/react-query';
import { TrendingUp, AlertTriangle, CheckCircle2, ArrowRight } from 'lucide-react';
import PageLayout from '@/components/PageLayout';
import { supabase } from '@/lib/supabase';
import { useRequireAuth } from '@/hooks/useAuth';
import { usePageTracking } from '@/hooks/usePageTracking';

const MARGIN_TARGETS: Record<string, { grossMin: number; grossMax: number; netMin: number; netMax: number; label: string }> = {
  'on-ramp': { grossMin: 65, grossMax: 80, netMin: 35, netMax: 50, label: 'On-Ramp' },
  'growth':  { grossMin: 60, grossMax: 75, netMin: 30, netMax: 45, label: 'Growth' },
  'scale':   { grossMin: 50, grossMax: 60, netMin: 20, netMax: 30, label: 'Scale' },
};

function MarginBar({ label, value, min, max, note }: { label: string; value: number; min: number; max: number; note?: string }) {
  const inRange = value >= min && value <= max;
  const low = value < min;
  const pct = Math.min(Math.max(value, 0), 100);
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-foreground">{label}</span>
        <div className="flex items-center gap-2">
          <span className={`text-sm font-bold ${inRange ? 'text-green-400' : low ? 'text-red-400' : 'text-orange-400'}`}>{value.toFixed(1)}%</span>
          {inRange ? <CheckCircle2 className="w-4 h-4 text-green-400" /> : <AlertTriangle className="w-4 h-4 text-orange-400" />}
        </div>
      </div>
      <div className="relative w-full bg-muted rounded-full h-2.5">
        <div className="absolute top-0 h-2.5 bg-primary/20 rounded-full" style={{ left: `${min}%`, width: `${max - min}%` }} />
        <div className={`absolute top-0 h-2.5 rounded-full ${inRange ? 'bg-green-400' : low ? 'bg-red-400' : 'bg-orange-400'}`} style={{ width: `${pct}%` }} />
      </div>
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>Target: {min}–{max}%</span>
        {note && <span className="text-orange-300">{note}</span>}
      </div>
    </div>
  );
}

function FlagCard({ type, message }: { type: 'warning' | 'good' | 'tip'; message: string }) {
  const styles = {
    warning: { bg: 'bg-red-500/10 border-red-500/30', icon: <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" /> },
    good:    { bg: 'bg-green-500/10 border-green-500/30', icon: <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0" /> },
    tip:     { bg: 'bg-primary/10 border-primary/30', icon: <TrendingUp className="w-4 h-4 text-primary shrink-0" /> },
  };
  const s = styles[type];
  return (
    <div className={`flex items-start gap-3 p-3 rounded-lg border ${s.bg}`}>
      {s.icon}
      <p className="text-sm text-foreground">{message}</p>
    </div>
  );
}

export default function Financials() {
  const { user } = useRequireAuth();
  usePageTracking('financials');

  const { data: profile } = useQuery({
    queryKey: ['profile-tier', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('tier').eq('id', user!.id).single();
      return data;
    },
  });

  const { data: history = [] } = useQuery({
    queryKey: ['financials-history', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from('monthly_totals').select('*').eq('user_id', user!.id).order('month', { ascending: false }).limit(6);
      return (data ?? []) as any[];
    },
  });

  const tier = profile?.tier || 'on-ramp';
  const targets = MARGIN_TARGETS[tier] || MARGIN_TARGETS['on-ramp'];
  const latest = history[0];

  if (!latest) {
    return (
      <PageLayout>
        <h1 className="text-2xl font-bold mb-2">Financials</h1>
        <p className="text-sm text-muted-foreground">Submit your monthly data to see your financial breakdown.</p>
      </PageLayout>
    );
  }

  const mrr = Number(latest.mrr_manual || latest.mrr) || 0;
  const oneoffs = Number(latest.oneoff_revenue) || 0;
  const revenue = Number(latest.total_revenue) || (mrr + oneoffs);
  const expenses = Number(latest.expenses) || 0;
  const adSpend = Number(latest.ad_spend) || 0;
  const cogs = adSpend;
  const grossProfit = revenue - cogs;
  const netProfit = revenue - expenses;
  const grossMargin = revenue > 0 ? (grossProfit / revenue) * 100 : 0;
  const netMargin = revenue > 0 ? (netProfit / revenue) * 100 : 0;
  const mrrPct = revenue > 0 ? (mrr / revenue) * 100 : 0;

  const funnelMonths = [...history].reverse().slice(-3);

  const flags: { type: 'warning' | 'good' | 'tip'; message: string }[] = [];
  if (grossMargin < targets.grossMin)
    flags.push({ type: 'warning', message: `Gross margin is ${grossMargin.toFixed(0)}% — below your ${targets.label} target of ${targets.grossMin}–${targets.grossMax}%. Look at reducing direct costs or increasing prices.` });
  else if (grossMargin > targets.grossMax)
    flags.push({ type: 'good', message: `Gross margin at ${grossMargin.toFixed(0)}% — excellent, above target range. Keep stacking revenue.` });
  if (netMargin < targets.netMin)
    flags.push({ type: 'warning', message: `Net margin at ${netMargin.toFixed(0)}% — below ${targets.netMin}% target. Review all recurring expenses and cut what isn't directly driving revenue.` });
  if (mrrPct < 40 && revenue > 0)
    flags.push({ type: 'tip', message: `Only ${mrrPct.toFixed(0)}% of revenue is MRR. Increasing retainer clients gives you predictable cash flow and reduces pressure each month.` });
  else if (mrrPct >= 60)
    flags.push({ type: 'good', message: `${mrrPct.toFixed(0)}% of revenue is MRR — strong recurring base. Stability is high.` });
  if (adSpend === 0 && Number(latest.leads_generated) < 5)
    flags.push({ type: 'tip', message: `No ad spend logged and low leads. Even a small ad budget ($10–$50/day) tested alongside consistent content can significantly increase lead volume.` });
  if (Number(latest.content_posts) >= 10 && Number(latest.new_clients) === 0)
    flags.push({ type: 'warning', message: `Good content volume but no new clients this month. The bottleneck might be in your DM follow-up, discovery call conversion, or offer clarity — worth reviewing.` });
  if (Number(latest.new_clients) >= 2)
    flags.push({ type: 'good', message: `Signed ${latest.new_clients} new client${latest.new_clients > 1 ? 's' : ''} this month — great acquisition momentum!` });

  const funnelConclusions: string[] = [];
  if (funnelMonths.length >= 2) {
    const m1 = funnelMonths[funnelMonths.length - 2];
    const m2 = funnelMonths[funnelMonths.length - 1];
    const contentUp = Number(m2.content_posts) > Number(m1.content_posts);
    const adSpendUp = Number(m2.ad_spend) > Number(m1.ad_spend);
    const leadsUp = Number(m2.leads_generated) > Number(m1.leads_generated);
    const meetingsUp = Number(m2.meetings) > Number(m1.meetings);
    const clientsUp = Number(m2.new_clients) > Number(m1.new_clients);

    if ((contentUp || adSpendUp) && leadsUp)
      funnelConclusions.push(`More content/ad spend last month directly correlated with more leads — the funnel is working. Keep the volume up.`);
    if (leadsUp && !meetingsUp)
      funnelConclusions.push(`Leads increased but meetings didn't follow. Your DM-to-call conversion needs attention — try a more direct CTA or follow-up sequence.`);
    if (meetingsUp && !clientsUp)
      funnelConclusions.push(`More meetings but the same close rate — worth reviewing your discovery call framework and offer presentation.`);
    if (contentUp && clientsUp)
      funnelConclusions.push(`Content volume up + new clients up — strong signal. More posting = more business. Lean into what's working.`);
    if (adSpendUp && clientsUp)
      funnelConclusions.push(`Ad spend increase tracked with client growth — your ads are converting. Confident to scale ad budget further.`);
  }

  return (
    <PageLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Financials</h1>
        <p className="text-sm text-muted-foreground">
          {new Date(latest.month).toLocaleString('default', { month: 'long', year: 'numeric' })} breakdown ·{' '}
          <span className="text-primary capitalize">{targets.label} tier targets</span>
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total Revenue', value: `$${revenue.toLocaleString()}`, color: 'text-foreground' },
          { label: 'MRR', value: `$${mrr.toLocaleString()}`, color: 'text-primary' },
          { label: 'Gross Profit', value: `$${grossProfit.toLocaleString()}`, color: grossProfit >= 0 ? 'text-green-400' : 'text-destructive' },
          { label: 'Net Profit', value: `$${netProfit.toLocaleString()}`, color: netProfit >= 0 ? 'text-green-400' : 'text-destructive' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-card border border-border rounded-xl p-4">
            <p className="text-xs text-muted-foreground mb-1 uppercase tracking-wider">{label}</p>
            <p className={`text-xl font-bold ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      <div className="bg-card border border-border rounded-xl p-5 mb-5">
        <h2 className="text-sm font-semibold text-foreground mb-4">
          Margin Benchmarks — <span className="text-primary capitalize">{targets.label}</span>
        </h2>
        <div className="space-y-5">
          <MarginBar label="Gross Margin" value={grossMargin} min={targets.grossMin} max={targets.grossMax}
            note={grossMargin < targets.grossMin ? 'Below target — review direct costs' : undefined} />
          <MarginBar label="Net Margin" value={netMargin} min={targets.netMin} max={targets.netMax}
            note={netMargin < targets.netMin ? 'Below target — review all expenses' : undefined} />
        </div>
        <p className="text-xs text-muted-foreground mt-3">
          Shaded band = target range for your tier. Scale tier: 50–60% gross / 20–30% net. On-ramp / Growth: 65–80% gross / 35–50% net.
        </p>
      </div>

      {flags.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-5 mb-5">
          <h2 className="text-sm font-semibold text-foreground mb-3">Areas to Watch</h2>
          <div className="space-y-2.5">
            {flags.map((f, i) => <FlagCard key={i} type={f.type} message={f.message} />)}
          </div>
        </div>
      )}

      {funnelMonths.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-5 mb-5">
          <h2 className="text-sm font-semibold text-foreground mb-1">Growth Funnel</h2>
          <p className="text-xs text-muted-foreground mb-4">Content + Ad Spend → Leads → Meetings → New Clients</p>
          <div className="flex items-center gap-2 flex-wrap mb-4">
            {[
              { label: 'Content Posts', value: latest.content_posts ?? '—', color: 'bg-purple-500/20 text-purple-300 border-purple-500/30' },
              { label: 'Ad Spend', value: adSpend > 0 ? `$${adSpend.toLocaleString()}` : '—', color: 'bg-blue-500/20 text-blue-300 border-blue-500/30' },
              { label: 'Leads', value: latest.leads_generated ?? '—', color: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30' },
              { label: 'Meetings', value: latest.meetings ?? '—', color: 'bg-orange-500/20 text-orange-300 border-orange-500/30' },
              { label: 'New Clients', value: latest.new_clients ?? '—', color: 'bg-green-500/20 text-green-300 border-green-500/30' },
            ].map(({ label, value, color }, i, arr) => (
              <div key={label} className="flex items-center gap-2">
                <div className={`flex flex-col items-center px-3 py-2 rounded-lg border text-center ${color}`}>
                  <span className="text-lg font-bold">{value}</span>
                  <span className="text-xs font-medium">{label}</span>
                </div>
                {i < arr.length - 1 && <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0" />}
              </div>
            ))}
          </div>
          {funnelConclusions.length > 0 && (
            <div className="space-y-2 mt-3">
              {funnelConclusions.map((c, i) => (
                <div key={i} className="flex items-start gap-2 p-3 bg-primary/5 border border-primary/20 rounded-lg">
                  <TrendingUp className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                  <p className="text-sm text-foreground">{c}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {history.length > 1 && (
        <div className="bg-card border border-border rounded-xl p-5">
          <h2 className="text-sm font-semibold text-foreground mb-3">6-Month History</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  {['Month','Revenue','MRR','Expenses','Ad Spend','Gross%','Net%','Content','Leads','Clients'].map(h => (
                    <th key={h} className="pb-2 text-xs font-semibold text-muted-foreground pr-4 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {history.map((row: any) => {
                  const r = Number(row.total_revenue) || (Number(row.mrr_manual || row.mrr) + Number(row.oneoff_revenue)) || 0;
                  const exp = Number(row.expenses) || 0;
                  const ads = Number(row.ad_spend) || 0;
                  const gm = r > 0 ? ((r - ads) / r * 100).toFixed(0) : '—';
                  const nm = r > 0 ? ((r - exp) / r * 100).toFixed(0) : '—';
                  return (
                    <tr key={row.id} className="border-b border-border/50">
                      <td className="py-2 text-foreground pr-4 whitespace-nowrap">{new Date(row.month).toLocaleString('default', { month: 'short', year: '2-digit' })}</td>
                      <td className="py-2 text-foreground pr-4">${r.toLocaleString()}</td>
                      <td className="py-2 text-primary pr-4">${(Number(row.mrr_manual || row.mrr) || 0).toLocaleString()}</td>
                      <td className="py-2 text-orange-400 pr-4">${exp.toLocaleString()}</td>
                      <td className="py-2 text-blue-400 pr-4">{ads > 0 ? `$${ads.toLocaleString()}` : '—'}</td>
                      <td className={`py-2 pr-4 font-semibold ${Number(gm) >= targets.grossMin ? 'text-green-400' : 'text-red-400'}`}>{gm !== '—' ? `${gm}%` : '—'}</td>
                      <td className={`py-2 pr-4 font-semibold ${Number(nm) >= targets.netMin ? 'text-green-400' : 'text-red-400'}`}>{nm !== '—' ? `${nm}%` : '—'}</td>
                      <td className="py-2 text-foreground pr-4">{row.content_posts ?? '—'}</td>
                      <td className="py-2 text-foreground pr-4">{row.leads_generated ?? '—'}</td>
                      <td className="py-2 text-foreground">{row.new_clients ?? '—'}</td>
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

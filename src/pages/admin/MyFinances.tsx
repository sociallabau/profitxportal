import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  LineChart, Line, ResponsiveContainer, Tooltip, XAxis,
} from 'recharts';
import { TrendingUp, Receipt, DollarSign, CheckCircle2, AlertTriangle, ArrowRight, Lock, Users, UserMinus, Repeat, Crosshair } from 'lucide-react';
import PageLayout from '@/components/PageLayout';
import { supabase } from '@/lib/supabase';
import { useRequireAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import {
  monthlyChurnTrend,
  activeChurnedCounts,
  memberLtv,
  cac,
  ltvCacBand,
  renewalRate,
  type MemberRow,
} from '@/lib/retention';

const MARGIN_TARGETS: Record<string, { grossMin: number; grossMax: number; netMin: number; netMax: number; label: string }> = {
  'on-ramp': { grossMin: 65, grossMax: 80, netMin: 35, netMax: 50, label: 'On-Ramp' },
  'onramp':  { grossMin: 65, grossMax: 80, netMin: 35, netMax: 50, label: 'On-Ramp' },
  'growth':  { grossMin: 60, grossMax: 75, netMin: 30, netMax: 45, label: 'Growth' },
  'scale':   { grossMin: 50, grossMax: 60, netMin: 20, netMax: 30, label: 'Scale' },
};

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
        <div className="absolute top-0 h-3 bg-primary/25 rounded" style={{ left: `${min}%`, width: `${max - min}%` }} />
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
  return <div className={`flex items-start gap-3 p-3 rounded-lg border ${cfg.cls}`}>{cfg.icon}<p className="text-sm text-foreground">{message}</p></div>;
}

export default function MyFinances() {
  const { user } = useRequireAuth();
  const [tab, setTab] = useState<'dashboard' | 'financials'>('dashboard');

  const { data: profile } = useQuery({
    queryKey: ['admin-profile-tier', user?.id], enabled: !!user,
    queryFn: async () => { const { data } = await supabase.from('profiles').select('tier').eq('id', user!.id).single(); return data; },
  });

  const { data: history = [] } = useQuery({
    queryKey: ['admin-my-finances-history', user?.id], enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from('monthly_totals').select('*').eq('user_id', user!.id).order('month', { ascending: true }).limit(12);
      return data ?? [];
    },
  });

  // ── Retention & unit economics (ProfitX itself, admin only) ──
  const queryClient = useQueryClient();
  const { data: members = [] } = useQuery({
    queryKey: ['retention-members'],
    enabled: !!user,
    queryFn: async (): Promise<MemberRow[]> => {
      const { data } = await supabase.from('profiles').select('id, created_at, archived_at');
      return data ?? [];
    },
  });

  const { data: settings = {} } = useQuery({
    queryKey: ['admin-settings'],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from('admin_settings').select('key, value');
      const map: Record<string, string> = {};
      for (const row of data ?? []) map[row.key] = row.value;
      return map;
    },
  });

  const saveSetting = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: string }) => {
      const { error } = await supabase
        .from('admin_settings')
        .upsert({ key, value, updated_at: new Date().toISOString() });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-settings'] }),
    onError: (err: Error) => toast.error(err.message),
  });

  const arpu = Number(settings.avg_member_price || 0);
  const acquisitionSpend = Number(settings.acquisition_spend || 0);

  const trend = monthlyChurnTrend(members, 6);
  const counts = activeChurnedCounts(members);
  const latestPoint = trend[trend.length - 1];
  // LTV uses the average churn over months that actually had churn, so one
  // quiet month doesn't make lifetime look infinite.
  const churnRates = trend.map(p => p.churnRate).filter((r): r is number => r !== null);
  const avgChurnRate = churnRates.length ? churnRates.reduce((a, b) => a + b, 0) / churnRates.length : null;
  const ltv = memberLtv(arpu, avgChurnRate);
  const cacValue = cac(acquisitionSpend, latestPoint?.newMembers ?? 0);
  const ltvCac = ltv !== null && cacValue !== null ? ltv / cacValue : null;
  const ltvCacBandResult = ltvCacBand(ltvCac);
  const monthStart = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1));
  const renewal = renewalRate(members, monthStart, new Date());

  const churnChartData = trend.map(p => ({
    month: p.label,
    churn: p.churnRate !== null ? Math.round(p.churnRate * 1000) / 10 : null,
  }));

  const tier = profile?.tier || 'on-ramp';
  const targets = MARGIN_TARGETS[tier] || MARGIN_TARGETS['on-ramp'];
  const latest = history[history.length - 1];
  const prev = history[history.length - 2];

  const latestRevenue = latest ? (Number(latest.total_revenue || 0) || (Number(latest.mrr_manual || latest.mrr || 0) + Number(latest.oneoff_revenue || 0))) : 0;
  const latestExpenses = Number(latest?.expenses || 0);
  const latestProfit = latestRevenue - latestExpenses;
  const prevRevenue = prev ? (Number(prev.total_revenue || 0) || (Number(prev.mrr_manual || prev.mrr || 0) + Number(prev.oneoff_revenue || 0))) : 0;
  const revenueGrowth = prevRevenue > 0 ? Math.round(((latestRevenue - prevRevenue) / prevRevenue) * 100) : null;

  const graphData = history.slice(-6).map(m => {
    const rev = Number(m.total_revenue || 0) || (Number(m.mrr_manual || m.mrr || 0) + Number(m.oneoff_revenue || 0));
    return { month: new Date(m.month).toLocaleString('default', { month: 'short' }), revenue: rev, expenses: Number(m.expenses || 0) };
  });

  // Financials calcs
  const mrr = Number(latest?.mrr_manual || latest?.mrr) || 0;
  const oneoffs = Number(latest?.oneoff_revenue) || 0;
  const revenue = Number(latest?.total_revenue) || (mrr + oneoffs);
  const expenses = Number(latest?.expenses) || 0;
  const adSpend = Number(latest?.ad_spend) || 0;
  const grossProfit = revenue - adSpend;
  const netProfit = revenue - expenses;
  const grossMargin = revenue > 0 ? (grossProfit / revenue) * 100 : 0;
  const netMargin = revenue > 0 ? (netProfit / revenue) * 100 : 0;

  const content = Number(latest?.content_posts) || 0;
  const leads = Number(latest?.leads_generated) || 0;
  const meetings = Number(latest?.meetings) || 0;
  const newClients = Number(latest?.new_clients) || 0;
  const newClientVal = Number(latest?.new_clients_total_value) || 0;

  const flags: { type: 'warning' | 'good' | 'tip'; message: string }[] = [];
  if (revenue > 0) {
    if (grossMargin > targets.grossMax) flags.push({ type: 'good', message: `Gross margin at ${grossMargin.toFixed(0)}% — excellent, above target.` });
    else if (grossMargin < targets.grossMin) flags.push({ type: 'warning', message: `Gross margin at ${grossMargin.toFixed(0)}% — below ${targets.grossMin}% target.` });
    if (netMargin < targets.netMin) flags.push({ type: 'warning', message: `Net margin at ${netMargin.toFixed(0)}% — below ${targets.netMin}% target.` });
  }

  return (
    <PageLayout>
      <div className="mb-6 flex items-center justify-between gap-3 flex-wrap">
        <div>
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-primary" />
            <h1 className="text-2xl font-bold">My Finances</h1>
            <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 border border-primary/30 text-primary font-semibold uppercase tracking-wider">Admin only</span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">Your real numbers — hidden from the public Dashboard & Financials pages during demos.</p>
        </div>
        <div className="inline-flex bg-card border border-border rounded-lg p-1">
          {(['dashboard', 'financials'] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)} className={`px-4 py-1.5 text-sm font-semibold rounded-md transition ${tab === t ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
              {t === 'dashboard' ? 'Dashboard' : 'Financials'}
            </button>
          ))}
        </div>
      </div>

      {!latest && (
        <div className="bg-card border border-border border-dashed rounded-xl p-8 text-center">
          <p className="text-sm text-muted-foreground">No monthly totals submitted yet. Submit your first month to see your real numbers here.</p>
        </div>
      )}

      {latest && tab === 'dashboard' && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
            {[
              { icon: TrendingUp, label: 'Revenue', value: `$${latestRevenue.toLocaleString()}`, sub: revenueGrowth !== null ? `${revenueGrowth >= 0 ? '+' : ''}${revenueGrowth}% vs last month` : null, color: 'text-primary' },
              { icon: Receipt, label: 'Expenses', value: `$${latestExpenses.toLocaleString()}`, color: 'text-orange-400' },
              { icon: DollarSign, label: 'Profit', value: `$${latestProfit.toLocaleString()}`, color: latestProfit >= 0 ? 'text-green-400' : 'text-destructive' },
              { icon: DollarSign, label: 'Net Margin', value: revenue > 0 ? `${Math.round(netMargin)}%` : '—', color: netMargin >= targets.netMin ? 'text-green-400' : 'text-orange-400' },
            ].map((s, i) => (
              <div key={i} className="bg-card border border-border rounded-xl p-5">
                <div className="flex items-center gap-2 mb-2">
                  <s.icon className={`w-4 h-4 ${s.color}`} />
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{s.label}</span>
                </div>
                <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                {s.sub && <p className="text-xs text-muted-foreground mt-0.5">{s.sub}</p>}
              </div>
            ))}
          </div>

          {graphData.length >= 1 && (
            <div className="bg-card border border-border rounded-xl p-5">
              <h2 className="text-sm font-semibold text-foreground mb-1">Revenue Trend</h2>
              <p className="text-xs text-muted-foreground mb-4">Last {graphData.length} month{graphData.length > 1 ? 's' : ''}</p>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={graphData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }} formatter={(v: number | string, name: string) => [`$${Number(v).toLocaleString()}`, name === 'revenue' ? 'Revenue' : 'Expenses']} />
                  <Line type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" strokeWidth={2.5} dot={{ r: 3, fill: 'hsl(var(--primary))' }} />
                  <Line type="monotone" dataKey="expenses" stroke="#f97316" strokeWidth={1.5} dot={{ r: 2, fill: '#f97316' }} strokeDasharray="4 3" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </>
      )}

      {latest && tab === 'financials' && (
        <>
          <p className="text-sm text-muted-foreground mb-4">{new Date(latest.month).toLocaleString('default', { month: 'long', year: 'numeric' })} · <span className="text-primary capitalize">{targets.label} tier targets</span></p>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-5">
            {[
              { label: 'Total Revenue', value: `$${revenue.toLocaleString()}`, color: 'text-foreground' },
              { label: 'MRR', value: `$${mrr.toLocaleString()}`, color: 'text-primary' },
              { label: 'Gross Profit', value: `$${grossProfit.toLocaleString()}`, color: grossProfit >= 0 ? 'text-green-400' : 'text-destructive' },
              { label: 'Net Profit', value: `$${netProfit.toLocaleString()}`, color: netProfit >= 0 ? 'text-green-400' : 'text-destructive' },
            ].map((s, i) => (
              <div key={i} className="bg-card border border-border rounded-xl p-4">
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">{s.label}</p>
                <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
              </div>
            ))}
          </div>

          <div className="bg-card border border-border rounded-xl p-5 mb-5">
            <h2 className="text-sm font-semibold text-foreground mb-4">Margin Benchmarks</h2>
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

          <div className="bg-card border border-border rounded-xl p-5">
            <h2 className="text-sm font-semibold text-foreground mb-3">Funnel</h2>
            <div className="flex flex-wrap items-center gap-2">
              {[
                { label: 'Content', value: content || '—', color: 'bg-purple-500/20 text-purple-300 border-purple-500/30' },
                { label: 'Ad Spend', value: adSpend > 0 ? `$${adSpend.toLocaleString()}` : '—', color: 'bg-blue-500/20 text-blue-300 border-blue-500/30' },
                { label: 'Leads', value: leads || '—', color: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30' },
                { label: 'Meetings', value: meetings || '—', color: 'bg-orange-500/20 text-orange-300 border-orange-500/30' },
                { label: 'Clients', value: newClients || '—', color: 'bg-green-500/20 text-green-300 border-green-500/30' },
                { label: 'New $', value: newClientVal > 0 ? `$${newClientVal.toLocaleString()}` : '—', color: 'bg-primary/20 text-primary border-primary/30' },
              ].map((s, i, arr) => (
                <div key={i} className="flex items-center gap-2">
                  <div className={`flex flex-col items-center px-3 py-2 rounded-xl border text-center min-w-[80px] ${s.color}`}>
                    <span className="text-lg font-bold leading-tight">{s.value}</span>
                    <span className="text-xs font-medium opacity-80">{s.label}</span>
                  </div>
                  {i < arr.length - 1 && <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0" />}
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* ── Retention & Unit Economics — ProfitX itself, admin only ── */}
      <div className="mt-8 border-t border-border pt-6">
        <div className="flex items-center gap-2 mb-1">
          <Users className="w-4 h-4 text-primary" />
          <h2 className="text-lg font-bold">Retention & Unit Economics</h2>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 border border-primary/30 text-primary font-semibold uppercase tracking-wider">Admin only</span>
        </div>
        <p className="text-xs text-muted-foreground mb-5">How your ProfitX members retain — never shown to members.</p>

        {/* Editable inputs — member billing isn't stored, so these are manual */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
          {[
            { key: 'avg_member_price', label: 'Average member price ($/mo)', value: settings.avg_member_price ?? '' },
            { key: 'acquisition_spend', label: 'Acquisition spend this month ($)', value: settings.acquisition_spend ?? '' },
          ].map(field => (
            <div key={field.key} className="bg-card border border-border rounded-xl p-4">
              <label className="text-xs text-muted-foreground uppercase tracking-wider block mb-2">{field.label}</label>
              <input
                type="number"
                min="0"
                defaultValue={field.value}
                key={`${field.key}-${field.value}`}
                onBlur={e => {
                  if (e.target.value !== field.value) {
                    saveSetting.mutate({ key: field.key, value: e.target.value });
                    toast.success('Saved');
                  }
                }}
                placeholder="0"
                className="w-full px-3 py-2 bg-input border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
          ))}
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-5">
          {[
            { icon: Users, label: 'Active Members', value: `${counts.active}`, color: 'text-green-400' },
            { icon: UserMinus, label: 'Churned', value: `${counts.churned}`, color: 'text-red-400' },
            {
              icon: TrendingUp, label: 'Churn Rate (this month)',
              value: latestPoint?.churnRate !== null && latestPoint ? `${(latestPoint.churnRate * 100).toFixed(1)}%` : '—',
              color: (latestPoint?.churnRate ?? 0) > 0.05 ? 'text-orange-400' : 'text-green-400',
            },
            {
              icon: Repeat, label: 'Renewal Rate (this month)',
              value: renewal.rate !== null ? `${Math.round(renewal.rate * 100)}%` : '—',
              sub: renewal.due > 0 ? `${renewal.renewed} of ${renewal.due} renewals kept` : undefined,
              color: (renewal.rate ?? 1) >= 0.9 ? 'text-green-400' : 'text-orange-400',
            },
            {
              icon: DollarSign, label: 'Member LTV',
              value: ltv !== null ? `$${Math.round(ltv).toLocaleString()}` : arpu > 0 ? '∞' : '—',
              sub: arpu > 0 ? (avgChurnRate ? `ARPU $${arpu.toLocaleString()} ÷ ${(avgChurnRate * 100).toFixed(1)}% churn` : 'no churn in period') : 'set avg member price',
              color: 'text-primary',
            },
            {
              icon: Crosshair, label: 'CAC',
              value: cacValue !== null ? `$${Math.round(cacValue).toLocaleString()}` : '—',
              sub: acquisitionSpend > 0 ? `$${acquisitionSpend.toLocaleString()} ÷ ${latestPoint?.newMembers ?? 0} new` : 'set acquisition spend',
              color: 'text-blue-400',
            },
            {
              icon: TrendingUp, label: 'LTV : CAC',
              value: ltvCac !== null ? `${ltvCac.toFixed(1)} : 1` : '—',
              sub: ltvCacBandResult === 'green' ? '≥3 — outspend everyone' : ltvCacBandResult === 'amber' ? '1–3 — workable' : ltvCacBandResult === 'red' ? '<1 — losing money per member' : 'needs LTV and CAC',
              color: ltvCacBandResult === 'green' ? 'text-green-400' : ltvCacBandResult === 'amber' ? 'text-yellow-400' : ltvCacBandResult === 'red' ? 'text-red-400' : 'text-muted-foreground',
            },
          ].map((s, i) => (
            <div key={i} className="bg-card border border-border rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <s.icon className={`w-4 h-4 ${s.color}`} />
                <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">{s.label}</span>
              </div>
              <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
              {s.sub && <p className="text-[11px] text-muted-foreground mt-0.5">{s.sub}</p>}
            </div>
          ))}
        </div>

        {ltvCacBandResult === 'green' && (
          <div className="mb-5">
            <FlagCard type="tip" message="The big purple monster: high LTV means you can outspend every competitor on acquisition and still win." />
          </div>
        )}

        {/* 6-month churn trend */}
        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="text-sm font-semibold text-foreground mb-1">Member Churn Rate</h3>
          <p className="text-xs text-muted-foreground mb-4">Last 6 months · churned ÷ active at start of month</p>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={churnChartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }} formatter={(v: number | string) => [`${v}%`, 'Churn']} />
              <Line type="monotone" dataKey="churn" stroke="hsl(var(--primary))" strokeWidth={2.5} dot={{ r: 3, fill: 'hsl(var(--primary))' }} connectNulls />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </PageLayout>
  );
}

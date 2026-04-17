import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  LineChart, Line, ResponsiveContainer, Tooltip, XAxis
} from 'recharts';
import { TrendingUp, Receipt, DollarSign, Trophy, Plus, ClipboardList } from 'lucide-react';
import PageLayout from '@/components/PageLayout';
import GoalCountdown from '@/components/GoalCountdown';
import { supabase } from '@/lib/supabase';
import { useRequireAuth } from '@/hooks/useAuth';
import { usePageTracking } from '@/hooks/usePageTracking';

export default function Dashboard() {
  const { user } = useRequireAuth();
  usePageTracking('dashboard');
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [winModalOpen, setWinModalOpen] = useState(false);
  const [winForm, setWinForm] = useState({ win_text: '', cash_amount: '' });
  const [winSaved, setWinSaved] = useState(false);

  const { data: monthlyHistory = [] } = useQuery({
    queryKey: ['monthly-history', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from('monthly_totals')
        .select('month, mrr_manual, mrr, oneoff_revenue, total_revenue, expenses')
        .eq('user_id', user!.id)
        .order('month', { ascending: true })
        .limit(12);
      return data ?? [];
    },
  });

  const latest = monthlyHistory[monthlyHistory.length - 1];
  const prev = monthlyHistory[monthlyHistory.length - 2];

  const latestRevenue = Number(latest?.total_revenue || 0) || (Number(latest?.mrr_manual || latest?.mrr || 0) + Number(latest?.oneoff_revenue || 0));
  const latestExpenses = Number(latest?.expenses || 0);
  const latestProfit = latestRevenue - latestExpenses;

  const prevRevenue = Number(prev?.total_revenue || 0) || (Number(prev?.mrr_manual || prev?.mrr || 0) + Number(prev?.oneoff_revenue || 0));
  const revenueGrowth = prevRevenue > 0 ? Math.round(((latestRevenue - prevRevenue) / prevRevenue) * 100) : null;

  const graphData = monthlyHistory.slice(-6).map((m: any) => {
    const rev = Number(m.total_revenue || 0) || (Number(m.mrr_manual || m.mrr || 0) + Number(m.oneoff_revenue || 0));
    return { month: new Date(m.month).toLocaleString('default', { month: 'short' }), revenue: rev, expenses: Number(m.expenses || 0) };
  });

  const { data: recentWins = [] } = useQuery({
    queryKey: ['recent-wins-dash', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from('weekly_wins').select('id, win_text, created_at, cash_amount').eq('user_id', user!.id).order('created_at', { ascending: false }).limit(5);
      return data ?? [];
    },
  });

  const addWin = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('weekly_wins').insert({
        user_id: user!.id, win_text: winForm.win_text, cash_amount: parseFloat(winForm.cash_amount) || 0, source: 'quick_win', week_ending: new Date().toISOString().split('T')[0],
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['recent-wins-dash'] });
      qc.invalidateQueries({ queryKey: ['wins-wall'] });
      setWinForm({ win_text: '', cash_amount: '' });
      setWinSaved(true);
      setTimeout(() => { setWinSaved(false); setWinModalOpen(false); }, 2000);
    },
  });

  const SparkTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    return <div className="bg-card border border-border rounded px-2 py-1 text-xs">${Number(payload[0].value).toLocaleString()}</div>;
  };

  const StatCard = ({ icon: Icon, label, value, sub, color = 'text-primary', sparkData, sparkKey, sparkColor }: any) => (
    <div className="bg-card border border-border rounded-xl p-5 flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Icon className={`w-4 h-4 ${color}`} />
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</span>
      </div>
      <div>
        <p className={`text-2xl font-bold ${color}`}>{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      </div>
      {sparkData && sparkData.length > 1 && (
        <ResponsiveContainer width="100%" height={36}>
          <LineChart data={sparkData} margin={{ top: 2, right: 0, left: 0, bottom: 2 }}>
            <Line type="monotone" dataKey={sparkKey} stroke={sparkColor || 'hsl(var(--primary))'} strokeWidth={1.5} dot={false} />
            <Tooltip content={<SparkTooltip />} />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );

  return (
    <PageLayout>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Your business at a glance.</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setWinModalOpen(true)} className="flex items-center gap-2 px-4 py-2 bg-primary/10 text-primary border border-primary/30 rounded-lg text-sm font-semibold hover:bg-primary/20 transition">
            <Plus className="w-4 h-4" /> Add a Win
          </button>
          <button onClick={() => navigate('/submissions/monthly')} className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:bg-primary/90 transition shadow-lg shadow-primary/20">
            <ClipboardList className="w-4 h-4" /> Submit Month
          </button>
        </div>
      </div>

      {(() => {
        const margin = latestRevenue > 0 ? (latestProfit / latestRevenue) * 100 : 0;
        const marginColor = margin >= 30 ? 'text-green-400' : margin >= 15 ? 'text-yellow-400' : margin >= 0 ? 'text-orange-400' : 'text-destructive';
        const marginLabel = margin >= 30 ? 'Healthy' : margin >= 15 ? 'OK' : margin >= 0 ? 'Tight' : 'Loss';
        return (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
            <StatCard icon={TrendingUp} label="Revenue" value={latestRevenue > 0 ? `$${latestRevenue.toLocaleString()}` : '—'} sub={revenueGrowth !== null ? `${revenueGrowth >= 0 ? '+' : ''}${revenueGrowth}% vs last month` : 'Submit your first month to track'} sparkData={graphData} sparkKey="revenue" sparkColor="hsl(var(--primary))" />
            <StatCard icon={Receipt} label="Expenses" value={latestExpenses > 0 ? `$${latestExpenses.toLocaleString()}` : '—'} color="text-orange-400" sparkData={graphData} sparkKey="expenses" sparkColor="#f97316" />
            <StatCard icon={DollarSign} label="Profit" value={latestRevenue > 0 ? `$${latestProfit.toLocaleString()}` : '—'} color={latestProfit >= 0 ? 'text-green-400' : 'text-destructive'} sparkData={graphData.map((d: any) => ({ ...d, profit: d.revenue - d.expenses }))} sparkKey="profit" sparkColor="#4ade80" />
            <StatCard icon={DollarSign} label="Net Margin" value={latestRevenue > 0 ? `${Math.round(margin)}%` : '—'} sub={latestRevenue > 0 ? marginLabel : ''} color={marginColor} sparkData={graphData.map((d: any) => ({ ...d, marginPct: d.revenue > 0 ? Math.round(((d.revenue - d.expenses) / d.revenue) * 100) : 0 }))} sparkKey="marginPct" sparkColor={margin >= 30 ? '#4ade80' : margin >= 15 ? '#facc15' : margin >= 0 ? '#f97316' : '#ef4444'} />
          </div>
        );
      })()}

      {graphData.length >= 1 ? (
        <div className="bg-card border border-border rounded-xl p-5 mb-6">
          <h2 className="text-sm font-semibold text-foreground mb-1">Revenue Trend</h2>
          <p className="text-xs text-muted-foreground mb-4">Last {graphData.length} month{graphData.length > 1 ? 's' : ''}</p>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={graphData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }} formatter={(v: any, name: string) => [`$${Number(v).toLocaleString()}`, name === 'revenue' ? 'Revenue' : 'Expenses']} />
              <Line type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" strokeWidth={2.5} dot={{ r: 3, fill: 'hsl(var(--primary))' }} activeDot={{ r: 5 }} />
              <Line type="monotone" dataKey="expenses" stroke="#f97316" strokeWidth={1.5} dot={{ r: 2, fill: '#f97316' }} strokeDasharray="4 3" />
            </LineChart>
          </ResponsiveContainer>
          <div className="flex items-center gap-5 mt-2">
            <div className="flex items-center gap-1.5"><div className="w-3 h-0.5 bg-primary rounded" /><span className="text-xs text-muted-foreground">Revenue</span></div>
            <div className="flex items-center gap-1.5"><div className="w-3 h-0.5 bg-orange-400 rounded" /><span className="text-xs text-muted-foreground">Expenses</span></div>
          </div>
        </div>
      ) : (
        <div className="bg-card border border-border border-dashed rounded-xl p-8 mb-6 text-center">
          <TrendingUp className="w-8 h-8 text-muted-foreground mx-auto mb-3 opacity-40" />
          <p className="text-sm text-muted-foreground">Submit your first monthly check-in to start tracking revenue growth.</p>
        </div>
      )}

      <div className="bg-card border border-border rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Trophy className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-semibold text-foreground">Recent Wins</h2>
          </div>
          <button onClick={() => navigate('/wins')} className="text-xs text-primary hover:underline">See all →</button>
        </div>
        {recentWins.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">No wins yet — hit "Add a Win" to log your first one 🔥</p>
        ) : (
          <div className="space-y-3">
            {recentWins.map((w: any) => (
              <div key={w.id} className="flex items-start gap-3 py-2 border-b border-border/50 last:border-0">
                <span className="text-base mt-0.5">🏆</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground">{w.win_text}</p>
                  {Number(w.cash_amount) > 0 && <p className="text-xs text-green-400 font-semibold mt-0.5">+${Number(w.cash_amount).toLocaleString()}</p>}
                </div>
                <span className="text-xs text-muted-foreground shrink-0">{new Date(w.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {winModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex items-center gap-2 mb-1">
              <Trophy className="w-5 h-5 text-primary" />
              <h2 className="text-lg font-bold">Log a Win</h2>
            </div>
            <p className="text-xs text-muted-foreground mb-5">Anything counts — a breakthrough, good meeting, new lead, content posted, a chat, signed a client. Log it all. 🔥</p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-foreground mb-1.5">What's the win?</label>
                <textarea value={winForm.win_text} onChange={(e) => setWinForm({ ...winForm, win_text: e.target.value })} rows={3} placeholder="e.g. Had an amazing discovery call, posted 5 reels this week, signed a new $3k retainer..." className="w-full px-4 py-2.5 bg-input border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 transition resize-none" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-foreground mb-1.5">Cash made (optional)</label>
                <input type="number" value={winForm.cash_amount} onChange={(e) => setWinForm({ ...winForm, cash_amount: e.target.value })} placeholder="0" className="w-full px-4 py-2.5 bg-input border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 transition" />
              </div>
            </div>
            <div className="flex items-center justify-between mt-5">
              <button onClick={() => { setWinModalOpen(false); setWinForm({ win_text: '', cash_amount: '' }); }} className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition">Cancel</button>
              {winSaved ? (
                <span className="text-sm text-green-400 font-semibold">✓ Win posted to Wins Wall!</span>
              ) : (
                <button onClick={() => { if (!winForm.win_text.trim()) return; addWin.mutate(); }} disabled={addWin.isPending || !winForm.win_text.trim()} className="px-5 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:bg-primary/90 transition disabled:opacity-50">
                  {addWin.isPending ? 'Posting...' : 'Post Win 🏆'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </PageLayout>
  );
}

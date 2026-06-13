import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { LineChart, Line, ResponsiveContainer, Tooltip, XAxis } from 'recharts';
import { TrendingUp, Receipt, DollarSign, Trophy, Plus, ClipboardList, Eye } from 'lucide-react';
import PageLayout from '@/components/PageLayout';
import AnnouncementsModal from '@/components/AnnouncementsModal';
import { useRequireAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { usePageTracking } from '@/hooks/usePageTracking';
import { supabase } from '@/lib/supabase';

// EXAMPLE / DEMO DATA — shown ONLY to admins so real numbers aren't exposed during portal demos.
const EXAMPLE_HISTORY = [
  { month: 'Dec', revenue: 8200, expenses: 3100 },
  { month: 'Jan', revenue: 11400, expenses: 3600 },
  { month: 'Feb', revenue: 13800, expenses: 4200 },
  { month: 'Mar', revenue: 17500, expenses: 4800 },
  { month: 'Apr', revenue: 21300, expenses: 5400 },
  { month: 'May', revenue: 26900, expenses: 6100 },
];

const EXAMPLE_WINS = [
  { id: '1', win_text: 'Signed a new $3k/mo retainer client 🎉', cash_amount: 3000, created_at: '2026-05-22' },
  { id: '2', win_text: 'Posted 5 reels this week, one hit 12k views', cash_amount: 0, created_at: '2026-05-20' },
  { id: '3', win_text: 'Booked 4 discovery calls from DMs', cash_amount: 0, created_at: '2026-05-18' },
  { id: '4', win_text: 'Collected $5,400 in outstanding invoices', cash_amount: 5400, created_at: '2026-05-15' },
];

function ExampleBadge() {
  return (
    <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full bg-blue-500/15 border border-blue-500/40 text-blue-400">
      <Eye className="w-3 h-3" /> Example
    </span>
  );
}

const SparkTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  return <div className="bg-card border border-border rounded px-2 py-1 text-xs">${Number(payload[0].value).toLocaleString()}</div>;
};

function StatCard({ icon: Icon, label, value, sub, sparkKey, sparkColor, history, accent }: any) {
  return (
    <div className={`bg-card border ${accent} rounded-xl p-5 flex flex-col gap-3 relative`}>
      <div className="flex items-center gap-2">
        <Icon className="w-4 h-4 text-blue-400" />
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</span>
      </div>
      <div>
        <p className="text-2xl font-bold text-blue-400">{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      </div>
      {history.length > 0 && (
        <ResponsiveContainer width="100%" height={36}>
          <LineChart data={history} margin={{ top: 2, right: 0, left: 0, bottom: 2 }}>
            <Line type="monotone" dataKey={sparkKey} stroke={sparkColor} strokeWidth={1.5} dot={false} />
            <Tooltip content={<SparkTooltip />} />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

export default function Dashboard() {
  const { user } = useRequireAuth();
  const { data: profile } = useProfile();
  usePageTracking('dashboard');
  const navigate = useNavigate();
  const [winModalOpen, setWinModalOpen] = useState(false);

  const isAdmin = !!profile?.is_admin;

  // ---------- REAL DATA (non-admins) ----------
  const { data: realHistory = [] } = useQuery({
    queryKey: ['dashboard-history', user?.id],
    enabled: !!user && !isAdmin,
    queryFn: async () => {
      const { data } = await supabase
        .from('monthly_totals')
        .select('*')
        .eq('user_id', user!.id)
        .order('month', { ascending: true })
        .limit(12);
      return data ?? [];
    },
  });

  const { data: realWins = [] } = useQuery({
    queryKey: ['dashboard-wins', user?.id],
    enabled: !!user && !isAdmin,
    queryFn: async () => {
      const { data } = await supabase
        .from('weekly_wins')
        .select('id, win_text, cash_amount, created_at')
        .eq('user_id', user!.id)
        .not('win_text', 'eq', '')
        .order('created_at', { ascending: false })
        .limit(4);
      return data ?? [];
    },
  });

  // Choose data source
  const history = isAdmin
    ? EXAMPLE_HISTORY
    : realHistory.slice(-6).map((m: any) => {
        const rev = Number(m.total_revenue || 0) || (Number(m.mrr_manual || m.mrr || 0) + Number(m.oneoff_revenue || 0));
        return { month: new Date(m.month).toLocaleString('default', { month: 'short' }), revenue: rev, expenses: Number(m.expenses || 0) };
      });
  const wins = isAdmin ? EXAMPLE_WINS : realWins;

  const latest = history[history.length - 1];
  const prev = history[history.length - 2];
  const latestRevenue = latest?.revenue ?? 0;
  const latestExpenses = latest?.expenses ?? 0;
  const latestProfit = latestRevenue - latestExpenses;
  const revenueGrowth = prev && prev.revenue > 0 ? Math.round(((latestRevenue - prev.revenue) / prev.revenue) * 100) : null;
  const margin = latestRevenue > 0 ? (latestProfit / latestRevenue) * 100 : 0;

  const hasData = history.length > 0 && latestRevenue > 0;
  const accent = isAdmin ? 'border-blue-500/30' : 'border-border';

  return (
    <PageLayout>
      <AnnouncementsModal />

      {isAdmin && (
        <div className="bg-blue-500/10 border border-blue-500/40 rounded-xl p-4 mb-6 flex items-center gap-3 flex-wrap">
          <Eye className="w-5 h-5 text-blue-400 shrink-0" />
          <div className="flex-1 min-w-[200px]">
            <p className="text-sm font-bold text-blue-400">Example data shown for demo purposes</p>
            <p className="text-xs text-muted-foreground mt-0.5">Admins see illustrative numbers here. Your real numbers live on /admin/my-finances.</p>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold">Dashboard</h1>
            {isAdmin && <ExampleBadge />}
          </div>
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

      {!isAdmin && !hasData ? (
        <div className="bg-card border border-border border-dashed rounded-xl p-8 text-center">
          <p className="text-sm text-muted-foreground">No monthly totals submitted yet. Submit your first month to see your real numbers here.</p>
          <button onClick={() => navigate('/submissions/monthly')} className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-semibold">Submit your first month</button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
            <StatCard icon={TrendingUp} label={`Revenue${isAdmin ? ' *example*' : ''}`} value={`$${latestRevenue.toLocaleString()}`} sub={revenueGrowth !== null ? `${revenueGrowth >= 0 ? '+' : ''}${revenueGrowth}% vs last month` : null} sparkKey="revenue" sparkColor="#60a5fa" history={history} accent={accent} />
            <StatCard icon={Receipt} label={`Expenses${isAdmin ? ' *example*' : ''}`} value={`$${latestExpenses.toLocaleString()}`} sparkKey="expenses" sparkColor="#60a5fa" history={history} accent={accent} />
            <StatCard icon={DollarSign} label={`Profit${isAdmin ? ' *example*' : ''}`} value={`$${latestProfit.toLocaleString()}`} sparkKey="revenue" sparkColor="#60a5fa" history={history} accent={accent} />
            <StatCard icon={DollarSign} label={`Net Margin${isAdmin ? ' *example*' : ''}`} value={`${Math.round(margin)}%`} sparkKey="revenue" sparkColor="#60a5fa" history={history} accent={accent} />
          </div>

          <div className={`bg-card border ${accent} rounded-xl p-5 mb-6`}>
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-sm font-semibold text-foreground">Revenue Trend</h2>
              {isAdmin && <ExampleBadge />}
            </div>
            <p className="text-xs text-muted-foreground mb-4">Last {history.length} month{history.length > 1 ? 's' : ''}{isAdmin ? ' — illustrative data' : ''}</p>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={history} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }} formatter={(v: any, name: string) => [`$${Number(v).toLocaleString()}`, name === 'revenue' ? 'Revenue' : 'Expenses']} />
                <Line type="monotone" dataKey="revenue" stroke="#60a5fa" strokeWidth={2.5} dot={{ r: 3, fill: '#60a5fa' }} activeDot={{ r: 5 }} />
                <Line type="monotone" dataKey="expenses" stroke="#93c5fd" strokeWidth={1.5} dot={{ r: 2, fill: '#93c5fd' }} strokeDasharray="4 3" />
              </LineChart>
            </ResponsiveContainer>
            <div className="flex items-center gap-5 mt-2">
              <div className="flex items-center gap-1.5"><div className="w-3 h-0.5 bg-blue-400 rounded" /><span className="text-xs text-muted-foreground">Revenue</span></div>
              <div className="flex items-center gap-1.5"><div className="w-3 h-0.5 bg-blue-300 rounded" /><span className="text-xs text-muted-foreground">Expenses</span></div>
            </div>
          </div>
        </>
      )}

      <div className={`bg-card border ${accent} rounded-xl p-5`}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Trophy className="w-4 h-4 text-blue-400" />
            <h2 className="text-sm font-semibold text-foreground">Recent Wins</h2>
            {isAdmin && <ExampleBadge />}
          </div>
          <button onClick={() => navigate('/wins')} className="text-xs text-primary hover:underline">See all →</button>
        </div>
        {wins.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">No wins logged yet. Add your first one!</p>
        ) : (
          <div className="space-y-3">
            {wins.map((w: any) => (
              <div key={w.id} className="flex items-start gap-3 py-2 border-b border-border/50 last:border-0">
                <span className="text-base mt-0.5">🏆</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground">{w.win_text}</p>
                  {w.cash_amount > 0 && <p className="text-xs text-blue-400 font-semibold mt-0.5">+${Number(w.cash_amount).toLocaleString()}</p>}
                </div>
                <span className="text-xs text-muted-foreground shrink-0">{new Date(w.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {winModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4" onClick={() => setWinModalOpen(false)}>
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-md shadow-2xl text-center" onClick={(e) => e.stopPropagation()}>
            <Trophy className="w-8 h-8 text-blue-400 mx-auto mb-2" />
            <h2 className="text-lg font-bold mb-1">{isAdmin ? 'Demo mode' : 'Add a win'}</h2>
            <p className="text-sm text-muted-foreground mb-4">{isAdmin ? 'Wins entry is disabled on the demo dashboard.' : 'Head to the Wins Wall to post your win.'}</p>
            <div className="flex gap-2 justify-center">
              <button onClick={() => setWinModalOpen(false)} className="px-5 py-2 bg-muted text-foreground rounded-lg text-sm font-semibold">Close</button>
              {!isAdmin && (
                <button onClick={() => { setWinModalOpen(false); navigate('/wins'); }} className="px-5 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-semibold">Go to Wins Wall</button>
              )}
            </div>
          </div>
        </div>
      )}
    </PageLayout>
  );
}

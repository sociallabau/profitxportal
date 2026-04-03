import { useNavigate, Link } from 'react-router-dom';
import { DollarSign, Users, UserPlus, Target } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useQuery } from '@tanstack/react-query';
import PageLayout from '@/components/PageLayout';
import StatCard from '@/components/StatCard';
import { supabase } from '@/lib/supabase';
import { useRequireAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';

export default function Dashboard() {
  const { user, loading: authLoading } = useRequireAuth();
  const { data: profile } = useProfile();

  const { data: monthlyData } = useQuery({
    queryKey: ['monthly-totals', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('monthly_totals')
        .select('month, mrr, new_clients, leads_generated')
        .eq('user_id', user!.id)
        .order('month', { ascending: true })
        .limit(6);
      if (error) throw error;
      return data.map((row) => ({
        month: new Date(row.month).toLocaleString('default', { month: 'short' }),
        revenue: row.mrr,
        clients: row.new_clients,
        leads: row.leads_generated,
      }));
    },
  });

  const { data: recentWins } = useQuery({
    queryKey: ['recent-wins', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from('weekly_wins')
        .select('win_text, created_at')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false })
        .limit(3);
      return data ?? [];
    },
  });

  const { data: recentClients } = useQuery({
    queryKey: ['recent-clients', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from('new_clients')
        .select('client_name, monthly_value, signed_date')
        .eq('user_id', user!.id)
        .order('signed_date', { ascending: false })
        .limit(3);
      return data ?? [];
    },
  });

  const latest = monthlyData?.at(-1);
  const prev = monthlyData?.at(-2);
  const mrrChange = latest && prev && prev.revenue > 0
    ? Math.round(((latest.revenue - prev.revenue) / prev.revenue) * 100)
    : 0;

  if (authLoading) return null;

  const now = new Date();
  const greeting = now.getHours() < 12 ? 'Good morning' : now.getHours() < 18 ? 'Good afternoon' : 'Good evening';

  return (
    <PageLayout>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl text-foreground">
            {greeting}{profile?.full_name ? `, ${profile.full_name}` : ''} 👋
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
          </p>
        </div>
        <Link
          to="/submissions/monthly"
          className="inline-flex items-center gap-2 h-10 px-5 bg-primary text-primary-foreground font-semibold rounded-lg hover:bg-primary/90 transition-all shadow-md shadow-primary/20 text-sm shrink-0"
        >
          Submit this month's data →
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard title="MRR This Month" value={latest?.revenue ? `$${latest.revenue.toLocaleString()}` : '—'} change={mrrChange} icon={DollarSign} />
        <StatCard title="New Clients" value={String(latest?.clients ?? '—')} change={0} icon={UserPlus} />
        <StatCard title="Leads Generated" value={String(latest?.leads ?? '—')} change={0} icon={Target} />
        <StatCard title="Months Tracked" value={String(monthlyData?.length ?? 0)} change={0} icon={Users} />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'View Roadmap', path: '/roadmap', emoji: '🗺️' },
          { label: 'Log a Win', path: '/submissions/wins', emoji: '🏆' },
          { label: 'Content Stats', path: '/content', emoji: '📊' },
          { label: 'AI Tools', path: '/ai-tools', emoji: '✨' },
        ].map((a) => (
          <Link key={a.path} to={a.path}
            className="flex flex-col items-center gap-2 p-4 bg-card border border-border rounded-xl hover:border-primary/40 hover:bg-primary/5 transition-all text-center group">
            <span className="text-2xl">{a.emoji}</span>
            <span className="text-xs font-semibold text-muted-foreground group-hover:text-foreground transition-colors">{a.label}</span>
          </Link>
        ))}
      </div>

      <div className="bg-card border border-border rounded-xl p-5 mb-6">
        <h3 className="text-sm font-semibold text-foreground mb-4">Revenue — Last 6 Months</h3>
        {monthlyData && monthlyData.length > 0 ? (
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2e2e2e" />
                <XAxis dataKey="month" stroke="#888" tick={{ fontSize: 11 }} />
                <YAxis stroke="#888" tick={{ fontSize: 11 }} tickFormatter={(v) => `$${v / 1000}k`} />
                <Tooltip formatter={(v: number) => [`$${v.toLocaleString()}`, 'MRR']} contentStyle={{ background: '#1c1c1c', border: '1px solid #2e2e2e', borderRadius: 8 }} />
                <Line type="monotone" dataKey="revenue" stroke="#AA44FF" strokeWidth={2} dot={{ fill: '#AA44FF', r: 4 }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="h-56 flex flex-col items-center justify-center text-muted-foreground">
            <p className="text-sm">No data yet.</p>
            <Link to="/submissions/monthly" className="mt-2 text-sm text-primary hover:underline">Submit your first month →</Link>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-foreground">Recent Wins</h3>
            <Link to="/submissions/wins" className="text-xs text-primary hover:underline">View all</Link>
          </div>
          {recentWins && recentWins.length > 0 ? (
            <div className="space-y-2">
              {recentWins.map((w: any, i: number) => (
                <div key={i} className="flex items-start gap-2 text-sm">
                  <span className="text-primary mt-0.5">🏆</span>
                  <span className="text-muted-foreground">{w.win_text}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No wins logged yet. <Link to="/submissions/wins" className="text-primary hover:underline">Add your first →</Link></p>
          )}
        </div>

        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-foreground">Recent Clients</h3>
            <Link to="/submissions/clients" className="text-xs text-primary hover:underline">View all</Link>
          </div>
          {recentClients && recentClients.length > 0 ? (
            <div className="space-y-2">
              {recentClients.map((c: any, i: number) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <span className="text-foreground">{c.client_name}</span>
                  <span className="text-primary font-semibold">${c.monthly_value.toLocaleString()}/mo</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No clients yet. <Link to="/submissions/clients" className="text-primary hover:underline">Add your first →</Link></p>
          )}
        </div>
      </div>
    </PageLayout>
  );
}

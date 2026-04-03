import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { DollarSign, Users, UserPlus, Target, Route, Banknote, ArrowRight } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useQuery } from '@tanstack/react-query';
import PageLayout from '@/components/PageLayout';
import StatCard from '@/components/StatCard';
import MilestoneCelebration from '@/components/MilestoneCelebration';
import OnboardingModal from '@/components/OnboardingModal';
import { supabase } from '@/lib/supabase';
import { useRequireAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { useGoal } from '@/hooks/useGoal';
import { useWeeklyFocus } from '@/hooks/useWeeklyFocus';

export default function Dashboard() {
  const { user, loading: authLoading } = useRequireAuth();
  const { data: profile } = useProfile();
  const { goal: { data: goalData } } = useGoal();
  const { data: focusItems } = useWeeklyFocus();
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    if (profile && profile.onboarded === false) {
      setShowOnboarding(true);
    }
  }, [profile]);

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

  const { data: cashMenuCount = 0 } = useQuery({
    queryKey: ['cash-menu-count'],
    queryFn: async () => {
      const { count } = await supabase
        .from('cash_menu_actions')
        .select('*', { count: 'exact', head: true });
      return count ?? 0;
    },
  });

  const navigate = useNavigate();
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

      {/* 90-Day MRR Goal Card */}
      {goalData && (() => {
        const currentMRR = latest?.revenue ?? goalData.starting_mrr;
        const range = goalData.target_mrr - goalData.starting_mrr;
        const progress = range > 0 ? Math.min(100, Math.round(((currentMRR - goalData.starting_mrr) / range) * 100)) : 0;
        const remaining = Math.max(0, goalData.target_mrr - currentMRR);
        return (
          <div className="bg-card border border-border rounded-xl p-5 mb-6">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-sm font-semibold text-foreground">90-Day MRR Goal</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Target: <span className="text-primary font-semibold">${goalData.target_mrr.toLocaleString()}</span>
                  {goalData.target_date && ` · Due ${new Date(goalData.target_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`}
                </p>
              </div>
              <span className="text-2xl font-bold text-primary">{progress}%</span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden mb-2">
              <div
                className="h-full bg-primary rounded-full transition-all duration-500"
                style={{ width: `${progress}%`, boxShadow: '0 0 8px rgba(170,68,255,0.5)' }}
              />
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Current: <span className="text-foreground font-semibold">${currentMRR.toLocaleString()}</span></span>
              {remaining > 0
                ? <span>$<span className="text-foreground font-semibold">{remaining.toLocaleString()}</span> to go</span>
                : <span className="text-emerald-400 font-semibold">🎯 Goal reached!</span>
              }
            </div>
          </div>
        );
      })()}

      {/* Cash Menu Teaser */}
      <div
        onClick={() => navigate('/cash-menu')}
        className="bg-card border border-border rounded-xl p-5 mb-6 cursor-pointer hover:border-primary/50 transition-all group"
      >
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary/15 flex items-center justify-center">
              <Banknote className="w-4 h-4 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Cash Menu</p>
              <p className="text-foreground font-bold italic text-lg">Quick Cash Moves</p>
            </div>
          </div>
          <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors mt-1" />
        </div>
        <p className="text-muted-foreground text-sm mt-3">
          {cashMenuCount === 4
            ? 'All 4 moves completed 🎉'
            : `${cashMenuCount}/4 moves done — scripts to book calls fast`}
        </p>
      </div>

      {/* This Week's Focus */}
      {focusItems && focusItems.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-5 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Route className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-semibold text-foreground">This Week's Focus</h3>
            </div>
            <Link to="/roadmap" className="text-xs text-primary hover:underline">View Roadmap →</Link>
          </div>
          <div className="space-y-2">
            {focusItems.map((item, i) => {
              const statusConfig = {
                red:      { dot: 'bg-destructive',   label: 'Needs work',  text: 'text-destructive' },
                amber:    { dot: 'bg-warning',       label: 'In progress', text: 'text-warning' },
                unscored: { dot: 'bg-muted',         label: 'Not started', text: 'text-muted-foreground' },
              }[item.status] ?? { dot: 'bg-muted', label: 'Not started', text: 'text-muted-foreground' };
              return (
                <div key={`${item.pillar}-${item.n}`}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-muted/30 border border-border/50">
                  <span className="text-xs font-bold text-primary/60 w-4 shrink-0">#{i + 1}</span>
                  <div className={`w-2 h-2 rounded-full shrink-0 ${statusConfig.dot}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{item.title}</p>
                    <p className="text-xs text-muted-foreground">{item.pillarLabel} · Module {item.n}</p>
                  </div>
                  <span className={`text-xs font-medium shrink-0 ${statusConfig.text}`}>{statusConfig.label}</span>
                </div>
              );
            })}
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            These modules are your biggest unlock right now. Head to the Roadmap to score them after doing the work.
          </p>
        </div>
      )}

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

      {/* Milestone Celebration */}
      {latest?.revenue && profile && (
        <MilestoneCelebration
          currentMrr={latest.revenue}
          milestonesHit={(profile as any).milestones_hit ?? []}
        />
      )}

      {/* Onboarding Modal */}
      {showOnboarding && (
        <OnboardingModal onComplete={() => setShowOnboarding(false)} />
      )}
    </PageLayout>
  );
}

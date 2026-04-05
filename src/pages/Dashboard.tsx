import { useQuery } from '@tanstack/react-query';
import { Trophy, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import PageLayout from '@/components/PageLayout';
import { supabase } from '@/lib/supabase';
import { useRequireAuth } from '@/hooks/useAuth';

function timeAgo(date: string) {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return days < 7 ? `${days}d ago` : new Date(date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

export default function Dashboard() {
  const { user, loading } = useRequireAuth();

  const { data: retainerClients = [] } = useQuery({
    queryKey: ['retainer-clients-mrr', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from('new_clients')
        .select('monthly_value, client_name, signed_date')
        .eq('user_id', user!.id);
      return data ?? [];
    },
  });

  const { data: thisMonth } = useQuery({
    queryKey: ['monthly-totals', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const currentMonth = new Date().toISOString().slice(0, 7);
      const { data } = await supabase
        .from('monthly_totals')
        .select('*')
        .eq('user_id', user!.id)
        .eq('month', `${currentMonth}-01`)
        .single();
      return data;
    },
  });

  const { data: recentWins = [] } = useQuery({
    queryKey: ['recent-wins', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from('weekly_wins')
        .select('*')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false })
        .limit(3);
      return data ?? [];
    },
  });

  const { data: profile } = useQuery({
    queryKey: ['profile', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from('profiles')
        .select('full_name, tier')
        .eq('id', user!.id)
        .single();
      return data;
    },
  });

  if (loading) return null;

  const contractedMRR = retainerClients.reduce((sum: number, c: any) => sum + Number(c.monthly_value), 0);
  const collectedMRR  = Number(thisMonth?.mrr ?? 0);
  const oneoffs       = Number(thisMonth?.oneoff_revenue ?? 0);
  const expenses      = Number(thisMonth?.expenses ?? 0);
  const totalRevenue  = collectedMRR + oneoffs;
  const profit        = totalRevenue - expenses;
  const clientCount   = retainerClients.length;

  const firstName = profile?.full_name?.split(' ')[0] ?? 'there';

  return (
    <PageLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Hey {firstName} 👋</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Tier: <span className="font-semibold text-primary capitalize">{profile?.tier ?? 'onramp'}</span>
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs text-muted-foreground mb-1">Contracted MRR</p>
          <p className="text-2xl font-bold text-primary">${contractedMRR.toLocaleString()}</p>
          <p className="text-xs text-muted-foreground mt-1">from {clientCount} retainer{clientCount !== 1 ? 's' : ''}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs text-muted-foreground mb-1">This Month's Revenue</p>
          <p className="text-2xl font-bold text-foreground">${totalRevenue.toLocaleString()}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {thisMonth ? `$${collectedMRR.toLocaleString()} MRR + $${oneoffs.toLocaleString()} one-offs` : 'Not submitted yet'}
          </p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs text-muted-foreground mb-1">Expenses</p>
          <p className="text-2xl font-bold text-foreground">${expenses.toLocaleString()}</p>
          <p className="text-xs text-muted-foreground mt-1">this month</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs text-muted-foreground mb-1">Profit</p>
          <p className={`text-2xl font-bold ${profit >= 0 ? 'text-success' : 'text-destructive'}`}>
            ${profit.toLocaleString()}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {thisMonth ? 'this month' : 'submit monthly totals'}
          </p>
        </div>
      </div>

      <div className="bg-secondary/40 border border-border rounded-lg px-4 py-3 mb-6 flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold text-foreground">
            Contracted MRR vs Collected Revenue
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Contracted MRR updates live when you log a client. Collected Revenue is what you submit in Monthly Totals once cash is in.
          </p>
        </div>
        <Link to="/submissions/monthly" className="text-xs text-primary font-semibold ml-4 flex-shrink-0 hover:underline">
          Submit month →
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Trophy className="w-4 h-4 text-primary" />
              <h2 className="text-sm font-semibold text-foreground">Recent Wins</h2>
            </div>
            <Link to="/wins" className="text-xs text-primary hover:underline">See all →</Link>
          </div>
          {recentWins.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              No wins yet.{' '}
              <Link to="/submissions/wins" className="text-primary hover:underline">Log your first one →</Link>
            </p>
          ) : (
            <div className="space-y-2">
              {recentWins.map((w: any) => (
                <div key={w.id} className="flex items-start gap-2">
                  <span className="text-sm">🏆</span>
                  <div>
                    <p className="text-xs text-foreground leading-snug">{w.win_text}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{timeAgo(w.created_at)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-primary" />
              <h2 className="text-sm font-semibold text-foreground">Retainer Clients</h2>
            </div>
            <Link to="/submissions/clients" className="text-xs text-primary hover:underline">Add client →</Link>
          </div>
          {retainerClients.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              No clients yet.{' '}
              <Link to="/submissions/clients" className="text-primary hover:underline">Log your first client →</Link>
            </p>
          ) : (
            <div className="space-y-2">
              {(retainerClients as any[]).slice(0, 4).map((c: any, i: number) => (
                <div key={i} className="flex items-center justify-between">
                  <p className="text-xs font-medium text-foreground">{c.client_name}</p>
                  <p className="text-xs font-bold text-primary">${Number(c.monthly_value).toLocaleString()}/mo</p>
                </div>
              ))}
              {retainerClients.length > 4 && (
                <p className="text-xs text-muted-foreground">+{retainerClients.length - 4} more</p>
              )}
            </div>
          )}
        </div>
      </div>
    </PageLayout>
  );
}

import { useQuery } from '@tanstack/react-query';
import { Trophy } from 'lucide-react';
import PageLayout from '@/components/PageLayout';
import { supabase } from '@/lib/supabase';
import { useRequireAuth } from '@/hooks/useAuth';
import { usePageTracking } from '@/hooks/usePageTracking';

function timeAgo(date: string) {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

export default function WinsWall() {
  useRequireAuth();

  const { data: submissions = [], isLoading } = useQuery({
    queryKey: ['wins-wall'],
    queryFn: async () => {
      const { data } = await supabase
        .from('weekly_wins')
        .select('id, win_text, created_at, user_id, profiles(full_name)')
        .not('win_text', 'eq', '')
        .order('created_at', { ascending: false })
        .limit(50);
      return data ?? [];
    },
    refetchInterval: 30000,
  });

  return (
    <PageLayout>
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-primary" />
            <span className="text-xs font-medium text-primary uppercase tracking-wider">Community</span>
          </div>
          <h1 className="text-3xl font-bold italic text-foreground">Wins Wall</h1>
          <p className="text-muted-foreground text-sm">
            Every win submitted in a weekly check-in — yours and everyone else's. Keep moving.
          </p>
        </div>

        {/* Count */}
        {!isLoading && (
          <p className="text-xs text-muted-foreground">{submissions.length} wins from the group</p>
        )}

        {/* Feed */}
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-card border border-border rounded-xl p-5 animate-pulse">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-8 h-8 rounded-full bg-muted" />
                  <div className="space-y-1.5">
                    <div className="h-3 bg-muted rounded w-24" />
                    <div className="h-2.5 bg-muted rounded w-16" />
                  </div>
                </div>
                <div className="h-3 bg-muted rounded w-3/4" />
              </div>
            ))}
          </div>
        ) : submissions.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <Trophy className="w-8 h-8 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No wins submitted yet.</p>
            <p className="text-xs mt-1">Complete your weekly check-in to appear here.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {submissions.map((sub: any) => {
              const name = sub.profiles?.full_name ?? 'Anonymous';
              const initials = name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase();

              return (
                <div
                  key={sub.id}
                  className="bg-card border border-border rounded-xl p-5 space-y-3 hover:border-primary/30 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary flex-shrink-0">
                      {initials}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">{name}</p>
                      <p className="text-xs text-muted-foreground">{timeAgo(sub.created_at)}</p>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed pl-11">{sub.win_text}</p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </PageLayout>
  );
}

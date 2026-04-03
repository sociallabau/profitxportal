import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import PageLayout from '@/components/PageLayout';
import { supabase } from '@/lib/supabase';
import { useRequireAuth } from '@/hooks/useAuth';

export default function WeeklyWins() {
  const { user } = useRequireAuth();
  const qc = useQueryClient();
  const [winText, setWinText] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const { data: wins } = useQuery({
    queryKey: ['wins', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from('weekly_wins')
        .select('*')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false });
      return data ?? [];
    },
  });

  const addWin = useMutation({
    mutationFn: async (text: string) => {
      const { error } = await supabase.from('weekly_wins').insert({
        user_id: user!.id,
        win_text: text,
        week_ending: new Date().toISOString().split('T')[0],
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['wins'] });
      qc.invalidateQueries({ queryKey: ['recent-wins'] });
      setWinText('');
      setSubmitted(true);
      setTimeout(() => setSubmitted(false), 3000);
    },
  });

  return (
    <PageLayout>
      <h1 className="text-2xl mb-1">Weekly Wins</h1>
      <p className="text-sm text-muted-foreground mb-6">Log a win from this week — anything counts.</p>

      <div className="bg-card border border-border rounded-xl p-5 mb-6">
        <textarea
          value={winText}
          onChange={(e) => setWinText(e.target.value)}
          placeholder="e.g. Signed a $2k/mo retainer client, hit 1k followers, landed my first discovery call..."
          rows={3}
          className="w-full px-4 py-3 bg-input border border-border rounded-lg text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition resize-none"
        />
        <div className="flex items-center justify-between mt-3">
          {submitted && <span className="text-sm text-success">🏆 Win logged!</span>}
          {!submitted && <span />}
          <button
            onClick={() => winText.trim() && addWin.mutate(winText.trim())}
            disabled={!winText.trim() || addWin.isPending}
            className="px-5 py-2 bg-primary text-primary-foreground font-semibold rounded-lg text-sm hover:bg-primary/90 transition-all disabled:opacity-50"
          >
            {addWin.isPending ? 'Saving...' : 'Submit Win →'}
          </button>
        </div>
      </div>

      <h2 className="text-base font-semibold text-foreground mb-3">Your Wins History</h2>
      {wins && wins.length > 0 ? (
        <div className="space-y-2">
          {wins.map((w: any) => (
            <div key={w.id} className="flex items-start gap-3 bg-card border border-border rounded-lg px-4 py-3">
              <span className="text-primary text-lg">🏆</span>
              <div>
                <p className="text-sm text-foreground">{w.win_text}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{new Date(w.created_at).toLocaleDateString()}</p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">No wins yet — add your first one above!</p>
      )}
    </PageLayout>
  );
}

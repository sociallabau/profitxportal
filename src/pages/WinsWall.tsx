import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Trophy, Plus, X } from 'lucide-react';
import PageLayout from '@/components/PageLayout';
import { supabase } from '@/lib/supabase';
import { useRequireAuth } from '@/hooks/useAuth';
import { usePageTracking } from '@/hooks/usePageTracking';
import { toast } from 'sonner';

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

function weekEnding(): string {
  const d = new Date();
  const day = d.getDay(); // 0 Sun..6 Sat
  const diff = (7 - day) % 7; // days until Sunday
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

export default function WinsWall() {
  const { user } = useRequireAuth();
  usePageTracking('wins-wall');
  const qc = useQueryClient();

  const [open, setOpen] = useState(false);
  const [winText, setWinText] = useState('');
  const [cash, setCash] = useState('');
  const [saving, setSaving] = useState(false);

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

  const submitWin = async () => {
    if (!user) return;
    if (!winText.trim()) { toast.error('Add a win first'); return; }
    setSaving(true);
    const cashNum = cash.trim() ? Number(cash) : 0;
    const { error } = await supabase.from('weekly_wins').insert({
      user_id: user.id,
      win_text: winText.trim(),
      cash_amount: Number.isFinite(cashNum) ? cashNum : 0,
      week_ending: weekEnding(),
      source: 'wins_wall',
    });
    setSaving(false);
    if (error) { toast.error('Failed to post'); return; }
    toast.success('Win posted 🎉');
    setWinText(''); setCash(''); setOpen(false);
    qc.invalidateQueries({ queryKey: ['wins-wall'] });
  };

  const inputCls = "w-full px-3 py-2 bg-input border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40";

  return (
    <PageLayout>
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Trophy className="w-5 h-5 text-primary" />
              <span className="text-xs font-medium text-primary uppercase tracking-wider">Community</span>
            </div>
            <h1 className="text-3xl font-bold italic text-foreground">Wins Wall</h1>
            <p className="text-muted-foreground text-sm">
              Every win submitted by the group — yours and everyone else's. Keep moving.
            </p>
          </div>
          <button
            onClick={() => setOpen(true)}
            className="flex-shrink-0 flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-4 h-4" /> Add a Win
          </button>
        </div>

        {/* Count */}
        {!isLoading && submissions.length > 0 && (
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
            <p className="text-sm">No wins yet.</p>
            <p className="text-xs mt-1">Be the first — hit "Add a Win" up top.</p>
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

      {/* Add Win Modal */}
      {open && (
        <>
          <div className="fixed inset-0 z-40 bg-background/70" onClick={() => setOpen(false)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-card border border-border rounded-xl w-full max-w-md p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-foreground">Add a Win</h2>
                <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="space-y-3">
                <textarea
                  placeholder="What's the win? Keep it short and real."
                  rows={4}
                  value={winText}
                  onChange={e => setWinText(e.target.value)}
                  className={`${inputCls} resize-none`}
                  maxLength={500}
                />
                <input
                  type="number"
                  inputMode="decimal"
                  placeholder="$ Cash collected (optional)"
                  value={cash}
                  onChange={e => setCash(e.target.value)}
                  className={inputCls}
                />
              </div>
              <div className="flex gap-2 mt-6">
                <button
                  onClick={() => setOpen(false)}
                  className="flex-1 px-4 py-2 bg-muted text-muted-foreground rounded-lg text-sm font-medium hover:text-foreground transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={submitWin}
                  disabled={saving}
                  className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                  {saving ? 'Posting...' : 'Post Win'}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </PageLayout>
  );
}

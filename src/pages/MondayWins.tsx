import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Trophy } from 'lucide-react';
import PageLayout from '@/components/PageLayout';
import { supabase } from '@/lib/supabase';
import { useRequireAuth } from '@/hooks/useAuth';

function timeAgo(date: string) {
  const days = Math.floor((Date.now() - new Date(date).getTime()) / 86400000);
  if (days === 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days}d ago`;
  return new Date(date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

export default function MondayWins() {
  const { user } = useRequireAuth();
  const qc = useQueryClient();
  const [form, setForm] = useState({
    win_text: '', new_client: false,
    cash_collected: '', deal_value: '',
  });
  const [saved, setSaved] = useState(false);

  const { data: wins = [] } = useQuery({
    queryKey: ['monday-wins', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from('monday_wins')
        .select('*')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false });
      return data ?? [];
    },
  });

  const submit = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('monday_wins').insert({
        user_id: user!.id,
        win_text: form.win_text,
        new_client: form.new_client,
        cash_collected: parseFloat(form.cash_collected) || 0,
        deal_value: parseFloat(form.deal_value) || 0,
        occurred_on: new Date().toISOString().split('T')[0],
      });
      if (error) throw error;

      await supabase.from('weekly_wins').insert({
        user_id: user!.id,
        win_text: form.new_client
          ? `${form.win_text} 💰 New client signed — $${parseFloat(form.deal_value || '0').toLocaleString()}/mo`
          : form.win_text,
        week_ending: new Date().toISOString().split('T')[0],
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['monday-wins'] });
      qc.invalidateQueries({ queryKey: ['wins-wall'] });
      qc.invalidateQueries({ queryKey: ['recent-wins'] });
      setForm({ win_text: '', new_client: false, cash_collected: '', deal_value: '' });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    },
  });

  const totalCash = (wins as any[]).reduce((s: number, w: any) => s + Number(w.cash_collected), 0);

  return (
    <PageLayout>
      <div className="flex items-center gap-2 mb-1">
        <Trophy className="w-5 h-5 text-primary" />
        <h1 className="text-2xl font-bold">Weekly Win</h1>
      </div>
      <p className="text-sm text-muted-foreground mb-6">
        Log a win from this week — a deal, a breakthrough, a result. Takes 60 seconds. Shows on the Wins Wall.
      </p>

      <div className="bg-card border border-border rounded-xl p-5 mb-6 space-y-4">
        <div>
          <label className="block text-sm font-semibold text-foreground mb-1.5">What's the win?</label>
          <textarea
            value={form.win_text}
            onChange={e => setForm(f => ({ ...f, win_text: e.target.value }))}
            rows={2}
            placeholder="e.g. Booked a discovery call with a gym, got a testimonial from a client, posted 3 reels this week..."
            className="w-full px-4 py-2.5 bg-input border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 transition resize-none"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-semibold text-foreground mb-1.5">Cash collected ($)</label>
            <input type="number" value={form.cash_collected} onChange={e => setForm(f => ({ ...f, cash_collected: e.target.value }))}
              placeholder="0"
              className="w-full px-4 py-2.5 bg-input border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 transition" />
          </div>

          <div className="flex items-end gap-3">
            <label className="flex items-center gap-2 cursor-pointer pb-2.5">
              <input type="checkbox" checked={form.new_client}
                onChange={e => setForm(f => ({ ...f, new_client: e.target.checked }))}
                className="h-4 w-4 rounded border-border accent-primary" />
              <span className="text-sm font-semibold text-foreground">New client signed?</span>
            </label>
          </div>

          {form.new_client && (
            <div>
              <label className="block text-sm font-semibold text-foreground mb-1.5">Monthly value ($)</label>
              <input type="number" value={form.deal_value} onChange={e => setForm(f => ({ ...f, deal_value: e.target.value }))}
                placeholder="2500"
                className="w-full px-4 py-2.5 bg-input border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 transition" />
            </div>
          )}
        </div>

        <div className="flex items-center justify-between pt-1">
          {saved ? <span className="text-sm text-success">🏆 Win posted to the Wins Wall!</span> : <span />}
          <button
            onClick={() => form.win_text.trim() && submit.mutate()}
            disabled={!form.win_text.trim() || submit.isPending}
            className="px-5 py-2 bg-primary text-primary-foreground font-semibold rounded-lg text-sm hover:bg-primary/90 transition-all disabled:opacity-50"
          >
            {submit.isPending ? 'Saving...' : 'Submit Win →'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-card border border-border rounded-xl p-4 text-center">
          <p className="text-xs text-muted-foreground mb-1">Total Wins Logged</p>
          <p className="text-2xl font-bold text-foreground">{(wins as any[]).length}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4 text-center">
          <p className="text-xs text-muted-foreground mb-1">Total Cash Logged</p>
          <p className="text-2xl font-bold text-primary">${totalCash.toLocaleString()}</p>
        </div>
      </div>

      {(wins as any[]).length > 0 && (
        <div className="space-y-2">
          {(wins as any[]).map((w: any) => (
            <div key={w.id} className="bg-card border border-border rounded-lg px-4 py-3 flex items-start gap-3">
              <span className="text-base mt-0.5">{w.new_client ? '🤝' : '🏆'}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-foreground leading-snug">{w.win_text}</p>
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-xs text-muted-foreground">{timeAgo(w.created_at)}</span>
                  {Number(w.cash_collected) > 0 && (
                    <span className="text-xs font-semibold text-success">${Number(w.cash_collected).toLocaleString()} collected</span>
                  )}
                  {w.new_client && Number(w.deal_value) > 0 && (
                    <span className="text-xs font-semibold text-primary">${Number(w.deal_value).toLocaleString()}/mo</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </PageLayout>
  );
}

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarCheck, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';
import { describeQuarterly, formatShortDate } from '@/lib/clientCare';
import type { ClientWithHealth } from '@/lib/clientHealth';

export type HistoryRow = {
  month: string; total_revenue: number | null; mrr_manual: number | null; mrr: number | null;
  oneoff_revenue: number | null; active_retainers: number | null;
};

type Goal = { id: string; goal: string; status: string; set_on: string };

const revenueOf = (r: HistoryRow) => Number(r.total_revenue) || (Number(r.mrr_manual || r.mrr || 0) + Number(r.oneoff_revenue || 0));
const todayInput = () => new Date().toISOString().slice(0, 10);
const money = (n: number) => `$${n.toLocaleString()}`;

/**
 * Prep and wrap-up for the 30-minute quarterly call: what moved since the last
 * one, how last quarter's goals went, three things worth raising, then the new
 * goals to hold them to. Completing it logs the call and resets the 90-day clock.
 */
export default function QuarterlyCall({ client, history }: { client: ClientWithHealth; history: HistoryRow[] }) {
  const c = client;
  const q = c.quarterly;
  const qc = useQueryClient();
  const [points, setPoints] = useState<string[]>([]);
  const [newGoals, setNewGoals] = useState(['', '', '']);
  const [callDate, setCallDate] = useState(todayInput());

  const { data: goals = [] } = useQuery({
    queryKey: ['client-goals', c.id],
    queryFn: async () => {
      const { data } = await supabase.from('client_goals').select('id, goal, status, set_on').eq('client_id', c.id).order('set_on', { ascending: false }).limit(30);
      return (data ?? []) as Goal[];
    },
  });
  const open = goals.filter(g => g.status === 'open');
  const reviewed = goals.filter(g => g.status === 'hit' || g.status === 'missed');
  const hit = reviewed.filter(g => g.status === 'hit').length;

  // What moved since the last quarterly call, from the check-ins.
  const latest = history[0];
  const lastIso = q.lastAt ? q.lastAt.toISOString().slice(0, 10) : null;
  const then = lastIso ? history.find(r => String(r.month).slice(0, 10) <= lastIso) : history[history.length - 1];
  const since = latest && then && latest.month !== then.month ? { then, now: latest } : null;

  const review = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: 'hit' | 'missed' | 'dropped' }) => {
      const { error } = await supabase.from('client_goals').update({ status, reviewed_at: new Date().toISOString() }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['client-goals', c.id] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const prep = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('quarterly-prep', { body: { userId: c.id } });
      if (error || data?.error) throw new Error(data?.error ?? 'Could not build the talking points');
      return data.points as string[];
    },
    onSuccess: setPoints,
    onError: (e: Error) => toast.error(e.message),
  });

  const complete = useMutation({
    mutationFn: async () => {
      const { data: auth } = await supabase.auth.getUser();
      const author = auth.user?.id ?? null;
      const { error } = await supabase.from('client_touchpoints').insert({
        client_id: c.id, kind: 'quarterly_call', source: 'manual', author_id: author,
        occurred_at: callDate === todayInput() ? new Date().toISOString() : new Date(`${callDate}T12:00:00`).toISOString(),
      });
      if (error) throw error;
      const rows = newGoals.map(g => g.trim()).filter(Boolean).map(goal => ({ client_id: c.id, goal, set_on: callDate, author_id: author }));
      if (rows.length) {
        const { error: goalError } = await supabase.from('client_goals').insert(rows);
        if (goalError) throw goalError;
      }
    },
    onSuccess: () => {
      toast.success('Quarterly call logged');
      setNewGoals(['', '', '']);
      setPoints([]);
      qc.invalidateQueries({ queryKey: ['client-touchpoints'] });
      qc.invalidateQueries({ queryKey: ['client-touchpoints', c.id] });
      qc.invalidateQueries({ queryKey: ['client-goals', c.id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const tone = q.state === 'overdue' ? 'border-red-500/40' : q.state === 'soon' ? 'border-yellow-500/40' : 'border-border';

  return (
    <details open={q.state === 'overdue' || q.state === 'soon'} className={`rounded-xl border ${tone} p-4`}>
      <summary className="cursor-pointer select-none flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
          <CalendarCheck className="w-3.5 h-3.5" /> Quarterly call
        </span>
        <span className="text-xs font-semibold text-foreground">
          {describeQuarterly(q)}{open.length > 0 ? ` · ${open.length} open goal${open.length === 1 ? '' : 's'}` : ''}
        </span>
      </summary>

      <div className="mt-4 space-y-4">
        {since && (
          <div>
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">Since {q.lastAt ? `the last call (${formatShortDate(q.lastAt)})` : 'they joined'}</p>
            <p className="text-sm text-foreground">
              Revenue {money(revenueOf(since.then))} → {money(revenueOf(since.now))}
              {revenueOf(since.then) > 0 && ` (${revenueOf(since.now) >= revenueOf(since.then) ? '+' : ''}${Math.round(((revenueOf(since.now) - revenueOf(since.then)) / revenueOf(since.then)) * 100)}%)`}
              {since.then.active_retainers != null && since.now.active_retainers != null && ` · Retainers ${since.then.active_retainers} → ${since.now.active_retainers}`}
            </p>
          </div>
        )}

        <div>
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">
            Last quarter's goals{reviewed.length > 0 ? ` · hit ${hit} of ${reviewed.length} so far` : ''}
          </p>
          {open.length === 0 ? (
            <p className="text-xs text-muted-foreground">No open goals. Set some below at the end of the call.</p>
          ) : (
            <ul className="space-y-2">
              {open.map(g => (
                <li key={g.id} className="rounded-lg border border-border p-2.5">
                  <p className="text-sm text-foreground">{g.goal}</p>
                  <div className="flex items-center justify-between mt-1.5">
                    <span className="text-[10px] text-muted-foreground">Set {formatShortDate(new Date(g.set_on))}</span>
                    <div className="flex gap-1">
                      {([['hit', 'Hit'], ['missed', 'Missed'], ['dropped', 'Dropped']] as const).map(([status, label]) => (
                        <button key={status} disabled={review.isPending} onClick={() => review.mutate({ id: g.id, status })}
                          className="px-2 py-0.5 rounded-md bg-muted text-[11px] font-semibold text-muted-foreground hover:bg-primary/15 hover:text-primary transition disabled:opacity-50">
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <div className="flex items-center justify-between gap-2 mb-1">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Worth raising</p>
            <button onClick={() => prep.mutate()} disabled={prep.isPending}
              className="text-[11px] font-semibold text-primary flex items-center gap-1 disabled:opacity-50">
              <Sparkles className="w-3 h-3" /> {prep.isPending ? 'Thinking…' : points.length ? 'Refresh' : 'Prep me'}
            </button>
          </div>
          {points.length > 0
            ? <ul className="space-y-1">{points.map(p => <li key={p} className="text-sm text-foreground">• {p}</li>)}</ul>
            : <p className="text-xs text-muted-foreground">Three talking points from their numbers, last goals and Context Room.</p>}
        </div>

        <div className="rounded-lg bg-muted/30 border border-border p-3 space-y-2">
          <p className="text-xs font-semibold text-foreground">After the call: set up to 3 new goals</p>
          {newGoals.map((g, i) => (
            <input key={i} value={g} maxLength={300}
              onChange={e => setNewGoals(prev => prev.map((v, j) => (j === i ? e.target.value : v)))}
              placeholder={`Goal ${i + 1}${i === 0 ? ', e.g. Sign 2 new retainers by Feb' : ''}`}
              className="w-full px-3 py-2 bg-input border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground" />
          ))}
          <div className="flex items-center gap-2">
            <input type="date" value={callDate} max={todayInput()} onChange={e => setCallDate(e.target.value)} aria-label="Date of the call"
              className="px-2 py-1.5 bg-input border border-border rounded-lg text-xs text-foreground" />
            <Button type="button" size="sm" disabled={!callDate || complete.isPending} onClick={() => complete.mutate()}>
              {complete.isPending ? 'Saving…' : 'Call done'}
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground">Logs the call and restarts their 90-day clock.</p>
        </div>
      </div>
    </details>
  );
}

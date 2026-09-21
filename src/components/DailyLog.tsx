import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRequireAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { Loader2, Check, CalendarDays } from 'lucide-react';
import type { Row } from '@/lib/db';

/**
 * A few minutes a day, one row per channel.
 *
 * The monthly check-in cannot show which channel is working or whether leads
 * dried up this week — a single number a month hides both. This is the log
 * that makes the Growth Engine answer those.
 */

type LogRow = Row<'daily_log'>;

const CHANNELS = [
  { key: 'paid_ads', label: 'Paid ads' },
  { key: 'organic', label: 'Organic content' },
  { key: 'outbound', label: 'Outbound / DMs' },
  { key: 'referral', label: 'Referral' },
] as const;

type Draft = {
  leads: string;
  spend: string;
  meetings: string;
  clients_won: string;
  value_won: string;
  content_posts: string;
};

const EMPTY: Draft = {
  leads: '', spend: '', meetings: '', clients_won: '', value_won: '', content_posts: '',
};

const num = (v: string) => (v.trim() === '' ? 0 : Number(v) || 0);

function todayISO() {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

export default function DailyLog() {
  const { user } = useRequireAuth();
  const [date, setDate] = useState(todayISO());
  const [drafts, setDrafts] = useState<Record<string, Draft>>(
    Object.fromEntries(CHANNELS.map(c => [c.key, { ...EMPTY }])),
  );
  const [responseMinutes, setResponseMinutes] = useState('');
  const [saving, setSaving] = useState(false);
  const [week, setWeek] = useState<LogRow[]>([]);

  useEffect(() => {
    if (user) loadDay();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, date]);

  const loadDay = async () => {
    if (!user) return;

    // Prefill with whatever was already logged for this date, so a second
    // visit corrects rather than duplicates.
    const { data: dayRows } = await supabase
      .from('daily_log')
      .select('*')
      .eq('user_id', user.id)
      .eq('log_date', date);

    const next = Object.fromEntries(CHANNELS.map(c => [c.key, { ...EMPTY }])) as Record<string, Draft>;
    let responded = '';
    for (const row of dayRows ?? []) {
      if (!next[row.channel]) continue;
      next[row.channel] = {
        leads: String(row.leads || ''),
        spend: String(row.spend || ''),
        meetings: String(row.meetings || ''),
        clients_won: String(row.clients_won || ''),
        value_won: String(row.value_won || ''),
        content_posts: String(row.content_posts || ''),
      };
      if (row.response_minutes != null) responded = String(row.response_minutes);
    }
    setDrafts(next);
    setResponseMinutes(responded);

    const since = new Date(Date.now() - 6 * 86400000).toISOString().slice(0, 10);
    const { data: weekRows } = await supabase
      .from('daily_log')
      .select('*')
      .eq('user_id', user.id)
      .gte('log_date', since)
      .order('log_date', { ascending: false });
    setWeek(weekRows ?? []);
  };

  const set = (channel: string, field: keyof Draft, value: string) =>
    setDrafts(prev => ({ ...prev, [channel]: { ...prev[channel], [field]: value } }));

  const handleSave = async () => {
    if (!user) return;

    const rows = CHANNELS
      .map(c => ({ channel: c.key, draft: drafts[c.key] }))
      .filter(({ draft }) => Object.values(draft).some(v => v.trim() !== ''))
      .map(({ channel, draft }) => ({
        user_id: user.id,
        log_date: date,
        channel,
        leads: num(draft.leads),
        spend: num(draft.spend),
        meetings: num(draft.meetings),
        clients_won: num(draft.clients_won),
        value_won: num(draft.value_won),
        content_posts: num(draft.content_posts),
        response_minutes: responseMinutes.trim() === '' ? null : num(responseMinutes),
        updated_at: new Date().toISOString(),
      }));

    if (rows.length === 0) {
      toast.error('Nothing to log yet — fill in at least one channel');
      return;
    }

    setSaving(true);
    const { error } = await supabase
      .from('daily_log')
      .upsert(rows, { onConflict: 'user_id,log_date,channel' });
    setSaving(false);

    if (error) {
      toast.error('Could not save — try again');
      console.error(error);
      return;
    }
    toast.success(`Logged ${rows.length} channel${rows.length === 1 ? '' : 's'}`);
    loadDay();
  };

  if (!user) return null;

  const weekTotals = week.reduce(
    (acc, r) => ({
      leads: acc.leads + Number(r.leads || 0),
      spend: acc.spend + Number(r.spend || 0),
      won: acc.won + Number(r.clients_won || 0),
      value: acc.value + Number(r.value_won || 0),
    }),
    { leads: 0, spend: 0, won: 0, value: 0 },
  );

  const cell = "w-full px-2 py-1.5 bg-input border border-border rounded-lg text-sm text-foreground text-right placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/40 transition";

  return (
    <div className="mt-8 bg-card border border-border rounded-xl p-5">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-1">
        <div>
          <h3 className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Daily log</h3>
          <p className="text-sm text-muted-foreground max-w-xl">
            A couple of minutes a day. One row per channel is what makes it obvious which one
            is actually working, and whether leads are drying up before it shows in revenue.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <CalendarDays className="w-4 h-4 text-muted-foreground" />
          <input
            type="date"
            value={date}
            max={todayISO()}
            onChange={e => setDate(e.target.value)}
            className="px-3 py-1.5 bg-input border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 transition"
          />
        </div>
      </div>

      <div className="overflow-x-auto mt-4">
        <table className="w-full text-sm min-w-[620px]">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground">
              <th className="pb-2 pr-3 font-semibold">Channel</th>
              <th className="pb-2 px-2 font-semibold text-right">Leads</th>
              <th className="pb-2 px-2 font-semibold text-right">Spend $</th>
              <th className="pb-2 px-2 font-semibold text-right">Meetings</th>
              <th className="pb-2 px-2 font-semibold text-right">Won</th>
              <th className="pb-2 px-2 font-semibold text-right">Value $</th>
              <th className="pb-2 pl-2 font-semibold text-right">Posts</th>
            </tr>
          </thead>
          <tbody>
            {CHANNELS.map(c => (
              <tr key={c.key} className="border-t border-border/60">
                <td className="py-2 pr-3 text-foreground whitespace-nowrap font-medium">{c.label}</td>
                {(['leads', 'spend', 'meetings', 'clients_won', 'value_won', 'content_posts'] as const).map(field => (
                  <td key={field} className="py-2 px-1">
                    <input
                      type="number"
                      inputMode="decimal"
                      placeholder="0"
                      value={drafts[c.key][field]}
                      onChange={e => set(c.key, field, e.target.value)}
                      className={cell}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-end justify-between gap-3 mt-4">
        <div>
          <label className="block text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">
            Speed to lead (mins)
          </label>
          <input
            type="number"
            placeholder="e.g. 20"
            value={responseMinutes}
            onChange={e => setResponseMinutes(e.target.value)}
            className="w-32 px-3 py-1.5 bg-input border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 transition"
          />
          <p className="text-[11px] text-muted-foreground mt-1">
            How long an enquiry waited today. Slow replies lose deals you'd already won.
          </p>
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-primary to-primary/80 text-primary-foreground rounded-lg text-sm font-semibold transition-all disabled:opacity-50"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
          {saving ? 'Saving…' : 'Save day'}
        </button>
      </div>

      {week.length > 0 && (
        <div className="mt-5 pt-4 border-t border-border grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Leads', value: String(weekTotals.leads) },
            { label: 'Spend', value: `$${Math.round(weekTotals.spend).toLocaleString()}` },
            { label: 'Clients won', value: String(weekTotals.won) },
            { label: 'Value won', value: `$${Math.round(weekTotals.value).toLocaleString()}` },
          ].map(stat => (
            <div key={stat.label}>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                {stat.label} · 7 days
              </p>
              <p className="text-lg font-bold text-foreground mt-0.5">{stat.value}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

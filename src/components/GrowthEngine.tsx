import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRequireAuth } from '@/hooks/useAuth';
import { ArrowRight, TrendingDown, TrendingUp, Minus } from 'lucide-react';

/**
 * The chain from effort to money: content posted and money spent on ads, into
 * leads, into clients closed, into revenue — and what each step costs.
 *
 * This is the view Dan works from in his own business. The point is not the
 * individual numbers but the joins between them: what a piece of content is
 * actually worth, what a lead costs, and what a client costs to acquire
 * against what they are worth.
 */

interface MonthRow {
  month: string;
  content_posts: number | null;
  ad_spend: number | null;
  leads_generated: number | null;
  booked_calls: number | null;
  calls_showed: number | null;
  new_clients: number | null;
  new_clients_total_value: number | null;
  total_revenue: number | null;
  mrr: number | null;
  mrr_manual: number | null;
  oneoff_revenue: number | null;
}

type DailyRow = {
  log_date: string;
  channel: string;
  leads: number;
  spend: number;
  meetings: number;
  clients_won: number;
  value_won: number;
  content_posts: number;
  response_minutes: number | null;
};

const money = (n: number) =>
  n >= 1000 ? `$${Math.round(n).toLocaleString()}` : `$${n.toFixed(n < 100 ? 2 : 0)}`;

function revenueOf(row: MonthRow) {
  return Number(row.total_revenue)
    || (Number(row.mrr_manual || row.mrr || 0) + Number(row.oneoff_revenue || 0));
}

/**
 * Leads are judged against the business's own recent history rather than a
 * fixed target. What the right number is depends entirely on stage and price
 * point — someone starting out and someone at $30k a month need completely
 * different volumes. What matters is that leads keep arriving, and that the
 * trend is not falling.
 */
function leadBaseline(rows: MonthRow[]): number | null {
  const history = rows.slice(1).map(r => Number(r.leads_generated || 0)).filter(n => n > 0);
  if (history.length === 0) return null;
  return history.reduce((sum, n) => sum + n, 0) / history.length;
}

type Verdict = 'good' | 'watch' | 'bad' | 'none';

const VERDICT_STYLE: Record<Verdict, string> = {
  good: 'text-green-400',
  watch: 'text-amber-400',
  bad: 'text-orange-400',
  none: 'text-muted-foreground',
};

function Stat({
  label, value, sub, verdict = 'none',
}: { label: string; value: string; sub?: string; verdict?: Verdict }) {
  return (
    <div className="bg-card border border-border rounded-xl p-4 min-w-0">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold truncate">{label}</p>
      <p className={`text-xl font-bold mt-1 ${VERDICT_STYLE[verdict]}`}>{value}</p>
      {sub && <p className="text-[11px] text-muted-foreground mt-1 leading-snug">{sub}</p>}
    </div>
  );
}

function Trend({ current, previous }: { current: number; previous: number | null }) {
  if (previous === null || previous === 0 || current === 0) return null;
  const change = Math.round(((current - previous) / previous) * 100);
  if (Math.abs(change) < 5) {
    return <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground"><Minus className="w-3 h-3" />flat</span>;
  }
  const up = change > 0;
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] ${up ? 'text-green-400' : 'text-orange-400'}`}>
      {up ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
      {Math.abs(change)}%
    </span>
  );
}

export default function GrowthEngine() {
  const { user } = useRequireAuth();
  const [rows, setRows] = useState<MonthRow[]>([]);
  const [daily, setDaily] = useState<DailyRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from('monthly_totals')
        .select('month, content_posts, ad_spend, leads_generated, booked_calls, calls_showed, new_clients, new_clients_total_value, total_revenue, mrr, mrr_manual, oneoff_revenue')
        .eq('user_id', user.id)
        .order('month', { ascending: false })
        .limit(6);
      setRows((data ?? []) as MonthRow[]);

      const since = new Date(Date.now() - 29 * 86400000).toISOString().slice(0, 10);
      const { data: logs } = await supabase
        .from('daily_log')
        .select('log_date, channel, leads, spend, meetings, clients_won, value_won, content_posts, response_minutes')
        .eq('user_id', user.id)
        .gte('log_date', since)
        .order('log_date', { ascending: false });
      setDaily((logs ?? []) as DailyRow[]);

      setLoading(false);
    })();
  }, [user]);

  if (loading || rows.length === 0) return null;

  const latest = rows[0];
  const prior = rows[1] ?? null;

  const content = Number(latest.content_posts || 0);
  const adSpend = Number(latest.ad_spend || 0);
  const leads = Number(latest.leads_generated || 0);
  const clients = Number(latest.new_clients || 0);
  const clientValue = Number(latest.new_clients_total_value || 0);
  const revenue = revenueOf(latest);

  const costPerLead = leads > 0 && adSpend > 0 ? adSpend / leads : null;
  const leadsPerPost = content > 0 && leads > 0 ? leads / content : null;
  const conversion = leads > 0 ? (clients / leads) * 100 : null;
  const cac = clients > 0 ? adSpend / clients : null;
  const valuePerClient = clients > 0 && clientValue > 0 ? clientValue / clients : null;
  const revenuePerPost = content > 0 && revenue > 0 ? revenue / content : null;

  const cacRatio = cac !== null && valuePerClient ? cac / valuePerClient : null;

  const baseline = leadBaseline(rows);
  const leadVerdict: Verdict =
    leads === 0 ? 'bad'
    : baseline === null ? 'none'
    : leads >= baseline * 1.1 ? 'good'
    : leads >= baseline * 0.8 ? 'watch'
    : 'bad';
  const conversionVerdict: Verdict =
    conversion === null ? 'none' : conversion >= 20 ? 'good' : conversion >= 10 ? 'watch' : 'bad';
  const cacVerdict: Verdict =
    cacRatio === null ? 'none' : cacRatio <= 0.25 ? 'good' : cacRatio <= 0.5 ? 'watch' : 'bad';

  // The one sentence worth reading.
  let headline: string;
  if (revenue <= 0) {
    headline = "No revenue logged this month, so start there — everything else is noise until that number moves.";
  } else if (cacRatio !== null && cacRatio <= 0.5) {
    headline = `Each client costs ${money(cac!)} to win and is worth ${money(valuePerClient!)}. That's under half, which means the honest answer is to spend more on ads, not less.`;
  } else if (cacRatio !== null && cacRatio > 1) {
    headline = `Each client costs ${money(cac!)} to win but is only worth ${money(valuePerClient!)}. You're paying more than they bring in — fix that before spending another dollar.`;
  } else if (leads === 0) {
    headline = "No leads logged this month. Everything downstream is capped by what comes in the top, so that's the only thing worth working on.";
  } else if (baseline !== null && leads < baseline * 0.8) {
    headline = `${leads} leads this month against your usual ${Math.round(baseline)}. Leads are falling, and everything downstream follows it three months later.`;
  } else {
    headline = `${leads} leads, ${clients} closed, ${money(revenue)} in. Conversion is the lever worth pulling next.`;
  }

  const monthLabel = new Date(latest.month).toLocaleString('default', { month: 'long', year: 'numeric' });

  // Which channel is actually working — only answerable from the daily log.
  const byChannel = daily.reduce<Record<string, { leads: number; spend: number; won: number; value: number }>>(
    (acc, row) => {
      const bucket = acc[row.channel] ??= { leads: 0, spend: 0, won: 0, value: 0 };
      bucket.leads += Number(row.leads || 0);
      bucket.spend += Number(row.spend || 0);
      bucket.won += Number(row.clients_won || 0);
      bucket.value += Number(row.value_won || 0);
      return acc;
    },
    {},
  );

  const channelRows = Object.entries(byChannel)
    .filter(([, v]) => v.leads > 0 || v.spend > 0)
    .sort((a, b) => b[1].value - a[1].value);

  const responses = daily.map(r => r.response_minutes).filter((n): n is number => n != null);
  const avgResponse = responses.length
    ? Math.round(responses.reduce((sum, n) => sum + n, 0) / responses.length)
    : null;

  const CHANNEL_LABELS: Record<string, string> = {
    paid_ads: 'Paid ads',
    organic: 'Organic content',
    outbound: 'Outbound / DMs',
    referral: 'Referral',
  };

  return (
    <div className="mt-8">
      <div className="mb-4">
        <h3 className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Growth Engine · {monthLabel}</h3>
        <p className="text-sm text-foreground max-w-2xl leading-relaxed">{headline}</p>
      </div>

      {/* The chain */}
      <div className="flex flex-wrap items-center gap-2 mb-4 text-[11px] text-muted-foreground">
        <span className="px-2.5 py-1 rounded-full border border-border">{content} posts</span>
        <span className="px-2.5 py-1 rounded-full border border-border">{money(adSpend)} ads</span>
        <ArrowRight className="w-3.5 h-3.5" />
        <span className="px-2.5 py-1 rounded-full border border-border">{leads} leads</span>
        <ArrowRight className="w-3.5 h-3.5" />
        <span className="px-2.5 py-1 rounded-full border border-border">{clients} closed</span>
        <ArrowRight className="w-3.5 h-3.5" />
        <span className="px-2.5 py-1 rounded-full border border-primary/30 text-primary font-semibold">{money(revenue)}</span>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <Stat
          label="Leads"
          value={String(leads)}
          verdict={leadVerdict}
          sub={baseline !== null
            ? `Your recent average is ${Math.round(baseline)} a month`
            : 'Keep them coming in every week'}
        />
        <Stat
          label="Cost per lead"
          value={costPerLead !== null ? money(costPerLead) : '—'}
          sub={adSpend === 0 ? 'No ad spend logged' : `${money(adSpend)} across ${leads} leads`}
        />
        <Stat
          label="Conversion"
          value={conversion !== null ? `${conversion.toFixed(1)}%` : '—'}
          verdict={conversionVerdict}
          sub={`${clients} of ${leads} leads signed`}
        />
        <Stat
          label="Cost to acquire"
          value={cac !== null ? money(cac) : '—'}
          verdict={cacVerdict}
          sub={valuePerClient
            ? `Client is worth ${money(valuePerClient)} — spend under half of that`
            : 'Log new client value to judge this'}
        />
        <Stat
          label="Leads per post"
          value={leadsPerPost !== null ? leadsPerPost.toFixed(1) : '—'}
          sub={content === 0 ? 'No content logged this month' : `${content} posts published`}
        />
        <Stat
          label="Revenue per post"
          value={revenuePerPost !== null ? money(revenuePerPost) : '—'}
          sub="What one piece of content is worth to you"
        />
      </div>

      {channelRows.length > 0 && (
        <div className="mt-4 bg-card border border-border rounded-xl p-4 overflow-x-auto">
          <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
              By channel · last 30 days
            </p>
            {avgResponse !== null && (
              <p className="text-[11px] text-muted-foreground">
                Average speed to lead: <span className="text-foreground font-semibold">{avgResponse} mins</span>
              </p>
            )}
          </div>
          <table className="w-full text-xs min-w-[460px]">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                {['Channel', 'Leads', 'Spend', 'Won', 'Cost per client', 'Value'].map(h => (
                  <th key={h} className="pb-2 pr-4 font-semibold whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {channelRows.map(([channel, v]) => {
                const channelCac = v.won > 0 && v.spend > 0 ? v.spend / v.won : null;
                return (
                  <tr key={channel} className="border-b border-border/50 last:border-0">
                    <td className="py-2 pr-4 text-foreground whitespace-nowrap font-medium">
                      {CHANNEL_LABELS[channel] ?? channel}
                    </td>
                    <td className="py-2 pr-4 text-foreground">{v.leads}</td>
                    <td className="py-2 pr-4 text-foreground">{money(v.spend)}</td>
                    <td className="py-2 pr-4 text-foreground">{v.won}</td>
                    <td className="py-2 pr-4 text-foreground">{channelCac !== null ? money(channelCac) : '—'}</td>
                    <td className="py-2 pr-4 text-primary font-semibold">{money(v.value)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {rows.length > 1 && (
        <div className="mt-4 bg-card border border-border rounded-xl p-4 overflow-x-auto">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-3">
            Last {rows.length} months
          </p>
          <table className="w-full text-xs min-w-[520px]">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                {['Month', 'Posts', 'Ad spend', 'Leads', 'Closed', 'Revenue'].map(h => (
                  <th key={h} className="pb-2 pr-4 font-semibold whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={row.month} className="border-b border-border/50 last:border-0">
                  <td className="py-2 pr-4 whitespace-nowrap text-muted-foreground">
                    {new Date(row.month).toLocaleString('default', { month: 'short', year: '2-digit' })}
                  </td>
                  <td className="py-2 pr-4 text-foreground">{row.content_posts ?? '—'}</td>
                  <td className="py-2 pr-4 text-foreground">{money(Number(row.ad_spend || 0))}</td>
                  <td className="py-2 pr-4 text-foreground">
                    <span className="inline-flex items-center gap-1.5">
                      {row.leads_generated ?? '—'}
                      {i === 0 && <Trend current={leads} previous={prior ? Number(prior.leads_generated || 0) : null} />}
                    </span>
                  </td>
                  <td className="py-2 pr-4 text-foreground">{row.new_clients ?? '—'}</td>
                  <td className="py-2 text-primary font-semibold">{money(revenueOf(row))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

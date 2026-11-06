import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { HeartPulse, ArrowUpCircle, Trophy, Search, LayoutGrid, Table2, CalendarClock, CheckCircle2, Users, CalendarRange, ChevronDown, Copy, Activity } from 'lucide-react';
import PageLayout from '@/components/PageLayout';
import { supabase } from '@/lib/supabase';
import ClientDetailPanel from '@/components/client-health/ClientDetailPanel';
import ClientCard from '@/components/client-health/ClientCard';
import { initials, revenueLine } from '@/lib/clientDisplay';
import QuickLog from '@/components/client-health/QuickLog';
import HealthChatBox from '@/components/client-health/HealthChatBox';
import WeeklyDigest from '@/components/client-health/WeeklyDigest';
import EngagementPanel from '@/components/client-health/EngagementPanel';
import { useRequireAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import {
  type ClientOverview,
  type ClientWithHealth,
  normalizeTier,
  formatTierLabel,
} from '@/lib/clientHealth';
import {
  GROUP_STYLE, assessClient, describeQuarterly, formatShortDate, formatShortDateTime, groupOf, spreadQuarterly, touchLabel,
  type Group, type DanRead, type MonthInput, type Touchpoint,
} from '@/lib/clientCare';
import { gateHealth, type GateMonth } from '@/lib/gateHealth';
import { ROMAN, gateNumber as gateNum, monthKey, type TaskProgress, type TaskTracking } from '@/lib/growthHub';
import { useGrowthHubContent } from '@/hooks/useGrowthHub';

type View = 'needs' | 'everyone' | 'quarterly' | 'gate' | 'activity';
type SortKey = 'priority' | 'name' | 'revenue';

/** Momentum only ever looks at the last few months, so a date floor (not a row count) is what should bound
 * these queries: a flat `.limit()` across every client drops the oldest rows first as the business grows,
 * and unevenly — whichever clients' months happen to sit near the cutoff lose history, not everyone equally. */
const monthFloor = (monthsBack: number) => {
  const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - monthsBack);
  return d.toISOString().slice(0, 10);
};
const isoMonthsAgo = (monthsBack: number) => {
  const d = new Date(); d.setMonth(d.getMonth() - monthsBack);
  return d.toISOString();
};
/** The buckets that get a card each. The rest are tucked away: nobody needs to look at them. */
const ACTION_BUCKETS: Group[] = ['act', 'reach', 'numbers', 'quarterly'];
const GROUP_ORDER: Group[] = ['act', 'reach', 'numbers', 'quarterly', 'new', 'good'];

const nudgeText = (c: ClientWithHealth) =>
  `Hey ${(c.full_name ?? '').split(' ')[0] || 'mate'}, I haven't seen your monthly numbers in a while. Can you pop them into the portal when you get a minute? It lets me see exactly where to help you most.`;

function BucketPill({ bucket }: { bucket: Group }) {
  const b = GROUP_STYLE[bucket];
  return <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${b.bg} ${b.text}`}>{b.label}</span>;
}

/** The people who need nothing: just names, tucked away, with their money so you can see they're fine. */
function QuietList({ title, hint, clients, onOpen, openByDefault = false }: {
  title: string; hint: string; clients: ClientWithHealth[]; onOpen: (c: ClientWithHealth) => void; openByDefault?: boolean;
}) {
  if (clients.length === 0) return null;
  return (
    <details open={openByDefault} className="group rounded-2xl border border-border bg-card/60 backdrop-blur-sm">
      <summary className="flex cursor-pointer select-none items-center justify-between gap-3 px-4 py-3">
        <span className="text-sm font-semibold text-foreground">{title} <span className="font-normal text-muted-foreground">· {clients.length}</span></span>
        <span className="flex items-center gap-1 text-xs text-muted-foreground">{hint}<ChevronDown className="w-4 h-4 transition group-open:rotate-180" /></span>
      </summary>
      <div className="flex flex-wrap gap-2 px-4 pb-4">
        {clients.map(c => {
          const r = revenueLine(c);
          return (
            <button key={c.id} onClick={() => onOpen(c)}
              className="flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs transition hover:border-primary/40 hover:shadow-sm">
              <span className="font-semibold text-foreground">{c.full_name || 'Unnamed'}</span>
              <span className="text-muted-foreground">{r.text}{r.change !== null && Math.abs(r.change) >= 5 ? ` ${r.change > 0 ? '▲' : '▼'}${Math.abs(r.change)}%` : ''}</span>
            </button>
          );
        })}
      </div>
    </details>
  );
}

const contactText = (c: ClientWithHealth) =>
  c.contact.days === null ? 'None logged' : `${c.contact.days === 0 ? 'Today' : `${c.contact.days}d ago`}${c.contact.kind ? ` · ${touchLabel(c.contact.kind)}` : ''}`;

const quarterlyTone = (c: ClientWithHealth) =>
  c.quarterly.state === 'overdue' ? 'text-destructive font-semibold' : c.quarterly.state === 'soon' ? 'text-amber-600 font-semibold' : 'text-muted-foreground';

export default function ClientHealth() {
  const { user } = useRequireAuth();
  const qc = useQueryClient();
  const [selectedClient, setSelectedClient] = useState<ClientWithHealth | null>(null);

  const { data: selfProfile } = useQuery({
    queryKey: ['self-profile', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('is_admin').eq('id', user!.id).single();
      return data;
    },
  });

  const { data: clients = [], isLoading } = useQuery({
    queryKey: ['admin-client-overview'],
    enabled: !!selfProfile?.is_admin,
    queryFn: async () => {
      const { data, error } = await supabase.from('admin_client_overview').select('*').order('full_name');
      if (error) throw error;
      return data ?? [];
    },
  });

  const changeTier = useMutation({
    mutationFn: async ({ clientId, tier }: { clientId: string; tier: string }) => {
      const nextTier = normalizeTier(tier);
      const { data, error } = await supabase
        .from('profiles')
        .update({ tier: nextTier })
        .eq('id', clientId)
        .select('id, tier');
      if (error) throw error;
      if (!data || data.length === 0) {
        throw new Error('Tier update blocked — no rows updated. Check admin permissions.');
      }
      return nextTier;
    },
    onSuccess: (nextTier) => {
      qc.invalidateQueries({ queryKey: ['admin-client-overview'] });
      setSelectedClient(prev => prev ? { ...prev, tier: nextTier } : prev);
      toast.success(`Tier updated to ${formatTierLabel(nextTier)}`);
    },
    onError: (err: Error) => {
      toast.error(err?.message || 'Failed to update tier');
    },
  });

  // Every check-in per client, newest first. Direction matters more than position: 20k -> 15k -> 10k and a flat 10k
  // look identical on a last-month-only view, and only one needs a call.
  const { data: monthsByUser = {} } = useQuery({
    queryKey: ['client-months'],
    enabled: !!selfProfile?.is_admin,
    queryFn: async () => {
      const { data } = await supabase
        .from('monthly_totals')
        .select('user_id, month, total_revenue, mrr, mrr_manual, oneoff_revenue, business_confidence, nps, retainers_lost, active_retainers, expenses')
        .gte('month', monthFloor(12))
        .order('month', { ascending: false })
        .limit(5000);
      const byUser: Record<string, MonthInput[]> = {};
      for (const row of data ?? []) {
        (byUser[row.user_id] ??= []).push({
          revenue: Number(row.total_revenue) || (Number(row.mrr_manual || row.mrr || 0) + Number(row.oneoff_revenue || 0)),
          confidence: row.business_confidence ?? null,
          nps: row.nps ?? null,
          retainersLost: row.retainers_lost ?? null,
          activeRetainers: row.active_retainers ?? null,
          expenses: row.expenses ?? null,
        });
      }
      return byUser;
    },
  });

  // profiles.gate and join date per member. The join date starts each client's first quarterly-call clock.
  const { data: profileMeta = {} } = useQuery({
    queryKey: ['client-profile-meta'],
    enabled: !!selfProfile?.is_admin,
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('id, gate, created_at');
      const byId: Record<string, { gate: string | null; created_at: string | null }> = {};
      for (const row of data ?? []) byId[row.id] = { gate: row.gate ?? null, created_at: row.created_at ?? null };
      return byId;
    },
  });

  // Every logged contact (WhatsApp, calls, quarterly calls, group calls) and every reply from a client, newest first.
  const { data: touchpoints = {} } = useQuery({
    queryKey: ['client-touchpoints'],
    enabled: !!selfProfile?.is_admin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('client_touchpoints').select('client_id, kind, occurred_at')
        .gte('occurred_at', isoMonthsAgo(24))
        .order('occurred_at', { ascending: false }).limit(10000);
      if (error) throw error;
      const byId: Record<string, Touchpoint[]> = {};
      for (const row of data ?? []) (byId[row.client_id] ??= []).push(row);
      return byId;
    },
  });

  // Dan's own read, how often he wants to touch base, planned quarterly dates, and what each client said they wanted in their Context Room.
  const { data: careRows = {} } = useQuery({
    queryKey: ['client-care'],
    enabled: !!selfProfile?.is_admin,
    queryFn: async () => {
      type CareRow = {
        client_id: string; touch_every_days: number | null; dan_read: string | null; dan_read_note: string | null; quarterly_due_on?: string | null;
        next_contact_at?: string | null; next_contact_kind?: string | null; next_contact_note?: string | null;
      };
      const { data, error } = await supabase.from('client_care')
        .select('client_id, touch_every_days, dan_read, dan_read_note, quarterly_due_on, next_contact_at, next_contact_kind, next_contact_note');
      if (error) throw error;
      return Object.fromEntries(((data ?? []) as CareRow[]).map(r => [r.client_id, r]));
    },
  });
  const { data: cadenceAnswers = {} } = useQuery({
    queryKey: ['client-context-cadence'],
    enabled: !!selfProfile?.is_admin,
    queryFn: async () => {
      const { data } = await supabase.from('context_rooms').select('user_id, cadence:answers->>check_in_cadence' as string);
      return Object.fromEntries(((data ?? []) as unknown as { user_id: string; cadence: string | null }[]).map(r => [r.user_id, r.cadence]));
    },
  });

  // The gate system: every build task, each member's ticks and their gate-bar numbers.
  const { data: content } = useGrowthHubContent();
  const { data: gateData = { progress: {}, months: {}, tracking: {}, newClients: {} } } = useQuery({
    queryKey: ['client-gate-health'],
    enabled: !!selfProfile?.is_admin,
    queryFn: async () => {
      const thisMonth = monthKey();
      const [progress, months, tracking, signed] = await Promise.all([
        supabase.from('member_task_progress').select('*'),
        supabase.from('monthly_totals').select('user_id, month, content_posts, leads_generated, new_clients').gte('month', monthFloor(12)).order('month', { ascending: false }).limit(5000),
        // Live this month, before the check-in: build-list tallies and clients logged as signed.
        supabase.from('member_task_tracking').select('user_id, task_id, period, working, count').eq('period', thisMonth),
        supabase.from('new_clients').select('user_id').gte('signed_date', `${thisMonth}-01`),
      ]);
      const byUser = <T extends { user_id: string }>(rows: T[]) =>
        rows.reduce<Record<string, T[]>>((acc, r) => ((acc[r.user_id] ??= []).push(r), acc), {});
      return {
        progress: byUser((progress.data ?? []) as (TaskProgress & { user_id: string })[]),
        months: byUser((months.data ?? []) as (GateMonth & { user_id: string })[]),
        tracking: byUser((tracking.data ?? []) as (TaskTracking & { user_id: string })[]),
        newClients: (signed.data ?? []).reduce<Record<string, number>>((acc, r) => ((acc[r.user_id] = (acc[r.user_id] ?? 0) + 1), acc), {}),
      };
    },
  });

  const { data: archivedIds = [] } = useQuery({
    queryKey: ['archived-clients'],
    enabled: !!selfProfile?.is_admin,
    queryFn: async () => {
      const { data } = await supabase
        .from('profiles')
        .select('id')
        .not('archived_at', 'is', null);
      return (data ?? []).map(row => row.id);
    },
  });

  const [view, setView] = useState<View>('needs');
  const [focus, setFocus] = useState<Group | null>(null);
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('priority');

  const clientsWithHealth: ClientWithHealth[] = useMemo(() => {
    const now = new Date();
    return clients
      // Dan and Emily are on the same list in the database, but they're not clients.
      .filter((c: ClientOverview) => !c.is_admin && !archivedIds.includes(c.id))
      .map((c: ClientOverview) => {
        const meta = profileMeta[c.id];
        const joinedAt = meta?.created_at ?? null;
        const care = careRows[c.id];
        const months = monthsByUser[c.id] ?? [];
        const a = assessClient({
          joinedAt, months,
          daysSinceCheckin: c.days_since_submission != null ? Number(c.days_since_submission) : null,
          daysSinceLogin: c.days_since_last_login != null ? Number(c.days_since_last_login) : null,
          touchpoints: touchpoints[c.id] ?? [],
          danRead: (care?.dan_read ?? null) as DanRead | null, danReadNote: care?.dan_read_note ?? null,
          touchEveryExplicit: care?.touch_every_days, contextCadence: cadenceAnswers[c.id], quarterlyPlannedOn: care?.quarterly_due_on,
          nextContactAt: care?.next_contact_at, nextContactKind: care?.next_contact_kind, nextContactNote: care?.next_contact_note,
        }, now);

        return {
          ...c,
          momentum: a.momentum, status: a.status, overridden: a.overridden,
          danRead: (care?.dan_read ?? null) as DanRead | null, danReadNote: care?.dan_read_note ?? null,
          contact: a.contact, reply: a.reply, quarterly: a.quarterly, touchEveryDays: a.touchEveryDays, attention: a.attention, joinedAt,
          gh: gateHealth(gateNum(meta?.gate), content?.tasks ?? [], gateData.progress[c.id] ?? [], gateData.months[c.id] ?? [], monthKey(), {
            tracking: gateData.tracking[c.id] ?? [], newClientsThisMonth: gateData.newClients[c.id] ?? 0,
          }),
          monthlyRevenue: months[0]?.revenue ?? Number(c.last_total_revenue || 0),
          revenueSeries: months.map(m => m.revenue),
          gate: meta?.gate ?? null,
        };
      });
  }, [clients, archivedIds, monthsByUser, profileMeta, touchpoints, careRows, cadenceAnswers, content, gateData]);

  const byGroup = useMemo(() => {
    const groups: Record<Group, ClientWithHealth[]> = { act: [], reach: [], numbers: [], quarterly: [], new: [], good: [] };
    for (const c of clientsWithHealth) groups[groupOf(c.attention)].push(c);
    for (const g of GROUP_ORDER) groups[g].sort((x, y) => y.attention.priority - x.attention.priority || (x.full_name ?? '').localeCompare(y.full_name ?? ''));
    return groups;
  }, [clientsWithHealth]);

  const needYou = byGroup.act.length + byGroup.reach.length;
  const total = clientsWithHealth.length;

  const readyToMoveUp = clientsWithHealth.filter(c => c.gh.readyToMoveUp);
  const hitThisMonth = clientsWithHealth.filter(c => c.gh.hitThisMonth && !c.gh.readyToMoveUp);
  const waitingOnDan = clientsWithHealth.filter(c => c.gh.toApprove > 0);
  const gateUpdates = readyToMoveUp.length + hitThisMonth.length + waitingOnDan.length;

  // Everyone's first quarterly call is "none logged", so everyone is overdue at once. Spread them out.
  const needsFirstDate = clientsWithHealth.filter(c => c.quarterly.state === 'unscheduled');
  const spread = useMutation({
    mutationFn: async () => {
      const plan = spreadQuarterly(needsFirstDate.map(c => ({ id: c.id, priority: c.attention.priority, contactDays: c.contact.days })));
      const now = new Date().toISOString();
      const { error } = await supabase.from('client_care').upsert(plan.map(p => ({ client_id: p.id, quarterly_due_on: p.dueOn, updated_at: now })), { onConflict: 'client_id' });
      if (error) throw error;
      return plan.length;
    },
    onSuccess: n => {
      qc.invalidateQueries({ queryKey: ['client-care'] });
      toast.success(`First quarterly calls planned for ${n} clients across the next 90 days`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!selfProfile?.is_admin) {
    return <PageLayout><p className="text-muted-foreground">Admin access required.</p></PageLayout>;
  }

  const open = (c: ClientWithHealth) => setSelectedClient(c);
  const term = search.trim().toLowerCase();
  const everyone = clientsWithHealth
    .filter(c => !term || (c.full_name ?? '').toLowerCase().includes(term))
    .sort((a, b) =>
      sortKey === 'name' ? (a.full_name ?? '').localeCompare(b.full_name ?? '')
      : sortKey === 'revenue' ? b.monthlyRevenue - a.monthlyRevenue
      : b.attention.priority - a.attention.priority || (a.full_name ?? '').localeCompare(b.full_name ?? ''));

  const tab = (v: View, label: string, Icon: typeof Table2) => (
    <button
      key={v}
      onClick={() => setView(v)}
      className={`flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-semibold transition ${
        view === v ? 'bg-primary text-primary-foreground shadow-sm' : 'bg-card/70 border border-border text-muted-foreground hover:text-foreground'
      }`}
    >
      <Icon className="w-3.5 h-3.5" /> {label}
    </button>
  );

  const sectionTitle: Record<string, string> = {
    act: 'Act now', reach: 'Reach out', quarterly: 'Quarterly calls',
  };

  return (
    <PageLayout>
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <HeartPulse className="w-6 h-6 text-primary" /> Client Health
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {total === 0 ? 'No clients yet.' : needYou === 0 && byGroup.numbers.length === 0
              ? `Everyone's in good shape. Nobody needs you right now.`
              : <>
                  <span className="font-semibold text-foreground">{needYou} {needYou === 1 ? 'person needs' : 'people need'} you</span>
                  {byGroup.numbers.length > 0 && <> · {byGroup.numbers.length} owe you their numbers</>}
                  {' '}· {total - needYou - byGroup.numbers.length} {total - needYou - byGroup.numbers.length === 1 ? 'is' : 'are'} fine
                </>}
          </p>
        </div>
        <WeeklyDigest />
      </div>

      {/* Tell the board what you just did, in your own words. */}
      {total > 0 && <div className="mb-6"><HealthChatBox /></div>}

      {/* Where everyone is, at a glance. Tap a segment to look at just that group. */}
      {total > 0 && (
        <div className="mb-6 rounded-2xl border border-border bg-card/70 p-4 shadow-sm backdrop-blur-sm">
          <div className="flex h-2.5 overflow-hidden rounded-full bg-muted" aria-hidden>
            {GROUP_ORDER.map(b => byGroup[b].length > 0 && (
              <div key={b} className={GROUP_STYLE[b].bar} style={{ width: `${(byGroup[b].length / total) * 100}%` }} />
            ))}
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-6">
            {GROUP_ORDER.map(b => {
              const s = GROUP_STYLE[b];
              const active = focus === b;
              return (
                <button
                  key={b}
                  onClick={() => { setFocus(active ? null : b); setView('needs'); }}
                  title={s.hint}
                  className={`rounded-xl border px-3 py-2 text-left transition ${active ? 'border-primary ring-2 ring-primary/30 bg-card' : 'border-transparent hover:bg-card'}`}
                >
                  <div className="flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full ${s.dot}`} />
                    <span className="text-xl font-bold text-foreground leading-none">{byGroup[b].length}</span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{s.label}</p>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {tab('needs', 'Needs you', Users)}
        {tab('everyone', 'Everyone', Table2)}
        {tab('quarterly', 'Quarterly calls', CalendarClock)}
        {tab('gate', 'By gate', LayoutGrid)}
        {tab('activity', 'Activity', Activity)}
      </div>

      {view === 'activity' ? (
        <EngagementPanel />
      ) : isLoading ? (
        <p className="text-sm text-muted-foreground">Loading clients...</p>
      ) : total === 0 ? (
        <p className="text-sm text-muted-foreground">No clients have submitted data yet.</p>
      ) : view === 'needs' ? (
        <div className="space-y-6">
          {/* Everyone starts with no quarterly call logged. One tap plans the first round instead of 20 "overdue" flags. */}
          {needsFirstDate.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-primary/30 bg-primary/5 p-4">
              <div>
                <p className="text-sm font-semibold text-foreground">{needsFirstDate.length} {needsFirstDate.length === 1 ? "client doesn't" : "clients don't"} have a quarterly call planned</p>
                <p className="text-xs text-muted-foreground">Spread their first calls across the next 90 days, the people who most need you first. You can change any date later.</p>
              </div>
              <button
                onClick={() => { if (confirm(`Plan a first quarterly call for ${needsFirstDate.length} clients, spread across the next 90 days with the people who most need you first?`)) spread.mutate(); }}
                disabled={spread.isPending}
                className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
              >
                <CalendarRange className="h-3.5 w-3.5" /> {spread.isPending ? 'Planning…' : 'Plan them'}
              </button>
            </div>
          )}

          {needYou === 0 && byGroup.numbers.length === 0 && byGroup.quarterly.length === 0 && (
            <div className="rounded-2xl border border-green-500/30 bg-green-500/10 p-6 text-center">
              <p className="font-semibold text-success">All clear</p>
              <p className="mt-1 text-sm text-muted-foreground">Everyone has been spoken to recently and their numbers look fine.</p>
            </div>
          )}

          {ACTION_BUCKETS.filter(g => !focus || focus === g).map(g => {
            const list = byGroup[g];
            if (list.length === 0) return null;
            const st = GROUP_STYLE[g];
            return (
              <section key={g}>
                <div className="mb-2 flex items-baseline gap-2">
                  <span className={`w-2 h-2 rounded-full ${st.dot}`} />
                  <h2 className="text-sm font-bold text-foreground">{st.label}</h2>
                  <span className="text-xs text-muted-foreground">{list.length} · {st.hint.toLowerCase()}</span>
                </div>
                {g === 'numbers' ? (
                  <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card/80 shadow-sm backdrop-blur-sm">
                    {list.map(c => (
                      <div key={c.id} className="flex items-center gap-3 px-4 py-2.5">
                        <button onClick={() => open(c)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                          <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${st.bg} ${st.text} text-[11px] font-bold`}>{initials(c.full_name)}</span>
                          <span className="truncate text-sm font-semibold text-foreground">{c.full_name || 'Unnamed'}</span>
                          <span className="shrink-0 text-xs text-muted-foreground">
                            {c.days_since_submission == null ? 'No numbers yet' : `No numbers for ${c.days_since_submission}d`}
                          </span>
                        </button>
                        <button
                          onClick={async () => { try { await navigator.clipboard.writeText(nudgeText(c)); toast.success(`Reminder for ${(c.full_name ?? '').split(' ')[0]} copied. Paste it into WhatsApp`); } catch { toast.error('Could not copy'); } }}
                          className="flex shrink-0 items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs font-semibold text-muted-foreground transition hover:border-primary/40 hover:text-primary"
                        >
                          <Copy className="h-3.5 w-3.5" /> Copy nudge
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {list.map(c => <ClientCard key={c.id} client={c} onOpen={() => open(c)} />)}
                  </div>
                )}
              </section>
            );
          })}

          <div className="space-y-2">
            <QuietList title="Settling in" hint="Joined in the last 45 days" clients={byGroup.new} onOpen={open} openByDefault={focus === 'new'} />
            <QuietList title="Doing well" hint="Nothing needed. Hidden to keep things calm" clients={byGroup.good} onOpen={open} openByDefault={focus === 'good'} />
          </div>

          {/* Gate progress, tucked away until there's something to act on */}
          {gateUpdates > 0 && (
            <details className="group rounded-2xl border border-border bg-card/60 backdrop-blur-sm">
              <summary className="flex cursor-pointer select-none items-center justify-between gap-3 px-4 py-3">
                <span className="text-sm font-semibold text-foreground">Gate updates <span className="font-normal text-muted-foreground">· {gateUpdates}</span></span>
                <span className="flex items-center gap-1 text-xs text-muted-foreground">Approvals and move-ups<ChevronDown className="w-4 h-4 transition group-open:rotate-180" /></span>
              </summary>
              <div className="space-y-4 px-4 pb-4">
                {waitingOnDan.length > 0 && (
                  <div>
                    <p className="mb-2 flex items-center gap-1.5 text-xs font-bold text-orange-600"><CheckCircle2 className="w-4 h-4" /> Waiting on your approval ({waitingOnDan.reduce((n, c) => n + c.gh.toApprove, 0)})</p>
                    <div className="flex flex-wrap gap-2">
                      {waitingOnDan.map(c => (
                        <button key={c.id} onClick={() => open(c)} className="rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold hover:border-primary/40 transition">
                          {c.full_name} · {c.gh.toApprove}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {readyToMoveUp.length > 0 && (
                  <div>
                    <p className="mb-2 flex items-center gap-1.5 text-xs font-bold text-primary"><ArrowUpCircle className="w-4 h-4" /> Ready to move up a gate</p>
                    <div className="space-y-2">
                      {readyToMoveUp.map(c => (
                        <button key={c.id} onClick={() => open(c)} className="flex w-full items-center justify-between gap-3 rounded-xl border border-border bg-card px-3 py-2 text-left transition hover:border-primary/40">
                          <span className="text-sm font-semibold text-foreground">{c.full_name}</span>
                          <span className="text-xs text-muted-foreground">
                            Gate {ROMAN[c.gh.gate!]} → {ROMAN[c.gh.gate! + 1]} ·{' '}
                            <span className={c.gh.buildApproved ? 'font-semibold text-primary' : 'font-semibold text-orange-600'}>
                              {c.gh.buildApproved ? 'build list approved' : `build list ${c.gh.build.approved}/${c.gh.build.total}`}
                            </span>
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {hitThisMonth.length > 0 && (
                  <div>
                    <p className="mb-2 flex items-center gap-1.5 text-xs font-bold text-emerald-700"><Trophy className="w-4 h-4" /> Hit their gate goals this month ({hitThisMonth.length})</p>
                    <div className="flex flex-wrap gap-2">
                      {hitThisMonth.map(c => (
                        <button key={c.id} onClick={() => open(c)} className="rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold hover:border-primary/40 transition">
                          {c.full_name} · Gate {ROMAN[c.gh.gate!]}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </details>
          )}
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-card/80 shadow-sm backdrop-blur-sm">
          {view !== 'gate' && (
            <div className="flex flex-wrap items-center gap-3 border-b border-border p-3">
              <div className="relative min-w-[200px] flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search clients"
                  className="w-full rounded-lg border border-border bg-input py-2 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>
              {view === 'everyone' && (
                <select value={sortKey} onChange={e => setSortKey(e.target.value as SortKey)} aria-label="Sort clients"
                  className="rounded-lg border border-border bg-input px-3 py-2 text-xs text-foreground">
                  <option value="priority">Sort: who to contact first</option>
                  <option value="name">Sort: name</option>
                  <option value="revenue">Sort: revenue</option>
                </select>
              )}
              {view === 'quarterly' && needsFirstDate.length > 0 && (
                <button
                  onClick={() => { if (confirm(`Plan a first quarterly call for ${needsFirstDate.length} clients, spread across the next 90 days with the people who most need you first? You can change any date later.`)) spread.mutate(); }}
                  disabled={spread.isPending}
                  className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
                >
                  <CalendarRange className="h-3.5 w-3.5" /> {spread.isPending ? 'Planning…' : `Spread ${needsFirstDate.length} first ${needsFirstDate.length === 1 ? 'call' : 'calls'} over 90 days`}
                </button>
              )}
            </div>
          )}

          {view === 'gate' ? (
            <div className="grid gap-4 p-4 md:grid-cols-2 xl:grid-cols-4">
              {([
                { gate: 1, name: 'Fix' },
                { gate: 2, name: 'Fuel' },
                { gate: 3, name: 'Scale' },
                { gate: 4, name: 'Supercharge' },
              ]).map(({ gate, name }) => {
                const members = clientsWithHealth.filter(c => (gateNum(c.gate) ?? 1) === gate);
                return (
                  <div key={gate} className="rounded-xl border border-border bg-muted/20 p-4">
                    <h3 className="mb-3 text-sm font-bold text-foreground">
                      Gate {gate} · {name}
                      <span className="ml-2 text-xs font-normal text-muted-foreground">{members.length}</span>
                    </h3>
                    <div className="space-y-2">
                      {members.length === 0 && <p className="text-xs text-muted-foreground">No one here.</p>}
                      {members.map(c => (
                        <button key={c.id} onClick={() => open(c)} className="w-full rounded-lg border border-border bg-card p-3 text-left transition hover:border-primary/40">
                          <div className="flex items-center justify-between gap-2">
                            <span className="truncate text-sm font-semibold text-foreground">{c.full_name || 'Unnamed'}</span>
                            <BucketPill bucket={groupOf(c.attention)} />
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : view === 'quarterly' ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                    <th className="px-4 py-2.5 font-semibold">Client</th>
                    <th className="px-3 py-2.5 font-semibold">Last quarterly call</th>
                    <th className="px-3 py-2.5 font-semibold">Next due</th>
                    <th className="px-3 py-2.5 font-semibold">Status</th>
                    <th className="px-4 py-2.5 text-right font-semibold">Log</th>
                  </tr>
                </thead>
                <tbody>
                  {clientsWithHealth
                    .filter(c => !term || (c.full_name ?? '').toLowerCase().includes(term))
                    .sort((a, b) => (a.quarterly.daysUntil ?? 9999) - (b.quarterly.daysUntil ?? 9999))
                    .map(c => (
                      <tr key={c.id} onClick={() => open(c)} className="cursor-pointer border-b border-border/60 transition-colors last:border-0 hover:bg-muted/40">
                        <td className="px-4 py-3 font-semibold text-foreground">{c.full_name || 'Unnamed Client'}</td>
                        <td className="whitespace-nowrap px-3 py-3 text-muted-foreground">{c.quarterly.lastAt ? formatShortDate(c.quarterly.lastAt) : 'None logged'}</td>
                        <td className="whitespace-nowrap px-3 py-3 text-muted-foreground">{formatShortDate(c.quarterly.dueAt)}{c.quarterly.planned ? ' · planned' : ''}</td>
                        <td className={`whitespace-nowrap px-3 py-3 ${quarterlyTone(c)}`}>{describeQuarterly(c.quarterly)}</td>
                        <td className="px-4 py-3"><div className="flex justify-end"><QuickLog clientId={c.id} clientName={c.full_name} /></div></td>
                      </tr>
                    ))}
                </tbody>
              </table>
              <p className="border-t border-border px-4 py-3 text-[11px] text-muted-foreground">
                A quarterly call is due 90 days after the last one. Tap the calendar icon on a row once the call is done. Open a client to plan a date, prep and set goals.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                    <th className="px-4 py-2.5 font-semibold">Client</th>
                    <th className="px-3 py-2.5 font-semibold">Where they're at</th>
                    <th className="px-3 py-2.5 font-semibold">Last spoke</th>
                    <th className="px-3 py-2.5 font-semibold">They replied</th>
                    <th className="px-3 py-2.5 font-semibold">Numbers in</th>
                    <th className="px-3 py-2.5 font-semibold">Quarterly</th>
                    <th className="px-3 py-2.5 font-semibold">Revenue</th>
                    <th className="px-4 py-2.5 text-right font-semibold">Log</th>
                  </tr>
                </thead>
                <tbody>
                  {everyone.map(c => {
                    const b = GROUP_STYLE[groupOf(c.attention)];
                    const r = revenueLine(c);
                    const checkin = c.days_since_submission != null ? Number(c.days_since_submission) : null;
                    return (
                      <tr key={c.id} onClick={() => open(c)} className="cursor-pointer border-b border-border/60 align-top transition-colors last:border-0 hover:bg-muted/40">
                        <td className="px-4 py-3">
                          <div className="flex min-w-0 items-center gap-2.5">
                            <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${b.bg} ${b.text} text-[11px] font-bold`}>{initials(c.full_name)}</span>
                            <span className="truncate font-semibold text-foreground">{c.full_name || 'Unnamed Client'}</span>
                          </div>
                        </td>
                        <td className="px-3 py-3">
                          <BucketPill bucket={groupOf(c.attention)} />
                          {c.attention.reasons.length > 0 && <p className="mt-0.5 max-w-[200px] truncate text-[10px] text-muted-foreground">{c.attention.reasons.join(' · ')}</p>}
                          {c.attention.nextContact && (
                            <p className="mt-0.5 text-[10px] font-semibold text-primary">Booked {formatShortDateTime(c.attention.nextContact.at)}</p>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 text-muted-foreground">{contactText(c)}</td>
                        <td className="whitespace-nowrap px-3 py-3 text-muted-foreground">{c.reply.days === null ? '—' : c.reply.days === 0 ? 'Today' : `${c.reply.days}d ago`}</td>
                        <td className={`whitespace-nowrap px-3 py-3 ${c.status !== 'new' && (checkin === null || checkin > 45) ? 'font-semibold text-orange-600' : 'text-muted-foreground'}`}>
                          {checkin === null ? (c.status === 'new' ? '—' : 'Never') : checkin === 0 ? 'Today' : `${checkin}d ago`}
                        </td>
                        <td className={`whitespace-nowrap px-3 py-3 ${quarterlyTone(c)}`}>{describeQuarterly(c.quarterly)}</td>
                        <td className="whitespace-nowrap px-3 py-3">
                          <span className="text-foreground">{r.text}</span>
                          {r.change !== null && (Math.abs(r.change) < 5
                            ? <span className="ml-1.5 text-xs text-muted-foreground">flat</span>
                            : <span className={`ml-1.5 text-xs ${r.change > 0 ? 'text-success' : 'text-orange-600'}`}>{r.change > 0 ? '▲' : '▼'} {Math.abs(r.change)}%</span>)}
                        </td>
                        <td className="px-4 py-3"><div className="flex justify-end"><QuickLog clientId={c.id} clientName={c.full_name} /></div></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {everyone.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">No clients match that.</p>}
            </div>
          )}
        </div>
      )}

      {/* SLIDE-OVER PANEL */}
      {selectedClient && (
        <ClientDetailPanel
          key={selectedClient.id}
          client={clientsWithHealth.find(x => x.id === selectedClient.id) || selectedClient}
          onClose={() => setSelectedClient(null)}
          changeTier={changeTier}
        />
      )}
    </PageLayout>
  );
}

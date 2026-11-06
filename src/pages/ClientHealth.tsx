import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { HeartPulse, ArrowUpCircle, Trophy, Search, LayoutGrid, Table2, CalendarClock, CheckCircle2, Phone } from 'lucide-react';
import PageLayout from '@/components/PageLayout';
import { supabase } from '@/lib/supabase';
import ClientDetailPanel from '@/components/client-health/ClientDetailPanel';
import QuickLog from '@/components/client-health/QuickLog';
import WeeklyDigest from '@/components/client-health/WeeklyDigest';
import { useRequireAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import {
  type ClientOverview,
  type ClientWithHealth,
  normalizeTier,
  formatTierLabel,
} from '@/lib/clientHealth';
import {
  STATUS_STYLE, attention, computeMomentum, daysBetween, describeQuarterly, effectiveStatus, formatShortDate,
  lastContact, quarterly, touchEveryDays, touchLabel, type DanRead, type Touchpoint,
} from '@/lib/clientCare';
import { gateHealth, type GateMonth } from '@/lib/gateHealth';
import { ROMAN, gateNumber as gateNum, monthKey, type TaskProgress, type TaskTracking } from '@/lib/growthHub';
import { useGrowthHubContent } from '@/hooks/useGrowthHub';

type Filter = 'all' | 'reach' | 'quarterly' | 'watch' | 'new' | 'good';
type SortKey = 'priority' | 'name' | 'revenue';

function StatusBadge({ client }: { client: ClientWithHealth }) {
  const s = STATUS_STYLE[client.status];
  return (
    <span
      title={client.overridden ? `Your read${client.danReadNote ? `: ${client.danReadNote}` : ''}` : client.momentum.reasons.join(' · ') || undefined}
      className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${s.bg} ${s.text}`}
    >
      {s.label}{client.overridden ? ' ★' : ''}
    </span>
  );
}

function Reasons({ reasons }: { reasons: string[] }) {
  if (!reasons.length) return null;
  return (
    <div className="flex flex-wrap gap-1 mt-1">
      {reasons.map(r => (
        <span key={r} className="px-1.5 py-0.5 rounded bg-muted text-[10px] font-semibold text-muted-foreground">{r}</span>
      ))}
    </div>
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

  // Direction matters more than position: 20k -> 15k -> 10k and a flat 10k
  // look identical on a last-month-only view, and only one needs a call.
  const { data: revenueTrends = { revenue: {}, confidence: {}, lost: {}, retainers: {}, expenses: {} } } = useQuery({
    queryKey: ['client-revenue-trends'],
    queryFn: async () => {
      const { data } = await supabase
        .from('monthly_totals')
        .select('user_id, month, total_revenue, mrr, mrr_manual, oneoff_revenue, business_confidence, retainers_lost, active_retainers, expenses')
        .order('month', { ascending: false })
        .limit(600);

      const revenue: Record<string, number[]> = {};
      const confidence: Record<string, (number | null)[]> = {};
      const lost: Record<string, (number | null)[]> = {};
      const retainers: Record<string, (number | null)[]> = {};
      const expenses: Record<string, (number | null)[]> = {};
      for (const row of data ?? []) {
        const total = Number(row.total_revenue)
          || (Number(row.mrr_manual || row.mrr || 0) + Number(row.oneoff_revenue || 0));
        (revenue[row.user_id] ??= []).push(total);
        (confidence[row.user_id] ??= []).push(row.business_confidence ?? null);
        (lost[row.user_id] ??= []).push(row.retainers_lost ?? null);
        (retainers[row.user_id] ??= []).push(row.active_retainers ?? null);
        (expenses[row.user_id] ??= []).push(row.expenses ?? null);
      }
      return { revenue, confidence, lost, retainers, expenses };
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

  // Every logged contact (WhatsApp, calls, quarterly calls, group calls), newest first.
  const { data: touchpoints = {} } = useQuery({
    queryKey: ['client-touchpoints'],
    enabled: !!selfProfile?.is_admin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('client_touchpoints').select('client_id, kind, occurred_at').order('occurred_at', { ascending: false }).limit(5000);
      if (error) throw error;
      const byId: Record<string, Touchpoint[]> = {};
      for (const row of data ?? []) (byId[row.client_id] ??= []).push(row);
      return byId;
    },
  });

  // Dan's own read, how often he wants to touch base, and what each client said they wanted in their Context Room.
  const { data: careRows = {} } = useQuery({
    queryKey: ['client-care'],
    enabled: !!selfProfile?.is_admin,
    queryFn: async () => {
      const { data } = await supabase.from('client_care').select('client_id, touch_every_days, dan_read, dan_read_note');
      return Object.fromEntries((data ?? []).map(r => [r.client_id, r]));
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
        supabase.from('monthly_totals').select('user_id, month, content_posts, leads_generated, new_clients').order('month', { ascending: false }).limit(1000),
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
    queryFn: async () => {
      const { data } = await supabase
        .from('profiles')
        .select('id')
        .not('archived_at', 'is', null);
      return (data ?? []).map(row => row.id);
    },
  });

  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [sortKey, setSortKey] = useState<SortKey>('priority');
  const [viewMode, setViewMode] = useState<'table' | 'quarterly' | 'board'>('table');

  const clientsWithHealth: ClientWithHealth[] = useMemo(() => {
    const now = new Date();
    return clients
      .filter((c: ClientOverview) => !archivedIds.includes(c.id))
      .map((c: ClientOverview) => {
        const meta = profileMeta[c.id];
        const joinedAt = meta?.created_at ?? null;
        const touches = touchpoints[c.id] ?? [];
        const care = careRows[c.id];
        const danRead = (care?.dan_read ?? null) as DanRead | null;
        const revenueSeries = revenueTrends.revenue?.[c.id] ?? [];

        const momentum = computeMomentum({
          revenueSeries,
          confidenceSeries: revenueTrends.confidence?.[c.id] ?? [],
          retainersLostSeries: revenueTrends.lost?.[c.id],
          activeRetainersSeries: revenueTrends.retainers?.[c.id],
          expensesSeries: revenueTrends.expenses?.[c.id],
          daysSinceCheckin: c.days_since_submission != null ? Number(c.days_since_submission) : null,
          daysSinceJoined: joinedAt ? daysBetween(new Date(joinedAt), now) : null,
        });
        const { status, overridden } = effectiveStatus(momentum, danRead);
        const contact = lastContact(touches, now);
        const q = quarterly(touches, joinedAt, now);
        const every = touchEveryDays(care?.touch_every_days, cadenceAnswers[c.id]);

        return {
          ...c,
          momentum, status, overridden, danRead, danReadNote: care?.dan_read_note ?? null,
          contact, quarterly: q, touchEveryDays: every, joinedAt,
          attention: attention({ status, contact, quarterly: q, touchEveryDays: every, isNew: momentum.status === 'new' }),
          gh: gateHealth(gateNum(meta?.gate), content?.tasks ?? [], gateData.progress[c.id] ?? [], gateData.months[c.id] ?? [], monthKey(), {
            tracking: gateData.tracking[c.id] ?? [], newClientsThisMonth: gateData.newClients[c.id] ?? 0,
          }),
          monthlyRevenue: Number(c.last_total_revenue || 0),
          revenueSeries,
          gate: meta?.gate ?? null,
        };
      });
  }, [clients, archivedIds, revenueTrends, profileMeta, touchpoints, careRows, cadenceAnswers, content, gateData]);

  const counts = useMemo(() => ({
    reach: clientsWithHealth.filter(c => c.attention.priority > 0).length,
    quarterly: clientsWithHealth.filter(c => c.quarterly.state === 'overdue' || c.quarterly.state === 'soon').length,
    watch: clientsWithHealth.filter(c => c.status === 'watch' || c.status === 'needs_help').length,
    new: clientsWithHealth.filter(c => c.status === 'new').length,
    good: clientsWithHealth.filter(c => c.status === 'rolling' || c.status === 'steady').length,
  }), [clientsWithHealth]);

  const talkNext = useMemo(
    () => clientsWithHealth.filter(c => c.attention.priority > 0).sort((a, b) => b.attention.priority - a.attention.priority).slice(0, 8),
    [clientsWithHealth],
  );
  const readyToMoveUp = clientsWithHealth.filter(c => c.gh.readyToMoveUp);
  const hitThisMonth = clientsWithHealth.filter(c => c.gh.hitThisMonth && !c.gh.readyToMoveUp);
  const waitingOnDan = clientsWithHealth.filter(c => c.gh.toApprove > 0);

  if (!selfProfile?.is_admin) {
    return <PageLayout><p className="text-muted-foreground">Admin access required.</p></PageLayout>;
  }

  const tiles: { key: Exclude<Filter, 'all'>; label: string; hint: string; tone: string }[] = [
    { key: 'reach',     label: 'Reach out',     hint: 'Someone should message or call',  tone: 'bg-orange-500/10 border-orange-500/30 text-orange-600' },
    { key: 'quarterly', label: 'Quarterly due', hint: 'Overdue or due in 14 days',       tone: 'bg-purple-500/10 border-purple-500/30 text-primary' },
    { key: 'watch',     label: 'Watch',         hint: 'Numbers need a look',             tone: 'bg-red-500/10 border-red-500/30 text-destructive' },
    { key: 'new',       label: 'New',           hint: 'Joined in the last 45 days',      tone: 'bg-blue-500/10 border-blue-500/30 text-blue-600' },
    { key: 'good',      label: 'Rolling',       hint: 'Numbers moving the right way',    tone: 'bg-green-500/10 border-green-500/30 text-success' },
  ];

  const term = search.trim().toLowerCase();
  const visible = clientsWithHealth
    .filter(c => {
      if (term && !(c.full_name ?? '').toLowerCase().includes(term)) return false;
      switch (filter) {
        case 'reach': return c.attention.priority > 0;
        case 'quarterly': return c.quarterly.state === 'overdue' || c.quarterly.state === 'soon';
        case 'watch': return c.status === 'watch' || c.status === 'needs_help';
        case 'new': return c.status === 'new';
        case 'good': return c.status === 'rolling' || c.status === 'steady';
        default: return true;
      }
    })
    .sort((a, b) =>
      sortKey === 'name' ? (a.full_name ?? '').localeCompare(b.full_name ?? '')
      : sortKey === 'revenue' ? b.monthlyRevenue - a.monthlyRevenue
      : b.attention.priority - a.attention.priority || (a.full_name ?? '').localeCompare(b.full_name ?? ''));

  const modeBtn = (mode: typeof viewMode, label: string, Icon: typeof Table2) => (
    <button
      key={mode}
      onClick={() => setViewMode(mode)}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
        viewMode === mode ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/70'
      }`}
    >
      <Icon className="w-3.5 h-3.5" /> {label}
    </button>
  );

  return (
    <PageLayout>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <HeartPulse className="w-6 h-6 text-primary" /> Client Health
          </h1>
          <p className="text-sm text-muted-foreground">Who needs a message or a call, who's due their quarterly catch-up, and whose numbers need a look. Click a client for their summary and notes.</p>
        </div>
        <WeeklyDigest />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        {tiles.map(({ key, label, hint, tone }) => {
          const active = filter === key;
          return (
            <button
              key={key}
              onClick={() => setFilter(active ? 'all' : key)}
              title={hint}
              className={`${tone} border ${active ? 'ring-2 ring-primary/40 border-primary' : ''} rounded-xl p-4 text-center`}
            >
              <p className="text-3xl font-bold">{counts[key]}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
            </button>
          );
        })}
      </div>

      {/* The to-do list: the people to talk to next, most pressing first */}
      {talkNext.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-4 mb-4">
          <div className="flex items-center gap-2 mb-1">
            <Phone className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-bold text-foreground">Talk to next</h2>
          </div>
          <p className="text-xs text-muted-foreground mb-3">
            After you've spoken to someone, tap how, and they drop off until they're due again.
          </p>
          <div className="divide-y divide-border">
            {talkNext.map(client => (
              <div key={client.id} className="flex items-center justify-between gap-3 py-2.5">
                <button onClick={() => setSelectedClient(client)} className="text-left min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-foreground truncate">{client.full_name || 'Unnamed'}</span>
                    <StatusBadge client={client} />
                  </div>
                  <Reasons reasons={client.attention.reasons} />
                </button>
                <QuickLog clientId={client.id} />
              </div>
            ))}
          </div>
          {counts.reach > talkNext.length && (
            <button onClick={() => { setFilter('reach'); setViewMode('table'); }} className="mt-2 text-xs text-primary hover:underline">
              See all {counts.reach}
            </button>
          )}
        </div>
      )}

      {/* Ready to move up a gate: every gate goal hit 2 months running (check-ins, or last month's check-in + this month live) */}
      {readyToMoveUp.length > 0 && (
        <div className="bg-purple-500/10 border border-purple-500/30 rounded-xl p-4 mb-4">
          <div className="flex items-center gap-2 mb-2">
            <ArrowUpCircle className="w-5 h-5 text-primary" />
            <h2 className="text-sm font-bold text-primary">Ready to move up a gate</h2>
          </div>
          <p className="text-xs text-muted-foreground mb-3">
            Hit every gate goal 2 months running. Check their build list, then move them up in their profile.
          </p>
          <div className="space-y-2">
            {readyToMoveUp.map(client => (
              <button
                key={client.id}
                onClick={() => setSelectedClient(client)}
                className="w-full flex items-center justify-between bg-card/50 rounded-lg p-3 border border-border hover:bg-card transition text-left"
              >
                <span className="text-sm font-semibold text-foreground">{client.full_name}</span>
                <span className="text-xs text-muted-foreground">
                  Gate {ROMAN[client.gh.gate!]} → {ROMAN[client.gh.gate! + 1]} · {client.gh.goals.map(g => `${g.label} ${g.live}/${g.target}`).join(' · ')} ·{' '}
                  <span className={client.gh.buildApproved ? 'text-primary font-semibold' : 'text-orange-600 font-semibold'}>
                    {client.gh.buildApproved ? 'build list approved' : `build list ${client.gh.build.approved}/${client.gh.build.total} approved`}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Hit every gate goal this month, live from check-ins, build-list tallies and logged clients */}
      {hitThisMonth.length > 0 && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4 mb-4">
          <div className="flex items-center gap-2 mb-2">
            <Trophy className="w-5 h-5 text-emerald-600" />
            <h2 className="text-sm font-bold text-emerald-700">Hit their gate goals this month ({hitThisMonth.length})</h2>
          </div>
          <p className="text-xs text-muted-foreground mb-3">
            Every goal for their gate is at target this month. Hold it next month and they show up above, ready to move up.
          </p>
          <div className="space-y-2">
            {hitThisMonth.map(client => (
              <button
                key={client.id}
                onClick={() => setSelectedClient(client)}
                className="w-full flex items-center justify-between bg-card/50 rounded-lg p-3 border border-border hover:bg-card transition text-left"
              >
                <span className="text-sm font-semibold text-foreground">{client.full_name}</span>
                <span className="text-xs text-muted-foreground">
                  Gate {ROMAN[client.gh.gate!]} · {client.gh.goals.map(g => `${g.label} ${g.live}/${g.target}`).join(' · ')}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Ticks waiting on Dan's approval (proof comes in on WhatsApp) */}
      {waitingOnDan.length > 0 && (
        <div className="bg-orange-500/10 border border-orange-500/30 rounded-xl p-4 mb-6">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle2 className="w-5 h-5 text-orange-600" />
            <h2 className="text-sm font-bold text-orange-600">
              Waiting on your approval ({waitingOnDan.reduce((n, c) => n + c.gh.toApprove, 0)})
            </h2>
          </div>
          <p className="text-xs text-muted-foreground mb-3">
            They've ticked these off and sent proof on WhatsApp. Approve or send back in their Growth Hub.
          </p>
          <div className="flex flex-wrap gap-2">
            {waitingOnDan.map(client => (
              <button
                key={client.id}
                onClick={() => setSelectedClient(client)}
                className="px-3 py-1.5 rounded-lg bg-card/60 border border-border text-xs font-semibold hover:bg-card transition"
              >
                {client.full_name} · {client.gh.toApprove}
              </button>
            ))}
          </div>
        </div>
      )}

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading clients...</p>
      ) : clientsWithHealth.length === 0 ? (
        <p className="text-sm text-muted-foreground">No clients have submitted data yet.</p>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2 mb-4">
            {modeBtn('table', 'Clients', Table2)}
            {modeBtn('quarterly', 'Quarterly calls', CalendarClock)}
            {modeBtn('board', 'By gate', LayoutGrid)}
          </div>

          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="flex flex-wrap items-center gap-3 p-3 border-b border-border">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search clients"
                  className="w-full pl-9 pr-3 py-2 bg-input border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>
              {viewMode === 'table' && (
                <select
                  value={sortKey}
                  onChange={e => setSortKey(e.target.value as SortKey)}
                  aria-label="Sort clients"
                  className="px-3 py-2 bg-input border border-border rounded-lg text-xs text-foreground"
                >
                  <option value="priority">Sort: who to contact first</option>
                  <option value="name">Sort: name</option>
                  <option value="revenue">Sort: revenue</option>
                </select>
              )}
              <span className="text-xs text-muted-foreground">
                {visible.length} of {clientsWithHealth.length}
                {filter !== 'all' && (
                  <button onClick={() => setFilter('all')} className="ml-2 text-primary hover:underline">
                    clear filter
                  </button>
                )}
              </span>
            </div>

            {viewMode === 'board' ? (
              <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-4 p-4">
                {([
                  { gate: 1, name: 'Fix' },
                  { gate: 2, name: 'Fuel' },
                  { gate: 3, name: 'Scale' },
                  { gate: 4, name: 'Supercharge' },
                ]).map(({ gate, name }) => {
                  const members = visible.filter(c => (gateNum(c.gate) ?? 1) === gate);
                  return (
                    <div key={gate} className="bg-muted/20 border border-border rounded-xl p-4">
                      <h3 className="text-sm font-bold text-foreground mb-3">
                        Gate {gate} · {name}
                        <span className="ml-2 text-xs font-normal text-muted-foreground">{members.length}</span>
                      </h3>
                      <div className="space-y-2">
                        {members.length === 0 && <p className="text-xs text-muted-foreground">No one here.</p>}
                        {members.map(client => (
                          <button
                            key={client.id}
                            onClick={() => setSelectedClient(client)}
                            className="w-full text-left bg-card border border-border rounded-lg p-3 hover:bg-muted/50 transition"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-sm font-semibold text-foreground truncate">{client.full_name || 'Unnamed'}</span>
                              <StatusBadge client={client} />
                            </div>
                            <p className="mt-1 text-[11px] text-muted-foreground">Last spoke: {contactText(client)}</p>
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : viewMode === 'quarterly' ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[640px]">
                  <thead>
                    <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border">
                      <th className="py-2.5 px-4 font-semibold">Client</th>
                      <th className="py-2.5 px-3 font-semibold">Last quarterly call</th>
                      <th className="py-2.5 px-3 font-semibold">Next due</th>
                      <th className="py-2.5 px-3 font-semibold">Status</th>
                      <th className="py-2.5 px-4 font-semibold text-right">Log</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...visible]
                      .sort((a, b) => (a.quarterly.daysUntil ?? 9999) - (b.quarterly.daysUntil ?? 9999))
                      .map(client => (
                        <tr key={client.id} onClick={() => setSelectedClient(client)} className="border-b border-border/60 last:border-0 cursor-pointer hover:bg-muted/40 transition-colors">
                          <td className="py-3 px-4 font-semibold text-foreground">{client.full_name || 'Unnamed Client'}</td>
                          <td className="py-3 px-3 text-muted-foreground whitespace-nowrap">{client.quarterly.lastAt ? formatShortDate(client.quarterly.lastAt) : 'None logged'}</td>
                          <td className="py-3 px-3 text-muted-foreground whitespace-nowrap">{formatShortDate(client.quarterly.dueAt)}</td>
                          <td className={`py-3 px-3 whitespace-nowrap ${quarterlyTone(client)}`}>{describeQuarterly(client.quarterly)}</td>
                          <td className="py-3 px-4"><div className="flex justify-end"><QuickLog clientId={client.id} /></div></td>
                        </tr>
                      ))}
                  </tbody>
                </table>
                <p className="text-[11px] text-muted-foreground px-4 py-3 border-t border-border">
                  A quarterly call is due 90 days after the last one (or after they joined). Tap the calendar icon on a row once the call is done.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[860px]">
                  <thead>
                    <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border">
                      <th className="py-2.5 px-4 font-semibold">Client</th>
                      <th className="py-2.5 px-3 font-semibold">Status</th>
                      <th className="py-2.5 px-3 font-semibold">Last spoke</th>
                      <th className="py-2.5 px-3 font-semibold">Quarterly call</th>
                      <th className="py-2.5 px-3 font-semibold">Revenue</th>
                      <th className="py-2.5 px-3 font-semibold">Gate</th>
                      <th className="py-2.5 px-4 font-semibold text-right">Log</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map(client => {
                      const s = STATUS_STYLE[client.status];
                      const [latest, previous] = client.revenueSeries;
                      const change = client.revenueSeries.length > 1 && previous ? Math.round(((latest - previous) / previous) * 100) : null;
                      const overdueContact = client.contact.days === null || client.contact.days > client.touchEveryDays;
                      return (
                        <tr
                          key={client.id}
                          onClick={() => setSelectedClient(client)}
                          className="border-b border-border/60 last:border-0 cursor-pointer hover:bg-muted/40 transition-colors align-top"
                        >
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${s.dot}`} />
                              <span className="font-semibold text-foreground truncate">{client.full_name || 'Unnamed Client'}</span>
                            </div>
                            <Reasons reasons={client.attention.reasons} />
                          </td>
                          <td className="py-3 px-3 whitespace-nowrap">
                            <StatusBadge client={client} />
                            {!client.overridden && client.momentum.reasons.length > 0 && (
                              <p className="mt-0.5 text-[10px] text-muted-foreground max-w-[160px] truncate">{client.momentum.reasons.join(' · ')}</p>
                            )}
                          </td>
                          <td className={`py-3 px-3 whitespace-nowrap ${client.status !== 'new' && overdueContact ? 'text-orange-600 font-semibold' : 'text-muted-foreground'}`}>
                            {contactText(client)}
                          </td>
                          <td className={`py-3 px-3 whitespace-nowrap ${quarterlyTone(client)}`}>{describeQuarterly(client.quarterly)}</td>
                          <td className="py-3 px-3 whitespace-nowrap">
                            <span className="text-foreground">${client.monthlyRevenue.toLocaleString()}</span>
                            {change !== null && (
                              Math.abs(change) < 5
                                ? <span className="ml-1.5 text-xs text-muted-foreground">flat</span>
                                : <span className={`ml-1.5 text-xs ${change > 0 ? 'text-success' : 'text-orange-600'}`}>{change > 0 ? '▲' : '▼'} {Math.abs(change)}%</span>
                            )}
                          </td>
                          <td className="py-3 px-3 whitespace-nowrap text-muted-foreground">
                            {client.gh.gate ? `Gate ${ROMAN[client.gh.gate]}` : 'No gate'}
                            {client.gh.toApprove > 0 && <span className="ml-1.5 text-xs text-orange-600">{client.gh.toApprove} to approve</span>}
                          </td>
                          <td className="py-3 px-4"><div className="flex justify-end"><QuickLog clientId={client.id} /></div></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            {visible.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">No clients match that.</p>}
          </div>
        </>
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

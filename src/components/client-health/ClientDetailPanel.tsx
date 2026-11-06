import { useEffect, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query';
import { X, Sparkles, RefreshCw, Copy, StickyNote, Trash2, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import ContextRoom from '@/components/ContextRoom';
import GrowthHubPanel from '@/components/client-health/GrowthHubPanel';
import QuarterlyCall from '@/components/client-health/QuarterlyCall';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { useLogTouchpoint } from '@/hooks/useClientCare';
import {
  type ClientWithHealth,
  TIER_OPTIONS,
  normalizeTier,
  formatTierLabel,
  getMarginBand,
  MARGIN_STYLE,
  TARGET_MARGIN,
  MIN_MARGIN,
} from '@/lib/clientHealth';
import { STATUS_STYLE, TOUCH_KINDS, describeQuarterly, formatShortDate, touchLabel, type DanRead, type TouchKind } from '@/lib/clientCare';

const READS: { value: DanRead | 'auto'; label: string }[] = [
  { value: 'auto', label: 'Let the numbers decide' },
  { value: 'good', label: 'Good' },
  { value: 'watch', label: 'Watch' },
  { value: 'needs_help', label: 'Needs help' },
];

const CADENCES = [7, 14, 21, 30, 45, 60, 90];
const todayInput = () => new Date().toISOString().slice(0, 10);
const longDate = (d: string) => new Date(d).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });

/**
 * The slide-over for one client. Built to be read in ten seconds: a short
 * summary, when someone last spoke to them and when their quarterly call is
 * due, then notes and the contact log that Dan and Emily share. The detail
 * (financials, reviews, Growth Hub, Context Room) sits underneath.
 *
 * It fetches its own per-client data rather than taking it as props, so the
 * list page does not hold queries it never renders.
 */
export default function ClientDetailPanel({
  client,
  onClose,
  changeTier,
}: {
  client: ClientWithHealth;
  onClose: () => void;
  /** Passed whole rather than as a callback: the panel shows its pending state. */
  changeTier: UseMutationResult<string, Error, { clientId: string; tier: string }>;
}) {
  const c = client;
  const qc = useQueryClient();
  const s = STATUS_STYLE[c.status];

  // ---------- care row: Dan's read, cadence, AI summary ----------
  const { data: care, isFetched: careLoaded } = useQuery({
    queryKey: ['client-care-row', c.id],
    queryFn: async () => (await supabase.from('client_care').select('*').eq('client_id', c.id).maybeSingle()).data,
  });

  const saveCare = useMutation({
    mutationFn: async (patch: { touch_every_days?: number | null; dan_read?: DanRead | null; dan_read_note?: string | null }) => {
      const { data: auth } = await supabase.auth.getUser();
      const row = {
        client_id: c.id, ...patch, updated_at: new Date().toISOString(),
        ...('dan_read' in patch ? { dan_read_by: auth.user?.id ?? null, dan_read_at: new Date().toISOString() } : {}),
      };
      const { error } = await supabase.from('client_care').upsert(row, { onConflict: 'client_id' });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['client-care'] });
      qc.invalidateQueries({ queryKey: ['client-care-row', c.id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const [readNote, setReadNote] = useState<string | null>(null);

  const snapshot = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('client-snapshot', { body: { userId: c.id } });
      if (error || data?.error) throw new Error(data?.error ?? 'Could not build the summary');
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['client-care-row', c.id] }),
    onError: (e: Error) => toast.error(e.message),
  });

  // Build the summary the first time a client is opened, and again once they've submitted something newer.
  const triedSnapshot = useRef(false);
  useEffect(() => {
    if (!careLoaded || triedSnapshot.current) return;
    const stale = !care?.snapshot || (c.last_submission_at && care.snapshot_at && care.snapshot_at < c.last_submission_at);
    if (stale) { triedSnapshot.current = true; snapshot.mutate(); }
  }, [careLoaded, care, c.last_submission_at, snapshot]);

  const bullets = Array.isArray(care?.checkin_bullets) ? (care!.checkin_bullets as unknown[]).filter((b): b is string => typeof b === 'string') : [];

  // ---------- contact log + private notes, shared by Dan and Emily ----------
  const logTouch = useLogTouchpoint();
  const [touchKind, setTouchKind] = useState<TouchKind>('whatsapp');
  const [touchDate, setTouchDate] = useState(todayInput());
  const [touchNote, setTouchNote] = useState('');
  const [noteDraft, setNoteDraft] = useState('');

  const { data: touches = [] } = useQuery({
    queryKey: ['client-touchpoints', c.id],
    queryFn: async () => {
      const { data } = await supabase.from('client_touchpoints').select('id, kind, occurred_at, note, author_id, source').eq('client_id', c.id).order('occurred_at', { ascending: false }).limit(50);
      return data ?? [];
    },
  });
  const { data: notes = [] } = useQuery({
    queryKey: ['client-notes', c.id],
    queryFn: async () => {
      const { data } = await supabase.from('client_notes').select('id, note, created_at, author_id').eq('client_id', c.id).order('created_at', { ascending: false });
      return data ?? [];
    },
  });
  const authorIds = [...new Set([...touches.map(t => t.author_id), ...notes.map(n => n.author_id)].filter((id): id is string => !!id))];
  const { data: authors = {} } = useQuery({
    queryKey: ['client-activity-authors', authorIds.join(',')],
    enabled: authorIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('id, full_name').in('id', authorIds);
      return Object.fromEntries((data ?? []).map(p => [p.id, (p.full_name ?? '').split(' ')[0]]));
    },
  });

  const addNote = useMutation({
    mutationFn: async (note: string) => {
      const { data: auth } = await supabase.auth.getUser();
      const { error } = await supabase.from('client_notes').insert({ client_id: c.id, author_id: auth.user!.id, note });
      if (error) throw error;
    },
    onSuccess: () => {
      setNoteDraft('');
      qc.invalidateQueries({ queryKey: ['client-notes', c.id] });
      toast.success('Note saved');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteTouch = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('client_touchpoints').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['client-touchpoints'] });
      qc.invalidateQueries({ queryKey: ['client-touchpoints', c.id] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const feed = [
    ...touches.map(t => ({ id: `t-${t.id}`, at: t.occurred_at, kind: 'touch' as const, label: touchLabel(t.kind), text: t.note, author: t.author_id, source: t.source, touchId: t.id })),
    ...notes.map(n => ({ id: `n-${n.id}`, at: n.created_at, kind: 'note' as const, label: 'Note', text: n.note, author: n.author_id, source: 'manual', touchId: null })),
  ].sort((a, b) => b.at.localeCompare(a.at));

  // ---------- monthly review (Dan's breakdown, condensed) ----------
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [draftingMonth, setDraftingMonth] = useState<string | null>(null);
  const [copiedMonth, setCopiedMonth] = useState<string | null>(null);
  const [draftError, setDraftError] = useState<string | null>(null);
  const draftMessage = async (month: string) => {
    setDraftingMonth(month);
    setDraftError(null);
    try {
      const { data, error } = await supabase.functions.invoke('monthly-review', { body: { action: 'draft-message', userId: c.id, month } });
      if (error || !data?.message) throw new Error(data?.error ?? 'Could not draft the message');
      setDrafts(previous => ({ ...previous, [month]: data.message }));
    } catch (error) {
      setDraftError(error instanceof Error ? error.message : 'Could not draft the message');
    } finally {
      setDraftingMonth(null);
    }
  };
  const copyMessage = async (month: string) => {
    try {
      await navigator.clipboard.writeText(drafts[month]);
      setCopiedMonth(month);
      toast.success('Message copied');
    } catch {
      toast.error('Could not copy — select the message to copy it');
    }
  };

  const { data: reviews = [] } = useQuery({
    queryKey: ['client-monthly-reviews', c.id],
    queryFn: async () => {
      const { data } = await supabase.from('monthly_reviews').select('month, admin_breakdown, focus, created_at').eq('user_id', c.id).order('month', { ascending: false }).limit(3);
      return data ?? [];
    },
  });
  const regenerate = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('monthly-review', { body: { userId: c.id } });
      if (error || data?.error) throw new Error(data?.error ?? 'Could not build the review');
      return data;
    },
    onSuccess: () => {
      toast.success('Review rebuilt');
      setDrafts({});
      qc.invalidateQueries({ queryKey: ['client-monthly-reviews', c.id] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const { data: clientHistory = [] } = useQuery({
    queryKey: ['client-monthly-history', c.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('monthly_totals')
        .select('month, mrr_manual, mrr, oneoff_revenue, total_revenue, expenses, content_posts, leads_generated, new_clients, active_retainers, retainers_lost, retainer_convos, ad_leads')
        .eq('user_id', c.id).order('month', { ascending: false }).limit(6);
      return data ?? [];
    },
  });

  const archive = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.from('profiles').update({ archived_at: new Date().toISOString() }).eq('id', c.id).select('id');
      if (error) throw error;
      if (!data?.length) throw new Error('Archive blocked — check admin permissions');
    },
    onSuccess: () => {
      toast.success(`${c.full_name || 'Client'} archived — their data is kept`);
      qc.invalidateQueries({ queryKey: ['archived-clients'] });
      onClose();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const revenue = Number(c.last_total_revenue || 0);
  const expenses = Number(c.last_expenses || 0);
  const netProfit = revenue - expenses;
  const netMargin = revenue > 0 ? (netProfit / revenue) * 100 : 0;
  const ms = MARGIN_STYLE[getMarginBand(netMargin)];
  const currentTier = normalizeTier(c.tier);
  const isInFlow = currentTier === 'in_flow_starter' || currentTier === 'in_flow_scale';
  const tierBtn = (active: boolean) =>
    `flex-1 py-2 px-3 rounded-lg text-sm font-semibold transition ${active ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/70'}`;
  const submittedMonth = c.last_submission_month ? new Date(c.last_submission_month).toLocaleString('default', { month: 'long', year: 'numeric' }) : null;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" onClick={() => onClose()} />

      <div className="fixed top-0 right-0 z-50 h-full w-full max-w-xl bg-card border-l border-border shadow-2xl overflow-y-auto">
        <div className={`sticky top-0 z-10 ${s.bg} border-b ${s.border} px-6 py-4 flex items-center justify-between`}>
          <div className="flex items-center gap-3">
            <div className={`w-3 h-3 rounded-full ${s.dot}`} />
            <div>
              <h2 className="font-bold text-foreground text-lg">{c.full_name}</h2>
              <p className={`text-xs font-semibold ${s.text}`}>
                {s.label}{c.overridden ? " · your read" : c.momentum.reasons.length ? ` · ${c.momentum.reasons.join(' · ')}` : ''}
                <span className="text-muted-foreground font-normal"> · {formatTierLabel(c.tier)}</span>
              </p>
              {c.attention.reasons.length > 0 && (
                <p className="mt-0.5 text-xs text-foreground/80">{c.attention.reasons.join(' · ')}</p>
              )}
            </div>
          </div>
          <button onClick={() => onClose()} className="p-2 rounded-lg hover:bg-muted/50 transition" aria-label="Close">
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Quick summary: who they are, the numbers, what matters from their Context Room */}
          <div className="rounded-xl border border-primary/30 bg-primary/5 p-4">
            <div className="flex items-center justify-between gap-2 mb-2">
              <p className="text-xs font-semibold text-primary flex items-center gap-1"><Sparkles className="w-3.5 h-3.5" /> Quick summary</p>
              <button
                onClick={() => snapshot.mutate()}
                disabled={snapshot.isPending}
                className="text-[11px] font-semibold text-muted-foreground hover:text-foreground flex items-center gap-1 disabled:opacity-50"
              >
                <RefreshCw className={`w-3 h-3 ${snapshot.isPending ? 'animate-spin' : ''}`} /> {snapshot.isPending ? 'Writing…' : 'Refresh'}
              </button>
            </div>
            {care?.snapshot
              ? <p className="text-sm text-foreground leading-relaxed">{care.snapshot}</p>
              : <p className="text-xs text-muted-foreground">{snapshot.isPending ? 'Writing the summary…' : 'No summary yet — hit Refresh.'}</p>}

            {bullets.length > 0 && (
              <div className="mt-3 pt-3 border-t border-primary/20">
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1.5">
                  What they said{submittedMonth ? ` · ${submittedMonth}` : ''}
                </p>
                <ul className="space-y-1">
                  {bullets.map(b => <li key={b} className="text-sm text-foreground">• {b}</li>)}
                </ul>
              </div>
            )}
            {(c.last_biggest_win || c.last_needs) && (
              <details className="mt-2 group">
                <summary className="text-[11px] font-semibold text-primary cursor-pointer select-none">Read exactly what they wrote</summary>
                <div className="mt-2 space-y-2">
                  {c.last_biggest_win && (
                    <div>
                      <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Biggest win</p>
                      <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{c.last_biggest_win}</p>
                    </div>
                  )}
                  {c.last_needs && (
                    <div>
                      <p className="text-[11px] uppercase tracking-wider text-muted-foreground">What they're working on next</p>
                      <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{c.last_needs}</p>
                    </div>
                  )}
                </div>
              </details>
            )}
          </div>

          {/* Contact + quarterly call */}
          <div className="grid grid-cols-3 gap-3">
            <div className="p-3 rounded-xl border border-border">
              <p className="text-xs text-muted-foreground mb-1">Last spoke</p>
              <p className="text-sm font-semibold text-foreground">
                {c.contact.days === null ? 'None logged' : c.contact.days === 0 ? 'Today' : `${c.contact.days}d ago`}
              </p>
              {c.contact.kind && <p className="text-[11px] text-muted-foreground">{touchLabel(c.contact.kind)}</p>}
              {c.reply.days !== null && (
                <p className={`text-[11px] ${c.attention.reasons.some(r => r.startsWith("Hasn't replied")) ? 'font-semibold text-destructive' : 'text-muted-foreground'}`}>
                  They replied {c.reply.days === 0 ? 'today' : `${c.reply.days}d ago`}
                </p>
              )}
            </div>
            <div className={`p-3 rounded-xl border ${c.quarterly.state === 'overdue' ? 'border-red-500/40 bg-red-500/10' : c.quarterly.state === 'soon' ? 'border-yellow-500/40 bg-yellow-500/10' : 'border-border'}`}>
              <p className="text-xs text-muted-foreground mb-1">Quarterly call</p>
              <p className="text-sm font-semibold text-foreground">{describeQuarterly(c.quarterly)}</p>
              <p className="text-[11px] text-muted-foreground">{c.quarterly.lastAt ? `Last ${formatShortDate(c.quarterly.lastAt)}` : `Due ${formatShortDate(c.quarterly.dueAt)}`}</p>
            </div>
            <div className="p-3 rounded-xl border border-border">
              <label htmlFor="touch-every" className="text-xs text-muted-foreground block mb-1">Touch base</label>
              <select
                id="touch-every"
                value={care?.touch_every_days ?? ''}
                onChange={e => saveCare.mutate({ touch_every_days: e.target.value ? Number(e.target.value) : null })}
                className="w-full bg-transparent text-sm font-semibold text-foreground focus:outline-none"
              >
                <option value="">Auto · every {c.touchEveryDays}d</option>
                {CADENCES.map(d => <option key={d} value={d}>Every {d} days</option>)}
              </select>
            </div>
          </div>

          <QuarterlyCall client={c} history={clientHistory} />

          {/* Dan's read */}
          <div className="rounded-xl border border-border p-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Your read</p>
            <p className="text-xs text-muted-foreground mb-3">
              The numbers say <span className={`font-semibold ${STATUS_STYLE[c.momentum.status].text}`}>{STATUS_STYLE[c.momentum.status].label}</span>
              {c.momentum.reasons.length > 0 && ` (${c.momentum.reasons.join(', ')})`}. If you know better, say so and your call wins.
            </p>
            <div className="flex flex-wrap gap-1.5">
              {READS.map(r => {
                const active = (c.danRead ?? 'auto') === r.value;
                return (
                  <button
                    key={r.value}
                    disabled={saveCare.isPending}
                    onClick={() => saveCare.mutate({ dan_read: r.value === 'auto' ? null : r.value, ...(r.value === 'auto' ? { dan_read_note: null } : {}) })}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${active ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/70'}`}
                  >
                    {r.label}
                  </button>
                );
              })}
            </div>
            {c.danRead && (
              <input
                value={readNote ?? c.danReadNote ?? ''}
                onChange={e => setReadNote(e.target.value)}
                onBlur={() => { if (readNote !== null && readNote !== (c.danReadNote ?? '')) saveCare.mutate({ dan_read_note: readNote.trim() || null }); }}
                placeholder="Why? e.g. chats weekly on WhatsApp, just doesn't log in"
                className="mt-3 w-full px-3 py-2 bg-input border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            )}
          </div>

          {/* Contact log + notes: one shared timeline for Dan and Emily */}
          <div className="bg-card border border-border rounded-xl p-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <StickyNote className="w-3.5 h-3.5" /> Notes &amp; contact log
            </p>

            <div className="rounded-lg bg-muted/30 border border-border p-3 mb-3 space-y-2">
              <p className="text-xs font-semibold text-foreground flex items-center gap-1"><MessageCircle className="w-3.5 h-3.5" /> Log a contact</p>
              <div className="flex flex-wrap gap-2">
                <select
                  value={touchKind}
                  onChange={e => setTouchKind(e.target.value as TouchKind)}
                  aria-label="Type of contact"
                  className="px-2 py-1.5 bg-input border border-border rounded-lg text-xs text-foreground"
                >
                  {TOUCH_KINDS.map(k => <option key={k.value} value={k.value}>{k.label}</option>)}
                </select>
                <input
                  type="date" value={touchDate} max={todayInput()}
                  onChange={e => setTouchDate(e.target.value)}
                  aria-label="Date of contact"
                  className="px-2 py-1.5 bg-input border border-border rounded-lg text-xs text-foreground"
                />
                <input
                  value={touchNote} onChange={e => setTouchNote(e.target.value)}
                  placeholder="What was said (optional)"
                  className="flex-1 min-w-[140px] px-2 py-1.5 bg-input border border-border rounded-lg text-xs text-foreground placeholder:text-muted-foreground"
                />
                <Button
                  type="button" size="sm" disabled={!touchDate || logTouch.isPending}
                  onClick={() => logTouch.mutate(
                    { clientId: c.id, kind: touchKind, occurredAt: touchDate === todayInput() ? undefined : new Date(`${touchDate}T12:00:00`).toISOString(), note: touchNote },
                    { onSuccess: () => { setTouchNote(''); setTouchDate(todayInput()); } },
                  )}
                >
                  Log
                </Button>
              </div>
            </div>

            <div className="flex gap-2 mb-3">
              <input
                value={noteDraft}
                onChange={e => setNoteDraft(e.target.value)}
                placeholder="Add a note only the team can see…"
                className="flex-1 px-3 py-2 bg-input border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                onKeyDown={e => { if (e.key === 'Enter' && noteDraft.trim()) addNote.mutate(noteDraft.trim()); }}
              />
              <Button type="button" size="sm" disabled={!noteDraft.trim() || addNote.isPending} onClick={() => addNote.mutate(noteDraft.trim())}>Save</Button>
            </div>

            {feed.length === 0 ? (
              <p className="text-xs text-muted-foreground">Nothing logged yet.</p>
            ) : (
              <ul className="space-y-2">
                {feed.map(item => (
                  <li key={item.id} className={`rounded-lg p-2.5 border border-border ${item.kind === 'note' ? 'bg-muted/30' : 'bg-card'}`}>
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-semibold text-foreground">
                        {item.label}
                        {item.source !== 'manual' && <span className="ml-1.5 text-[10px] font-normal text-muted-foreground">auto</span>}
                      </p>
                      <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                        <span>{longDate(item.at)}{item.author && authors[item.author] ? ` · ${authors[item.author]}` : ''}</span>
                        {item.touchId && (
                          <button
                            onClick={() => { if (confirm('Remove this logged contact?')) deleteTouch.mutate(item.touchId!); }}
                            aria-label="Remove logged contact" className="hover:text-destructive"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>
                    {item.text && <p className="text-sm text-foreground whitespace-pre-wrap mt-0.5">{item.text}</p>}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Financials snapshot */}
          <div className="bg-card border border-border rounded-xl p-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Latest numbers{submittedMonth ? ` · ${submittedMonth}` : ''}</p>
            <div className={`${ms.bg} border ${ms.border} rounded-lg p-3 mb-3 flex items-baseline justify-between`}>
              <div>
                <p className="text-xs text-muted-foreground">Net profit margin</p>
                <p className={`text-2xl font-bold ${ms.text}`}>{netMargin.toFixed(1)}%</p>
              </div>
              <span className="text-xs text-muted-foreground">Target ≥ {TARGET_MARGIN}% · Min {MIN_MARGIN}%</span>
            </div>
            <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
              {[
                { label: 'Revenue', value: `$${revenue.toLocaleString()}` },
                { label: 'MRR', value: `$${Number(c.last_mrr || 0).toLocaleString()}` },
                { label: 'Expenses', value: `$${expenses.toLocaleString()}` },
                { label: 'Net profit', value: `$${netProfit.toLocaleString()}` },
                { label: 'Ad spend', value: Number(c.last_ad_spend) > 0 ? `$${Number(c.last_ad_spend).toLocaleString()}` : '—' },
                { label: 'New clients', value: `${c.last_new_clients ?? '—'}` },
                { label: 'Leads', value: `${c.last_leads ?? '—'}` },
                { label: 'Content', value: `${c.last_content_posts ?? '—'} posts` },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between">
                  <span className="text-muted-foreground">{label}</span>
                  <span className="font-semibold text-foreground">{value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Monthly review: the headline up front, the full breakdown on demand */}
          <div className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center justify-between gap-3 mb-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Monthly review</p>
              <button
                onClick={() => regenerate.mutate()}
                disabled={regenerate.isPending}
                className="text-[11px] font-semibold px-2.5 py-1 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted/50 transition disabled:opacity-50"
              >
                {regenerate.isPending ? 'Building…' : reviews.length ? 'Rebuild' : 'Build it'}
              </button>
            </div>
            {reviews.length === 0 ? (
              <p className="text-xs text-muted-foreground">No review yet. One is written automatically when they submit their month.</p>
            ) : (
              <div className="space-y-3">
                {reviews.map((r, index) => (
                  <div key={r.month} className={index > 0 ? 'pt-3 border-t border-border' : ''}>
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="text-xs font-semibold text-foreground">{new Date(r.month).toLocaleString('default', { month: 'long', year: 'numeric' })}</p>
                    </div>
                    {r.focus && <p className="text-sm text-primary font-semibold mt-0.5">Focus: {r.focus}</p>}
                    <details className="mt-1.5">
                      <summary className="text-[11px] font-semibold text-muted-foreground cursor-pointer select-none hover:text-foreground">Read the full breakdown</summary>
                      <p className="mt-2 text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed">{r.admin_breakdown}</p>
                    </details>
                    <details className="mt-1.5">
                      <summary className="text-[11px] font-semibold text-muted-foreground cursor-pointer select-none hover:text-foreground">Message to send</summary>
                      <div className="mt-2 space-y-2">
                        <div className="flex items-center gap-2">
                          <Button type="button" variant="outline" size="sm" disabled={draftingMonth !== null} onClick={() => draftMessage(r.month)}>
                            {draftingMonth === r.month ? 'Writing…' : drafts[r.month] ? 'Rewrite' : 'Write message'}
                          </Button>
                          {drafts[r.month] && (
                            <Button type="button" size="sm" onClick={() => copyMessage(r.month)} aria-label={`Copy ${r.month} message`}>
                              <Copy /> {copiedMonth === r.month ? 'Copied' : 'Copy'}
                            </Button>
                          )}
                        </div>
                        {draftError && draftingMonth === null && <p role="alert" className="text-xs text-destructive">{draftError}</p>}
                        {drafts[r.month] && (
                          <textarea
                            aria-label={`Message for ${c.full_name}, ${r.month}`}
                            value={drafts[r.month]}
                            onChange={e => { setDrafts(previous => ({ ...previous, [r.month]: e.target.value })); setCopiedMonth(null); }}
                            rows={9}
                            className="w-full resize-y rounded-md border border-input bg-background p-3 text-sm text-foreground leading-relaxed focus:outline-none focus:ring-2 focus:ring-ring"
                          />
                        )}
                      </div>
                    </details>
                  </div>
                ))}
              </div>
            )}
          </div>

          <Accordion type="single" collapsible className="space-y-2">
            <AccordionItem value="context-room" className="border border-border rounded-lg px-4">
              <AccordionTrigger className="text-sm hover:no-underline">Context Room</AccordionTrigger>
              <AccordionContent><ContextRoom key={c.id} userId={c.id} adminView /></AccordionContent>
            </AccordionItem>
            <AccordionItem value="growth-hub" className="border border-border rounded-lg px-4">
              <AccordionTrigger className="text-sm hover:no-underline">Growth Hub &amp; gate</AccordionTrigger>
              <AccordionContent><GrowthHubPanel key={c.id} memberId={c.id} gate={c.gate ?? null} /></AccordionContent>
            </AccordionItem>
            <AccordionItem value="stage" className="border border-border rounded-lg px-4">
              <AccordionTrigger className="text-sm hover:no-underline">Stage &amp; tier</AccordionTrigger>
              <AccordionContent>
                <div className="space-y-3">
                  <div className="flex gap-2">
                    <button onClick={() => changeTier.mutate({ clientId: c.id, tier: 'onboarding' })} disabled={changeTier.isPending} className={tierBtn(currentTier === 'onboarding')}>Onboarding</button>
                    <button onClick={() => changeTier.mutate({ clientId: c.id, tier: 'in_flow_starter' })} disabled={changeTier.isPending} className={tierBtn(isInFlow)}>In Flow</button>
                  </div>
                  {isInFlow && (
                    <div className="flex gap-2">
                      <button onClick={() => changeTier.mutate({ clientId: c.id, tier: 'in_flow_starter' })} disabled={changeTier.isPending} className={tierBtn(currentTier === 'in_flow_starter')}>Under $20k/mth</button>
                      <button onClick={() => changeTier.mutate({ clientId: c.id, tier: 'in_flow_scale' })} disabled={changeTier.isPending} className={tierBtn(currentTier === 'in_flow_scale')}>Over $20k/mth</button>
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Onboarding = On-Ramp legacy modules only. In Flow under $20k = first 9 roadmap modules. Over $20k = full roadmap.
                  </p>
                </div>
              </AccordionContent>
            </AccordionItem>
            {clientHistory.length > 0 && (
              <AccordionItem value="history" className="border border-border rounded-lg px-4">
                <AccordionTrigger className="text-sm hover:no-underline">Submission history</AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-2">
                    {clientHistory.map(row => {
                      const r = Number(row.total_revenue) || (Number(row.mrr_manual || row.mrr || 0) + Number(row.oneoff_revenue || 0));
                      return (
                        <div key={row.month} className="flex items-center justify-between gap-2 text-xs border-b border-border/50 pb-2 last:border-0 last:pb-0">
                          <span className="text-muted-foreground">{new Date(row.month).toLocaleString('default', { month: 'short', year: 'numeric' })}</span>
                          <span className="text-foreground">${r.toLocaleString()} rev</span>
                          <span className="text-foreground">{row.content_posts ?? '—'} posts</span>
                          {row.active_retainers != null && <span className="text-foreground">{row.active_retainers} retainers{row.retainers_lost ? ` (−${row.retainers_lost})` : ''}</span>}
                          <span className="text-success">{row.new_clients ?? '—'} clients</span>
                        </div>
                      );
                    })}
                  </div>
                </AccordionContent>
              </AccordionItem>
            )}
          </Accordion>

          <div className="pt-4 border-t border-border">
            <button
              onClick={() => { if (confirm(`Archive ${c.full_name || 'this client'}? They disappear from the portal, but every submission and review is kept.`)) archive.mutate(); }}
              disabled={archive.isPending}
              className="text-xs font-semibold text-muted-foreground hover:text-destructive transition disabled:opacity-50"
            >
              {archive.isPending ? 'Archiving…' : 'Archive this client'}
            </button>
            <p className="text-[11px] text-muted-foreground mt-1">Hides them everywhere in the portal. Nothing is deleted.</p>
          </div>
        </div>
      </div>
    </>
  );
}

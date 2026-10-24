import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import PageLayout from '@/components/PageLayout';
import { useRequireAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { resourceCatalogue, vaultSources } from '@/data/resourceCatalogue';
import { ArrowUp, Loader2, Plus, Copy, Check, BookmarkPlus, History } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import DanAiOrb, { type OrbState } from '@/components/DanAiOrb';
import KnowledgeAdmin from '@/components/dan-ai/KnowledgeAdmin';
import ChecksAdmin from '@/components/dan-ai/ChecksAdmin';
import TestsAdmin from '@/components/dan-ai/TestsAdmin';
import TimingSummary, { type DanTiming } from '@/components/dan-ai/TimingSummary';
import NeuralField from '@/components/dan-ai/NeuralField';
import ThinkingTrace from '@/components/dan-ai/ThinkingTrace';
import AnswerCard, { type Answer, type Point, type Sources } from '@/components/dan-ai/AnswerCard';
import { askDanStream } from '@/lib/danStream';

interface Debug {
  timing?: DanTiming;
  mode?: string; data_freshness?: string; brain_loaded?: boolean;
  derived?: Record<string, unknown> | null; plan?: unknown;
  passages?: { title: string; source_type: string; score: number }[];
  checker_issues?: { type: string; note: string }[]; guardrails?: { type: string; note: string }[];
  about_member?: string; member_id: string | null;
  brain?: { docs: number; words: number }; goal?: string;
  monthly_totals?: { count: number; months: string[] };
  context_room?: { found?: boolean; fields_filled: number; missing?: string[] };
  passage_titles?: string[];
  roster_clients?: number; roster_words?: number;
}
interface Msg { id: string; role: 'user' | 'assistant'; content: string; parsed?: Answer; debug?: Debug; fresh?: boolean }
interface Thread { id: string; title: string; at: string }

const toPoints = (v: unknown): Point[] => Array.isArray(v)
  ? v.map((p: unknown) => typeof p === 'object' && p !== null
      ? { do: String((p as Point).do ?? ''), why: String((p as Point).why ?? '') }
      : { do: String(p), why: '' }).filter(p => p.do)
  : [];

function toAnswer(o: Record<string, unknown>): Answer {
  return {
    answer: String(o.answer ?? ''),
    points: Array.isArray(o.points) ? toPoints(o.points) : toPoints(o.next_steps),
    note: typeof o.note === 'string' ? o.note : null,
    resource: typeof o.resource === 'string' ? o.resource : null,
    context_used: typeof o.context_used === 'boolean' ? o.context_used : undefined,
    sources: o.sources && typeof o.sources === 'object' ? o.sources as Sources : undefined,
    all_clients: o.all_clients === true,
    resource_why: typeof o.resource_why === 'string' ? o.resource_why : null,
    cta: o.cta && typeof o.cta === 'object' && typeof (o.cta as { href?: unknown }).href === 'string' ? o.cta as { label: string; href: string } : null,
  };
}

function parseAnswer(content: string): Answer {
  try {
    const o = JSON.parse(content);
    if (o && typeof o.answer === 'string') return toAnswer(o);
  } catch { /* plain text */ }
  return { answer: content, points: [], note: null, resource: null };
}

type Tab = 'chat' | 'knowledge' | 'checks' | 'tests';

export default function DanAI() {
  const { user, loading: authLoading } = useRequireAuth();
  const { data: profile } = useProfile();
  const isAdmin = Boolean(profile?.is_admin);

  const [tab, setTab] = useState<Tab>('chat');
  const [threads, setThreads] = useState<Thread[]>([]);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [pending, setPending] = useState<null | 'thinking' | 'checking'>(null);
  const [steps, setSteps] = useState<string[]>([]);
  const [members, setMembers] = useState<{ id: string; full_name: string | null }[]>([]);
  const [memberId, setMemberId] = useState('');
  const [copied, setCopied] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [answered, setAnswered] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [params, setParams] = useSearchParams();

  const allClients = isAdmin && memberId === 'all';

  // "Help me do this" on a build task lands here with the question ready to send.
  useEffect(() => {
    const q = params.get('q');
    if (!q) return;
    setInput(q.slice(0, 4000));
    setParams({}, { replace: true });
    inputRef.current?.focus();
  }, [params, setParams]);

  useEffect(() => {
    if (!user) return;
    loadThreads();
  }, [user]);

  useEffect(() => {
    if (!isAdmin) return;
    supabase.from('profiles').select('id, full_name').eq('access_revoked', false).is('archived_at', null)
      .order('full_name').then(({ data }) => setMembers(data ?? []));
  }, [isAdmin]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [messages, steps]);

  const loadThreads = async () => {
    if (!user) return;
    const { data } = await supabase.from('dan_ai_messages')
      .select('thread_id, content, role, created_at').eq('user_id', user.id).eq('role', 'user')
      .order('created_at', { ascending: false }).limit(300);
    const seen = new Map<string, Thread>();
    for (const r of data ?? []) {
      // Newest-first, so the last one seen per thread is its opening question.
      const prev = seen.get(r.thread_id);
      seen.set(r.thread_id, { id: r.thread_id, title: r.content, at: prev?.at ?? r.created_at });
    }
    setThreads([...seen.values()]);
  };

  const openThread = async (id: string) => {
    if (!user) return;
    setThreadId(id);
    const { data } = await supabase.from('dan_ai_messages')
      .select('id, role, content').eq('thread_id', id).eq('user_id', user.id).order('created_at');
    setMessages((data ?? []).map(m => ({ ...m, role: m.role as Msg['role'], parsed: m.role === 'assistant' ? parseAnswer(m.content) : undefined })));
    setHistoryOpen(false);
    inputRef.current?.focus();
  };

  const newThread = () => { setHistoryOpen(false); setThreadId(null); setMessages([]); setInput(''); inputRef.current?.focus(); };

  const send = async (q?: string) => {
    const asked = (q ?? input).trim();
    if (!asked || pending) return;
    setInput('');
    setMessages(prev => [...prev, { id: `u-${Date.now()}`, role: 'user', content: asked }]);
    setPending('thinking');
    setSteps([allClients ? 'Opening the command centre…' : 'Reading your numbers…']);
    try {
      const data = await askDanStream({ question: asked, thread_id: threadId, catalogue: resourceCatalogue(), vault_sources: vaultSources(), member_id: isAdmin && memberId ? memberId : undefined }, next => {
        setSteps(prev => prev[prev.length - 1] === next ? prev : [...prev, next]);
        setPending(/^checking|final safety/i.test(next) ? 'checking' : 'thinking');
      });
      const parsed = toAnswer(data);
      setThreadId(typeof data.thread_id === 'string' ? data.thread_id : null);
      setMessages(prev => [...prev, { id: `a-${Date.now()}`, role: 'assistant', content: parsed.answer, parsed, fresh: true, debug: isAdmin ? data.debug as Debug : undefined }]);
      loadThreads();
      setAnswered(true); setTimeout(() => setAnswered(false), 1300);
      inputRef.current?.focus();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't get an answer — try again");
      setMessages(prev => prev.slice(0, -1));
      setInput(asked);
    } finally {
      setPending(null);
      setSteps([]);
    }
  };

  const copy = async (text: string, key: string) => {
    try { await navigator.clipboard.writeText(text); setCopied(key); setTimeout(() => setCopied(null), 1500); }
    catch { toast.error('Could not copy'); }
  };

  const save = async (question: string, answer: string) => {
    if (!user) return;
    const { error } = await supabase.from('saved_answers').insert({ question, answer, created_by: user.id });
    if (error) toast.error('Could not save'); else toast.success('Saved — this wording gets reused next time');
  };

  // auto-grow textarea
  useEffect(() => {
    const el = inputRef.current; if (!el) return;
    el.style.height = 'auto'; el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [input]);

  if (authLoading) return null;

  const chatTab = tab === 'chat';
  const convo = messages.length > 0 || !!pending;
  const orbState: OrbState = pending ?? (answered ? 'answered' : 'idle');

  const contextPicker = isAdmin && (
    <div className="flex items-center justify-center gap-1.5 mb-2 text-xs text-[hsl(var(--dan-muted))] w-full max-w-[680px] mx-auto">
      <span className="dan-mono uppercase tracking-[0.15em] text-[10px]">Context</span>
      <select value={memberId} onChange={e => setMemberId(e.target.value)}
        className="dan-chip text-xs focus:outline-none cursor-pointer [&>option]:bg-[hsl(var(--dan-paper))]">
        <option value="">No member (general answer)</option>
        <option value="all">All clients (command centre)</option>
        {members.map(m => <option key={m.id} value={m.id}>{m.full_name ?? m.id}</option>)}
      </select>
    </div>
  );

  const box = (
    <div className="w-full max-w-[680px] mx-auto">
      <div className={`dan-glass dan-ring ${pending ? 'dan-ring-on' : ''} flex items-end gap-2 rounded-[26px] p-2 pl-5 transition-shadow focus-within:shadow-[0_0_0_4px_hsl(var(--dan-violet)/0.14),0_30px_60px_-28px_rgb(90_50_170/0.45)]`}>
        <textarea ref={inputRef} autoFocus rows={1} value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
          placeholder={allClients ? 'Ask about all your clients…' : 'Ask Dan AI'}
          aria-label="Ask Dan AI"
          className="flex-1 !bg-transparent border-0 !shadow-none ring-0 focus:ring-0 focus-visible:ring-0 resize-none text-base leading-6 text-[hsl(var(--dan-ink))] placeholder:text-[hsl(var(--dan-muted))] focus:outline-none py-2" />
        <button onClick={() => send()} disabled={!!pending || !input.trim()} aria-label="Send"
          className="w-10 h-10 shrink-0 rounded-full bg-gradient-to-br from-[hsl(var(--dan-violet))] to-[hsl(var(--dan-cyan))] text-white flex items-center justify-center shadow-[0_0_20px_-2px_hsl(var(--dan-violet))] disabled:opacity-35 disabled:shadow-none transition-opacity">
          {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowUp className="w-5 h-5" />}
        </button>
      </div>
    </div>
  );

  return (
    <PageLayout mainClassName="dan-canvas">
      <NeuralField active={!!pending} />
      <div className="dan-liquid" aria-hidden="true" />
      <div className="dan-grid" aria-hidden="true" />
      <div className="relative min-h-[calc(100vh-6rem)] flex flex-col">
        {/* top bar */}
        <div className="flex items-center justify-between h-10">
          {chatTab ? (
            <div className="flex items-center gap-1">
              <button onClick={() => setHistoryOpen(true)} aria-label="Past chats"
                className="w-9 h-9 rounded-full flex items-center justify-center text-[hsl(var(--dan-muted))] hover:text-[hsl(var(--dan-ink))] hover:bg-[hsl(var(--dan-ink)/0.08)]">
                <History className="w-4 h-4" />
              </button>
              {convo && (
                <button onClick={newThread} aria-label="New chat"
                  className="w-9 h-9 rounded-full flex items-center justify-center text-[hsl(var(--dan-muted))] hover:text-[hsl(var(--dan-ink))] hover:bg-[hsl(var(--dan-ink)/0.08)]">
                  <Plus className="w-4 h-4" />
                </button>
              )}
            </div>
          ) : <span />}
          {isAdmin && (
            <div className="flex rounded-full dan-glass p-0.5 text-xs">
              {(['chat', 'knowledge', 'checks', 'tests'] as Tab[]).map(t => (
                <button key={t} onClick={() => setTab(t)}
                  className={`px-3 py-1 rounded-full capitalize transition-colors ${tab === t ? 'bg-[hsl(var(--dan-violet)/0.35)] text-[hsl(var(--dan-ink))]' : 'text-[hsl(var(--dan-muted))] hover:text-[hsl(var(--dan-ink))]'}`}>
                  {t}
                </button>
              ))}
            </div>
          )}
        </div>

        {tab !== 'chat' && isAdmin && (
          <div className="dark mt-4 rounded-2xl bg-card text-foreground p-4 sm:p-6">
            {tab === 'knowledge' ? <KnowledgeAdmin /> : tab === 'checks' ? <ChecksAdmin /> : <TestsAdmin />}
          </div>
        )}

        {chatTab && !convo && (
          <div className="flex-1 flex flex-col items-center justify-center gap-6 sm:gap-8 pb-[8vh]">
            <div className="w-[260px] h-[260px] sm:w-[400px] sm:h-[400px]"><DanAiOrb state="idle" intro /></div>
            <div className="dan-fade-up w-full">
              {box}
              <div className="mt-3">{contextPicker}</div>
            </div>
          </div>
        )}

        {chatTab && convo && (
          <>
            <div className="sticky top-0 z-10 flex justify-center py-1">
              <div className={`transition-all duration-500 ${pending ? 'w-20 h-20' : 'w-14 h-14'}`}><DanAiOrb state={orbState} /></div>
            </div>

            <div className="flex-1 w-full max-w-[720px] mx-auto space-y-5 py-4">
              {messages.map((m, idx) => m.role === 'user' ? (
                <div key={m.id} className="flex justify-end dan-msg-in">
                  <p className="max-w-[85%] rounded-2xl rounded-br-md px-4 py-2.5 text-[15px] whitespace-pre-wrap dan-glass bg-[hsl(var(--dan-violet)/0.1)]">{m.content}</p>
                </div>
              ) : (
                <div key={m.id} className="group dan-msg-in">
                  {m.parsed && (
                    <AnswerCard a={m.parsed} animate={!!m.fresh} footer={
                      <div className="flex items-center gap-3 flex-wrap pt-1">
                        {!m.parsed.all_clients && m.parsed.context_used === false && (
                          <Link to="/settings" className="text-[11px] text-[hsl(var(--dan-muted))] hover:text-[hsl(var(--dan-ink))] hover:underline">
                            Fill in your Context Room →
                          </Link>
                        )}
                        {isAdmin && (
                          <span className="flex gap-3 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => save(messages[idx - 1]?.content ?? '', m.parsed?.answer ?? '')}
                              className="flex items-center gap-1 text-[11px] text-[hsl(var(--dan-muted))] hover:text-[hsl(var(--dan-ink))]">
                              <BookmarkPlus className="w-3 h-3" /> Save
                            </button>
                            <button onClick={() => copy(m.parsed?.answer ?? '', m.id)}
                              className="flex items-center gap-1 text-[11px] text-[hsl(var(--dan-muted))] hover:text-[hsl(var(--dan-ink))]">
                              {copied === m.id ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />} {copied === m.id ? 'Copied' : 'Copy'}
                            </button>
                          </span>
                        )}
                      </div>
                    } />
                  )}
                  {isAdmin && m.debug && (
                    <details className="mt-2 text-[11px] text-[hsl(var(--dan-muted))] rounded-lg dan-glass px-3 py-2">
                      <summary className="cursor-pointer select-none">Context used</summary>
                      <div className="mt-2 space-y-2">
                        {m.debug.timing && <TimingSummary timing={m.debug.timing} />}
                        <p><b>Mode:</b> {m.debug.mode ?? '–'} · <b>Member ID:</b> {m.debug.member_id ?? 'none'}</p>
                        {m.debug.roster_clients != null && <p><b>Clients read:</b> {m.debug.roster_clients} · {m.debug.roster_words?.toLocaleString()} words</p>}
                        {m.debug.brain && <p><b>Brain:</b> {m.debug.brain_loaded === false ? 'NOT LOADED' : `${m.debug.brain.docs} docs loaded, ${m.debug.brain.words.toLocaleString()} words`}</p>}
                        {m.debug.monthly_totals && <p><b>Monthly totals:</b> {m.debug.monthly_totals.count} found{m.debug.monthly_totals.months.length ? ` (${m.debug.monthly_totals.months.join(', ')})` : ''} · <b>Freshness:</b> {m.debug.data_freshness ?? '–'} · <b>Goal:</b> {m.debug.goal ?? '–'}</p>}
                        {m.debug.context_room && <p><b>Context Room:</b> {m.debug.context_room.fields_filled} fields filled{m.debug.context_room.missing?.length ? ` · missing: ${m.debug.context_room.missing.join(', ')}` : ''}</p>}
                        {m.debug.derived && <div><b>Derived:</b><pre className="whitespace-pre-wrap mt-1">{JSON.stringify(m.debug.derived, null, 2)}</pre></div>}
                        {m.debug.plan != null && <div><b>Plan:</b><pre className="whitespace-pre-wrap mt-1">{JSON.stringify(m.debug.plan, null, 2)}</pre></div>}
                        {(m.debug.passages || m.debug.passage_titles) && (
                          <div><b>Passages ({m.debug.passages?.length ?? m.debug.passage_titles?.length ?? 0}):</b>
                            <ul className="list-disc pl-4">
                              {m.debug.passages?.map((p, i) => <li key={i}>[{p.source_type}] {p.title} — {p.score}</li>)}
                              {!m.debug.passages && m.debug.passage_titles?.map((t, i) => <li key={i}>{t}</li>)}
                            </ul>
                          </div>
                        )}
                        {!!m.debug.checker_issues?.length && <div><b>Checker issues:</b><ul className="list-disc pl-4">{m.debug.checker_issues.map((x, i) => <li key={i}>{x.type}: {x.note}</li>)}</ul></div>}
                        {!!m.debug.guardrails?.length && <div><b>Guardrails:</b><ul className="list-disc pl-4">{m.debug.guardrails.map((x, i) => <li key={i}>{x.note}</li>)}</ul></div>}
                        {m.debug.about_member && <div><b>About this member:</b><pre className="whitespace-pre-wrap font-sans mt-1">{m.debug.about_member}</pre></div>}
                      </div>
                    </details>
                  )}
                </div>
              ))}
              {pending && <div className="dan-msg-in"><ThinkingTrace steps={steps} /></div>}
              <div ref={endRef} />
            </div>
            <div className="sticky bottom-0 pb-4 pt-8 bg-gradient-to-t from-[hsl(var(--dan-bg))] via-[hsl(var(--dan-bg)/0.92)] to-transparent">
              {box}
              <div className="mt-2">{contextPicker}</div>
            </div>
          </>
        )}
      </div>

      <Sheet open={historyOpen} onOpenChange={setHistoryOpen}>
        <SheetContent side="left" className="w-72">
          <SheetHeader><SheetTitle>Past chats</SheetTitle></SheetHeader>
          <button onClick={newThread} className="mt-4 w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold border border-border hover:bg-muted/40">
            <Plus className="w-4 h-4" /> New chat
          </button>
          <div className="mt-3 space-y-1 overflow-y-auto max-h-[75vh]">
            {threads.map(t => (
              <button key={t.id} onClick={() => openThread(t.id)}
                className={`block w-full text-left text-xs px-3 py-2 rounded-lg truncate ${t.id === threadId ? 'bg-primary/15 text-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'}`}>
                {t.title}
              </button>
            ))}
            {!threads.length && <p className="text-xs text-muted-foreground px-3">No chats yet.</p>}
          </div>
        </SheetContent>
      </Sheet>
    </PageLayout>
  );
}

import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import PageLayout from '@/components/PageLayout';
import { useRequireAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { functionErrorMessage } from '@/lib/functionError';
import { resourceCatalogue } from '@/data/resourceCatalogue';
import { ArrowUp, Loader2, Plus, Copy, Check, BookmarkPlus, History } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import DanAiOrb, { type OrbState } from '@/components/DanAiOrb';
import KnowledgeAdmin from '@/components/dan-ai/KnowledgeAdmin';
import ChecksAdmin from '@/components/dan-ai/ChecksAdmin';

interface Answer { answer: string; next_steps: string[]; resource: string | null }
interface Debug {
  about_member: string; member_id: string;
  monthly_totals: { count: number; months: string[] };
  context_room: { found: boolean; fields_filled: number };
  passage_titles: string[];
}
interface Msg { id: string; role: 'user' | 'assistant'; content: string; parsed?: Answer; debug?: Debug }

// "Vault · Workshop · Pay To Play™ (Jul 22)" -> "Pay To Play™ (Jul 22)"; drops roadmap descriptions.
function resourceTitle(r: string) {
  const last = r.split(' · ').pop() ?? r;
  return last.split(' — ')[0].trim();
}
interface Thread { id: string; title: string; at: string }

const FALLBACK_EXAMPLES = [
  'How much should I charge for a monthly retainer?',
  'A client wants to drop their price — do I hold or move?',
  "My ads are getting leads but nobody's booking calls",
  'How do I find and pay my first editor?',
];

function parseAnswer(content: string): Answer {
  try {
    const o = JSON.parse(content);
    if (o && typeof o.answer === 'string') {
      return { answer: o.answer, next_steps: Array.isArray(o.next_steps) ? o.next_steps : [], resource: o.resource ?? null };
    }
  } catch { /* plain text */ }
  return { answer: content, next_steps: [], resource: null };
}

type Tab = 'chat' | 'knowledge' | 'checks';

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
  const [examples, setExamples] = useState<string[]>(FALLBACK_EXAMPLES);
  const [members, setMembers] = useState<{ id: string; full_name: string | null }[]>([]);
  const [memberId, setMemberId] = useState('');
  const [copied, setCopied] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [answered, setAnswered] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!user) return;
    loadThreads();
    supabase.from('suggested_questions').select('question').order('position', { ascending: true })
      .then(({ data }) => { if (data?.length) setExamples(data.map(q => q.question)); });
  }, [user]);

  useEffect(() => {
    if (!isAdmin) return;
    supabase.from('profiles').select('id, full_name').eq('access_revoked', false).is('archived_at', null)
      .order('full_name').then(({ data }) => setMembers(data ?? []));
  }, [isAdmin]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, pending]);

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
    setThreadId(id);
    const { data } = await supabase.from('dan_ai_messages')
      .select('id, role, content').eq('thread_id', id).eq('user_id', user!.id).order('created_at');
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
    const timer = setTimeout(() => setPending(p => (p ? 'checking' : p)), 9000);

    const { data, error } = await supabase.functions.invoke('ask-dan', {
      body: { question: asked, thread_id: threadId, catalogue: resourceCatalogue(), member_id: isAdmin && memberId ? memberId : undefined },
    });
    clearTimeout(timer);
    setPending(null);
    if (error || data?.error) {
      toast.error((await functionErrorMessage(error, data)) ?? "Couldn't get an answer — try again");
      setMessages(prev => prev.slice(0, -1));
      setInput(asked);
      return;
    }
    const parsed: Answer = { answer: data.answer ?? '', next_steps: data.next_steps ?? [], resource: data.resource ?? null };
    setThreadId(data.thread_id);
    setMessages(prev => [...prev, { id: `a-${Date.now()}`, role: 'assistant', content: parsed.answer, parsed, debug: isAdmin ? data.debug : undefined }]);
    loadThreads();
    setAnswered(true); setTimeout(() => setAnswered(false), 1300);
    inputRef.current?.focus();
  };

  const copy = async (text: string, key: string) => {
    try { await navigator.clipboard.writeText(text); setCopied(key); setTimeout(() => setCopied(null), 1500); }
    catch { toast.error('Could not copy'); }
  };

  const save = async (question: string, answer: string) => {
    const { error } = await supabase.from('saved_answers').insert({ question, answer, created_by: user!.id });
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
  const violet = 'hsl(var(--dan-violet))';

  const box = (
    <div className="w-full max-w-[680px] mx-auto">
      {isAdmin && (
        <div className="flex items-center gap-1.5 mb-2 text-xs text-[hsl(var(--dan-muted))]">
          <span>Context from:</span>
          <select value={memberId} onChange={e => setMemberId(e.target.value)}
            className="bg-transparent text-[hsl(var(--dan-ink))] text-xs focus:outline-none cursor-pointer">
            <option value="">Myself</option>
            {members.map(m => <option key={m.id} value={m.id}>{m.full_name ?? m.id}</option>)}
          </select>
        </div>
      )}
      <div className="flex items-end gap-2 rounded-[20px] bg-[hsl(var(--dan-paper))] border border-[hsl(var(--dan-violet)/0.25)] shadow-[0_8px_30px_-12px_hsl(var(--dan-violet)/0.35)] p-2 pl-4 transition-all focus-within:border-[hsl(var(--dan-violet))] focus-within:ring-4 focus-within:ring-[hsl(var(--dan-violet)/0.15)]">
        <textarea ref={inputRef} autoFocus rows={1} value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
          placeholder="What's the actual problem? The more detail, the sharper the answer."
          className="flex-1 bg-transparent border-0 shadow-none ring-0 focus:ring-0 focus-visible:ring-0 resize-none text-base leading-6 text-[hsl(var(--dan-ink))] placeholder:text-[hsl(var(--dan-muted))] focus:outline-none py-2" />
        <button onClick={() => send()} disabled={!!pending || !input.trim()} aria-label="Send"
          className="w-10 h-10 shrink-0 rounded-full bg-[hsl(var(--dan-violet))] text-[hsl(var(--dan-violet-fg))] flex items-center justify-center disabled:opacity-40 transition-opacity">
          {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowUp className="w-5 h-5" />}
        </button>
      </div>
    </div>
  );

  return (
    <PageLayout mainClassName="dan-canvas">
      <div className="relative min-h-[calc(100vh-6rem)] flex flex-col">
        {/* top bar */}
        <div className="flex items-center justify-between h-10">
          {chatTab ? (
            <button onClick={() => setHistoryOpen(true)} aria-label="History"
              className="w-9 h-9 rounded-full flex items-center justify-center text-[hsl(var(--dan-muted))] hover:text-[hsl(var(--dan-ink))] hover:bg-[hsl(var(--dan-ink)/0.06)]">
              <History className="w-4 h-4" />
            </button>
          ) : <span />}
          {isAdmin && (
            <div className="flex rounded-full bg-[hsl(var(--dan-ink)/0.06)] p-0.5 text-xs">
              {(['chat', 'knowledge', 'checks'] as Tab[]).map(t => (
                <button key={t} onClick={() => setTab(t)}
                  className={`px-3 py-1 rounded-full capitalize transition-colors ${tab === t ? 'bg-[hsl(var(--dan-paper))] text-[hsl(var(--dan-ink))] shadow-sm' : 'text-[hsl(var(--dan-muted))]'}`}>
                  {t}
                </button>
              ))}
            </div>
          )}
        </div>

        {tab !== 'chat' && isAdmin && (
          <div className="dark mt-4 rounded-2xl bg-card text-foreground p-4 sm:p-6">
            {tab === 'knowledge' ? <KnowledgeAdmin /> : <ChecksAdmin />}
          </div>
        )}

        {chatTab && (
          <>
            <div className={`mx-auto transition-all duration-700 ease-out ${convo ? 'w-16 h-16 mt-0' : 'w-[220px] h-[220px] sm:w-[320px] sm:h-[320px] mt-6 sm:mt-10'}`}>
              <DanAiOrb state={orbState} intro />
            </div>
            {pending && (
              <p className="text-center text-xs text-[hsl(var(--dan-muted))] mt-1">
                {pending === 'thinking' ? 'Thinking…' : "Checking with Dan's playbook…"}
              </p>
            )}

            {!convo ? (
              <div className="dan-fade-up flex flex-col items-center text-center mt-4">
                <h1 className="text-2xl italic font-extrabold tracking-tight">Dan AI</h1>
                <p className="text-sm text-[hsl(var(--dan-muted))] mt-1 mb-6">Ask me anything about your business.</p>
                {box}
                <div className="flex flex-wrap justify-center gap-2 mt-4 max-w-[680px]">
                  {examples.slice(0, 3).map(ex => (
                    <button key={ex} onClick={() => { setInput(ex); inputRef.current?.focus(); }}
                      className="text-xs px-3 py-1.5 rounded-full border border-[hsl(var(--dan-ink)/0.12)] text-[hsl(var(--dan-muted))] hover:text-[hsl(var(--dan-ink))] transition-colors">
                      {ex}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <>
                <div className="flex-1 w-full max-w-[680px] mx-auto space-y-6 py-6">
                  {messages.map((m, idx) => m.role === 'user' ? (
                    <div key={m.id} className="flex justify-end">
                      <p className="max-w-[85%] bg-[hsl(var(--dan-violet)/0.1)] rounded-2xl rounded-br-md px-4 py-2.5 text-[15px] whitespace-pre-wrap">{m.content}</p>
                    </div>
                  ) : (
                    <div key={m.id} className="group space-y-3">
                      <p className="text-[15px] whitespace-pre-wrap break-words leading-7">{m.parsed?.answer}</p>
                      {!!m.parsed?.next_steps.length && (
                        <ul className="list-disc pl-5 space-y-1 text-[15px] leading-7">
                          {m.parsed.next_steps.map((s, i) => <li key={i}>{s}</li>)}
                        </ul>
                      )}
                      {m.parsed?.resource && (
                        <p className="text-sm" style={{ color: violet }}>Watch: {resourceTitle(m.parsed.resource)}</p>
                      )}
                      {isAdmin && m.debug && (
                        <details className="text-[11px] text-[hsl(var(--dan-muted))] rounded-lg border border-[hsl(var(--dan-ink)/0.1)] px-3 py-2">
                          <summary className="cursor-pointer select-none">Context used</summary>
                          <div className="mt-2 space-y-2">
                            <p><b>Member ID:</b> {m.debug.member_id}</p>
                            <p><b>Monthly totals:</b> {m.debug.monthly_totals.count} found{m.debug.monthly_totals.months.length ? ` (${m.debug.monthly_totals.months.join(', ')})` : ''}</p>
                            <p><b>Context Room:</b> {m.debug.context_room.found ? `found, ${m.debug.context_room.fields_filled} fields filled` : 'not found'}</p>
                            <div><b>Passages ({m.debug.passage_titles.length}):</b>
                              <ul className="list-disc pl-4">{m.debug.passage_titles.map((t, i) => <li key={i}>{t}</li>)}</ul>
                            </div>
                            <div><b>About this member:</b>
                              <pre className="whitespace-pre-wrap font-sans mt-1">{m.debug.about_member}</pre>
                            </div>
                          </div>
                        </details>
                      )}
                      <div className="flex items-center gap-3 flex-wrap">
                        <Link to="/settings" className="text-[11px] text-[hsl(var(--dan-muted))] hover:underline">
                          Personalised using your Context Room, monthly totals and 90-day goal
                        </Link>
                        {isAdmin && (
                          <span className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => save(messages[idx - 1]?.content ?? '', m.parsed!.answer)}
                              className="flex items-center gap-1 text-[11px] text-[hsl(var(--dan-muted))] hover:text-[hsl(var(--dan-ink))]">
                              <BookmarkPlus className="w-3 h-3" /> Save
                            </button>
                            <button onClick={() => copy(m.parsed!.answer, m.id)}
                              className="flex items-center gap-1 text-[11px] text-[hsl(var(--dan-muted))] hover:text-[hsl(var(--dan-ink))]">
                              {copied === m.id ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />} {copied === m.id ? 'Copied' : 'Copy'}
                            </button>
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                  <div ref={endRef} />
                </div>
                <div className="sticky bottom-0 pb-4 pt-8 bg-gradient-to-t from-[hsl(var(--dan-bg))] via-[hsl(var(--dan-bg))] to-transparent">
                  {box}
                </div>
              </>
            )}
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

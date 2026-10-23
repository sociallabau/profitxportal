import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import PageLayout from '@/components/PageLayout';
import { useRequireAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { functionErrorMessage } from '@/lib/functionError';
import { resourceCatalogue } from '@/data/resourceCatalogue';
import { Sparkle, Send, Loader2, ListChecks, PlayCircle, Plus, Copy, Check, BookmarkPlus } from 'lucide-react';
import KnowledgeAdmin from '@/components/dan-ai/KnowledgeAdmin';
import ChecksAdmin from '@/components/dan-ai/ChecksAdmin';

interface Answer { answer: string; next_steps: string[]; resource: string | null }
interface Msg { id: string; role: 'user' | 'assistant'; content: string; parsed?: Answer }
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
    inputRef.current?.focus();
  };

  const newThread = () => { setThreadId(null); setMessages([]); setInput(''); inputRef.current?.focus(); };

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
    setMessages(prev => [...prev, { id: `a-${Date.now()}`, role: 'assistant', content: parsed.answer, parsed }]);
    loadThreads();
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

  if (authLoading) return null;

  const tabs: { id: Tab; label: string }[] = [
    { id: 'chat', label: 'Chat' }, { id: 'knowledge', label: 'Knowledge' }, { id: 'checks', label: 'Checks' },
  ];

  return (
    <PageLayout>
      <div className="mb-5">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center shadow-lg shadow-primary/20">
            <Sparkle className="w-4 h-4 text-primary-foreground" />
          </div>
        </div>
        <h1 className="text-3xl sm:text-4xl font-bold text-foreground italic tracking-tight">Dan AI</h1>
        <p className="text-sm text-muted-foreground mt-1.5 max-w-lg">
          Your on-demand consultant — Dan's playbook, every workshop, call and Q&A, applied to your business.
        </p>
      </div>

      {isAdmin && (
        <div className="flex gap-1 mb-5 border-b border-border">
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${tab === t.id ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>
              {t.label}
            </button>
          ))}
        </div>
      )}

      {tab === 'knowledge' && isAdmin && <KnowledgeAdmin />}
      {tab === 'checks' && isAdmin && <ChecksAdmin />}

      {tab === 'chat' && (
        <div className="flex flex-col lg:flex-row gap-5">
          <aside className="lg:w-56 shrink-0 space-y-1.5">
            <button onClick={newThread} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold border border-border text-foreground hover:bg-muted/40">
              <Plus className="w-4 h-4" /> New chat
            </button>
            <div className="max-h-48 lg:max-h-[60vh] overflow-y-auto space-y-1">
              {threads.map(t => (
                <button key={t.id} onClick={() => openThread(t.id)}
                  className={`block w-full text-left text-xs px-3 py-2 rounded-lg truncate transition-colors ${t.id === threadId ? 'bg-primary/15 text-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'}`}>
                  {t.title}
                </button>
              ))}
            </div>
          </aside>

          <div className="flex-1 min-w-0">
            {isAdmin && (
              <div className="flex items-center gap-2 mb-4 text-xs text-muted-foreground">
                <span>Draft a reply for…</span>
                <select value={memberId} onChange={e => setMemberId(e.target.value)}
                  className="bg-card border border-border rounded-md px-2 py-1 text-foreground text-xs">
                  <option value="">Myself</option>
                  {members.map(m => <option key={m.id} value={m.id}>{m.full_name ?? m.id}</option>)}
                </select>
              </div>
            )}

            <div className="space-y-4 mb-4">
              {messages.length === 0 && !pending && (
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">What people ask most</p>
                  <div className="flex flex-wrap gap-2">
                    {examples.map(ex => (
                      <button key={ex} onClick={() => send(ex)}
                        className="text-xs px-3 py-1.5 rounded-full border border-border text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-all">
                        {ex}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {messages.map((m, idx) => m.role === 'user' ? (
                <div key={m.id} className="flex justify-end">
                  <p className="max-w-[85%] bg-primary text-primary-foreground rounded-2xl rounded-br-md px-4 py-2.5 text-sm whitespace-pre-wrap">{m.content}</p>
                </div>
              ) : (
                <div key={m.id} className="space-y-3">
                  <pre className="text-sm text-foreground whitespace-pre-wrap break-words font-sans leading-relaxed">{m.parsed?.answer}</pre>
                  {!!m.parsed?.next_steps.length && (
                    <div className="border border-primary/25 bg-primary/5 rounded-2xl p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <ListChecks className="w-4 h-4 text-primary" />
                        <span className="text-xs font-semibold uppercase tracking-wider text-primary">Do this next</span>
                      </div>
                      <ol className="space-y-1.5 list-decimal pl-5 text-sm text-foreground">
                        {m.parsed.next_steps.map((s, i) => <li key={i}>{s}</li>)}
                      </ol>
                    </div>
                  )}
                  {m.parsed?.resource && (
                    <div className="flex items-start gap-3 border border-border rounded-2xl p-3">
                      <PlayCircle className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                      <p className="text-sm text-foreground">Watch: {m.parsed.resource} <span className="text-[11px] text-muted-foreground">— in the Vault or on your Roadmap</span></p>
                    </div>
                  )}
                  <div className="flex items-center gap-3 flex-wrap">
                    <Link to="/settings" className="text-[11px] text-muted-foreground hover:text-foreground">
                      Personalised using your Context Room, monthly totals and 90-day goal
                    </Link>
                    {isAdmin && (
                      <>
                        <button onClick={() => save(messages[idx - 1]?.content ?? '', m.parsed!.answer)}
                          className="flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-md border border-border text-muted-foreground hover:text-foreground">
                          <BookmarkPlus className="w-3 h-3" /> Save
                        </button>
                        <button onClick={() => copy(m.parsed!.answer, m.id)}
                          className="flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-md text-primary bg-primary/10 border border-primary/20">
                          {copied === m.id ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />} {copied === m.id ? 'Copied' : 'Copy'}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}

              {pending && (
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {pending === 'thinking' ? 'Thinking…' : "Checking with Dan's playbook…"}
                </p>
              )}
              <div ref={endRef} />
            </div>

            <div className="flex items-end gap-2 border border-border rounded-2xl bg-input/60 p-2 focus-within:ring-2 focus-within:ring-primary/40">
              <textarea ref={inputRef} autoFocus rows={2} value={input} onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
                placeholder="What's the actual problem? The more detail, the sharper the answer."
                className="flex-1 bg-transparent resize-none text-sm text-foreground placeholder:text-muted-foreground focus:outline-none px-2 py-1.5" />
              <button onClick={() => send()} disabled={!!pending || !input.trim()} aria-label="Send"
                className="w-9 h-9 shrink-0 rounded-xl bg-primary text-primary-foreground flex items-center justify-center disabled:opacity-50">
                {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>
      )}
    </PageLayout>
  );
}

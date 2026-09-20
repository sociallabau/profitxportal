import { useEffect, useState } from 'react';
import PageLayout from '@/components/PageLayout';
import { useRequireAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { Sparkles, Loader2, ListChecks, PlayCircle, Clock } from 'lucide-react';
import { resourceCatalogue } from '@/data/resourceCatalogue';

interface Answer {
  answer: string;
  next_steps: string[];
  resource: string | null;
}

interface PastQuestion {
  id: string;
  question: string;
  created_at: string;
}

const EXAMPLES = [
  'How much should I charge for a monthly retainer?',
  'A client wants to drop their price — do I hold or move?',
  "My ads are getting leads but nobody's booking calls",
  'How do I find and pay my first editor?',
];

export default function AskDan() {
  const { user, loading: authLoading } = useRequireAuth();
  const [question, setQuestion] = useState('');
  const [asking, setAsking] = useState(false);
  const [result, setResult] = useState<Answer | null>(null);
  const [recent, setRecent] = useState<PastQuestion[]>([]);

  useEffect(() => {
    if (user) loadRecent();
  }, [user]);

  const loadRecent = async () => {
    const { data } = await supabase
      .from('client_questions')
      .select('id, question, created_at')
      .order('created_at', { ascending: false })
      .limit(6);
    setRecent(data ?? []);
  };

  const handleAsk = async (q?: string) => {
    const asked = (q ?? question).trim();
    if (!asked) return;

    setQuestion(asked);
    setAsking(true);
    setResult(null);

    const { data, error } = await supabase.functions.invoke('ask-dan', {
      body: { question: asked, catalogue: resourceCatalogue() },
    });

    setAsking(false);
    if (error || data?.error) {
      toast.error(data?.error ?? "Couldn't get an answer — try again");
      console.error(error ?? data?.error);
      return;
    }
    setResult({
      answer: data.answer ?? '',
      next_steps: data.next_steps ?? [],
      resource: data.resource ?? null,
    });
    loadRecent();
  };

  if (authLoading) return null;

  const inputCls = "w-full px-3.5 py-2.5 bg-input/60 border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/40 transition-all";

  return (
    <PageLayout>
      <div className="mb-6 sm:mb-8">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center shadow-lg shadow-primary/20">
            <Sparkles className="w-4 h-4 text-primary-foreground" />
          </div>
          <span className="text-[11px] font-semibold tracking-[0.18em] uppercase text-muted-foreground">Ask</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-bold text-foreground italic tracking-tight">Ask Dan</h1>
        <p className="text-sm text-muted-foreground mt-1.5 max-w-lg">
          Every workshop, momentum call and Q&A Dan has run, in one place. Ask anything about your
          offer, pricing, ads, delivery or hiring — you'll get his answer and what to do next.
        </p>
      </div>

      <textarea
        className={`${inputCls} min-h-28 resize-y`}
        placeholder="What's the actual problem? The more detail you give, the sharper the answer."
        value={question}
        onChange={e => setQuestion(e.target.value)}
        onKeyDown={e => {
          if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') handleAsk();
        }}
      />
      <div className="flex items-center gap-3 mt-3">
        <button
          onClick={() => handleAsk()}
          disabled={asking || !question.trim()}
          className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-primary to-primary/80 text-primary-foreground rounded-lg text-sm font-semibold hover:shadow-lg hover:shadow-primary/30 transition-all disabled:opacity-50"
        >
          {asking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          {asking ? 'Thinking…' : 'Ask Dan'}
        </button>
        <span className="text-[11px] text-muted-foreground">⌘ + Enter</span>
      </div>

      {!result && !asking && (
        <div className="mt-6">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
            Try one of these
          </p>
          <div className="flex flex-wrap gap-2">
            {EXAMPLES.map(ex => (
              <button
                key={ex}
                onClick={() => handleAsk(ex)}
                className="text-xs px-3 py-1.5 rounded-full border border-border text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-all"
              >
                {ex}
              </button>
            ))}
          </div>
        </div>
      )}

      {result && (
        <div className="mt-6 space-y-4">
          <div className="border border-border rounded-2xl overflow-hidden">
            <div className="px-4 py-2.5 bg-muted/40 border-b border-border">
              <span className="text-xs font-semibold text-foreground">Dan says</span>
            </div>
            <pre className="px-4 py-4 text-sm text-foreground whitespace-pre-wrap break-words font-sans leading-relaxed">
              {result.answer}
            </pre>
          </div>

          {result.next_steps.length > 0 && (
            <div className="border border-primary/25 bg-primary/5 rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <ListChecks className="w-4 h-4 text-primary" />
                <span className="text-xs font-semibold uppercase tracking-wider text-primary">
                  Do this next
                </span>
              </div>
              <ol className="space-y-2">
                {result.next_steps.map((step, i) => (
                  <li key={i} className="flex gap-2.5 text-sm text-foreground">
                    <span className="shrink-0 w-5 h-5 rounded-full bg-primary/15 text-primary text-[11px] font-bold flex items-center justify-center mt-0.5">
                      {i + 1}
                    </span>
                    <span className="leading-relaxed">{step}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {result.resource && (
            <div className="flex items-start gap-3 border border-border rounded-2xl p-4">
              <PlayCircle className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                  Go deeper
                </p>
                <p className="text-sm text-foreground">{result.resource}</p>
                <p className="text-[11px] text-muted-foreground mt-1">
                  Find it in the Vault or on your Roadmap.
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {recent.length > 0 && (
        <div className="mt-10">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-3.5 h-3.5 text-muted-foreground" />
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              You asked recently
            </p>
          </div>
          <div className="space-y-1.5">
            {recent.map(r => (
              <button
                key={r.id}
                onClick={() => handleAsk(r.question)}
                className="block w-full text-left text-sm text-muted-foreground hover:text-foreground border border-border rounded-xl px-3 py-2 hover:bg-muted/40 transition-all truncate"
              >
                {r.question}
              </button>
            ))}
          </div>
        </div>
      )}
    </PageLayout>
  );
}

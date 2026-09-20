import { useEffect, useState } from 'react';
import PageLayout from '@/components/PageLayout';
import { useRequireAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import {
  Sparkles, Copy, Check, Trash2, Upload, BookmarkPlus, Loader2, FileText, MessageSquare,
  RefreshCw, Clapperboard,
} from 'lucide-react';

interface KnowledgeDoc {
  id: string;
  title: string;
  source_type: string;
  word_count: number;
  created_at: string;
}

interface SavedAnswer {
  id: string;
  question: string;
  answer: string;
  created_at: string;
}

interface TranscriptionJob {
  id: string;
  title: string;
  status: string;
  size_bytes: number | null;
  error: string | null;
}

interface Source {
  title: string;
  source_type: string;
  snippet: string;
}

type Tab = 'ask' | 'saved' | 'knowledge';

const SOURCE_LABELS: Record<string, string> = {
  teaching: 'Momentum / Q&A / Workshop',
  transcript: 'Training',
  call: 'Call',
  whatsapp: 'WhatsApp',
  note: 'Note',
};

/** Splits a document into chunks on paragraph boundaries, with a little overlap. */
function chunkText(text: string, size = 1400, overlap = 200): string[] {
  const clean = text.replace(/\r\n/g, '\n').trim();
  if (clean.length <= size) return clean ? [clean] : [];

  const chunks: string[] = [];
  let start = 0;
  while (start < clean.length) {
    let end = Math.min(start + size, clean.length);
    if (end < clean.length) {
      const breakAt = clean.lastIndexOf('\n\n', end);
      if (breakAt > start + size * 0.5) end = breakAt;
    }
    const piece = clean.slice(start, end).trim();
    if (piece) chunks.push(piece);
    if (end >= clean.length) break;
    start = Math.max(end - overlap, start + 1);
  }
  return chunks;
}

export default function DanAI() {
  const { user, loading: authLoading } = useRequireAuth();
  const [tab, setTab] = useState<Tab>('ask');

  const [question, setQuestion] = useState('');
  const [asking, setAsking] = useState(false);
  const [answer, setAnswer] = useState('');
  const [sources, setSources] = useState<Source[]>([]);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const [docs, setDocs] = useState<KnowledgeDoc[]>([]);
  const [savedAnswers, setSavedAnswers] = useState<SavedAnswer[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');
  const [jobs, setJobs] = useState<TranscriptionJob[]>([]);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    if (user) {
      loadDocs();
      loadSaved();
      loadJobs();
    }
  }, [user]);

  const loadDocs = async () => {
    const { data } = await supabase
      .from('knowledge_docs')
      .select('id, title, source_type, word_count, created_at')
      .order('created_at', { ascending: false });
    setDocs(data ?? []);
  };

  const loadSaved = async () => {
    const { data } = await supabase
      .from('saved_answers')
      .select('id, question, answer, created_at')
      .order('created_at', { ascending: false });
    setSavedAnswers(data ?? []);
  };

  const loadJobs = async () => {
    const { data } = await supabase
      .from('transcription_jobs')
      .select('id, title, status, size_bytes, error')
      .order('created_at', { ascending: false })
      .limit(50);
    setJobs(data ?? []);
  };

  const handleSyncDrive = async () => {
    setSyncing(true);
    const { data, error } = await supabase.functions.invoke('drive-sync', { body: {} });
    setSyncing(false);

    if (error || data?.error) {
      toast.error(data?.error ?? 'Drive sync failed');
      console.error(error ?? data?.error);
      return;
    }
    const { ingested = 0, queued = 0, remaining = 0 } = data ?? {};
    toast.success(
      ingested || queued
        ? `Added ${ingested} transcript${ingested === 1 ? '' : 's'}${queued ? `, queued ${queued} video${queued === 1 ? '' : 's'}` : ''}${remaining ? ` · ${remaining} still to go` : ''}`
        : 'Nothing new in Drive',
    );
    if (data?.errors?.length) console.warn('drive-sync issues', data.errors);
    loadDocs();
    loadJobs();
  };

  const copyText = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(c => (c === key ? null : c)), 1500);
    } catch {
      toast.error('Could not copy — select the text and copy it manually');
    }
  };

  const handleAsk = async () => {
    if (!question.trim()) return;
    setAsking(true);
    setAnswer('');
    setSources([]);

    const { data, error } = await supabase.functions.invoke('dan-ai', {
      body: { question: question.trim() },
    });

    setAsking(false);
    if (error) {
      toast.error('Could not get an answer');
      console.error(error);
      return;
    }
    if (data?.error) {
      toast.error(data.error);
      return;
    }
    setAnswer(data.answer ?? '');
    setSources(data.sources ?? []);
  };

  const handleSaveAnswer = async () => {
    if (!answer.trim() || !question.trim()) return;
    const { error } = await supabase.from('saved_answers').insert({
      question: question.trim(),
      answer: answer.trim(),
    });
    if (error) {
      toast.error('Could not save');
      return;
    }
    toast.success('Saved — this wording gets reused next time');
    loadSaved();
  };

  const handleUpload = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);

    let added = 0;
    for (const file of Array.from(files)) {
      try {
        setUploadProgress(`Reading ${file.name}…`);
        const text = await file.text();
        const chunks = chunkText(text);
        if (!chunks.length) continue;

        const sourceType = /whatsapp|chat/i.test(file.name)
          ? 'whatsapp'
          : /call|meeting|momentum|q&a/i.test(file.name)
            ? 'call'
            : 'transcript';

        const { data: doc, error: docError } = await supabase
          .from('knowledge_docs')
          .insert({
            title: file.name.replace(/\.(txt|md)$/i, ''),
            source_type: sourceType,
            word_count: text.split(/\s+/).length,
          })
          .select('id')
          .single();

        if (docError || !doc) throw docError;

        setUploadProgress(`Saving ${chunks.length} passages from ${file.name}…`);
        for (let i = 0; i < chunks.length; i += 100) {
          const batch = chunks.slice(i, i + 100).map((content, j) => ({
            doc_id: doc.id,
            chunk_index: i + j,
            content,
          }));
          const { error: chunkError } = await supabase.from('knowledge_chunks').insert(batch);
          if (chunkError) throw chunkError;
        }
        added += 1;
      } catch (err) {
        console.error(err);
        toast.error(`Failed on ${file.name}`);
      }
    }

    setUploading(false);
    setUploadProgress('');
    if (added) toast.success(`Added ${added} document${added === 1 ? '' : 's'}`);
    loadDocs();
  };

  const handleDeleteDoc = async (id: string) => {
    if (!confirm('Remove this document from the knowledge base?')) return;
    await supabase.from('knowledge_docs').delete().eq('id', id);
    setDocs(prev => prev.filter(d => d.id !== id));
  };

  const handleDeleteSaved = async (id: string) => {
    if (!confirm('Delete this saved answer?')) return;
    await supabase.from('saved_answers').delete().eq('id', id);
    setSavedAnswers(prev => prev.filter(s => s.id !== id));
  };

  if (authLoading) return null;

  const totalWords = docs.reduce((sum, d) => sum + (d.word_count || 0), 0);
  const inputCls = "w-full px-3.5 py-2.5 bg-input/60 border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/40 transition-all";

  const tabs: { id: Tab; label: string }[] = [
    { id: 'ask', label: 'Ask' },
    { id: 'saved', label: `Saved answers (${savedAnswers.length})` },
    { id: 'knowledge', label: `Knowledge (${docs.length})` },
  ];

  return (
    <PageLayout>
      {/* Header */}
      <div className="mb-6 sm:mb-8">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center shadow-lg shadow-primary/20">
            <Sparkles className="w-4 h-4 text-primary-foreground" />
          </div>
          <span className="text-[11px] font-semibold tracking-[0.18em] uppercase text-muted-foreground">Admin</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-bold text-foreground italic tracking-tight">Dan AI</h1>
        <p className="text-sm text-muted-foreground mt-1.5 max-w-lg">
          Ask a client question and get the answer in Dan's words, built from his trainings, calls and messages.
          {totalWords > 0 && ` Currently drawing on ${totalWords.toLocaleString()} words.`}
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-border">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === t.id
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'ask' && (
        <div className="space-y-5">
          <div>
            <textarea
              className={`${inputCls} min-h-24 resize-y`}
              placeholder="Paste the client's question here — e.g. how much should I charge for a monthly retainer?"
              value={question}
              onChange={e => setQuestion(e.target.value)}
              onKeyDown={e => {
                if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') handleAsk();
              }}
            />
            <div className="flex items-center gap-3 mt-3">
              <button
                onClick={handleAsk}
                disabled={asking || !question.trim()}
                className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-primary to-primary/80 text-primary-foreground rounded-lg text-sm font-semibold hover:shadow-lg hover:shadow-primary/30 transition-all disabled:opacity-50"
              >
                {asking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                {asking ? 'Thinking…' : 'Get the answer'}
              </button>
              <span className="text-[11px] text-muted-foreground">⌘ + Enter</span>
            </div>
          </div>

          {answer && (
            <div className="border border-border rounded-2xl overflow-hidden">
              <div className="flex items-center justify-between gap-2 px-4 py-2.5 bg-muted/40 border-b border-border">
                <span className="text-xs font-semibold text-foreground">Dan's reply</span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleSaveAnswer}
                    className="flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-all"
                    title="Reuse this wording next time"
                  >
                    <BookmarkPlus className="w-3 h-3" />
                    Save
                  </button>
                  <button
                    onClick={() => copyText(answer, 'answer')}
                    className="flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-lg text-primary bg-primary/10 border border-primary/20 hover:bg-primary/20 transition-all"
                  >
                    {copiedKey === 'answer' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    {copiedKey === 'answer' ? 'Copied' : 'Copy'}
                  </button>
                </div>
              </div>
              <pre className="px-4 py-4 text-sm text-foreground whitespace-pre-wrap break-words font-sans leading-relaxed">
                {answer}
              </pre>
            </div>
          )}

          {sources.length > 0 && (
            <div>
              <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                Where this came from
              </h3>
              <div className="space-y-2">
                {sources.map((s, i) => (
                  <div key={i} className="border border-border rounded-xl px-3 py-2.5">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/15 text-primary border border-primary/20">
                        {SOURCE_LABELS[s.source_type] ?? s.source_type}
                      </span>
                      <span className="text-xs font-medium text-foreground truncate">{s.title}</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground line-clamp-2">{s.snippet}…</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {docs.length === 0 && (
            <div className="text-center py-10 border border-dashed border-border rounded-2xl">
              <p className="text-sm text-muted-foreground">Nothing in the knowledge base yet.</p>
              <button
                onClick={() => setTab('knowledge')}
                className="mt-2 text-sm font-semibold text-primary hover:underline"
              >
                Add your transcripts
              </button>
            </div>
          )}
        </div>
      )}

      {tab === 'saved' && (
        <div className="space-y-3">
          {savedAnswers.length === 0 && (
            <p className="text-sm text-muted-foreground py-8 text-center">
              No saved answers yet. When an answer comes out right, hit Save — it gets reused next time.
            </p>
          )}
          {savedAnswers.map(s => (
            <div key={s.id} className="border border-border rounded-2xl overflow-hidden">
              <div className="flex items-start justify-between gap-2 px-4 py-2.5 bg-muted/40 border-b border-border">
                <div className="flex items-start gap-2 min-w-0">
                  <MessageSquare className="w-3.5 h-3.5 text-muted-foreground mt-0.5 shrink-0" />
                  <span className="text-xs font-semibold text-foreground">{s.question}</span>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => copyText(s.answer, `saved-${s.id}`)}
                    className="text-muted-foreground hover:text-foreground p-1.5 rounded-lg hover:bg-muted/60"
                    aria-label="Copy answer"
                  >
                    {copiedKey === `saved-${s.id}` ? <Check className="w-3.5 h-3.5 text-primary" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                  <button
                    onClick={() => handleDeleteSaved(s.id)}
                    className="text-muted-foreground hover:text-destructive p-1.5 rounded-lg hover:bg-destructive/10"
                    aria-label="Delete"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              <pre className="px-4 py-3 text-sm text-foreground whitespace-pre-wrap break-words font-sans leading-relaxed">
                {s.answer}
              </pre>
            </div>
          ))}
        </div>
      )}

      {tab === 'knowledge' && (
        <div className="space-y-5">
          <div className="border border-dashed border-border rounded-2xl p-5 text-center">
            <Upload className="w-5 h-5 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-foreground font-medium mb-1">Add transcripts, notes or WhatsApp exports</p>
            <p className="text-xs text-muted-foreground mb-3">
              Plain text or markdown files. Everything stays private to the admin panel.
            </p>
            <label className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-primary to-primary/80 text-primary-foreground rounded-lg text-sm font-semibold hover:shadow-lg hover:shadow-primary/30 transition-all cursor-pointer">
              {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              {uploading ? 'Adding…' : 'Choose files'}
              <input
                type="file"
                accept=".txt,.md,text/plain,text/markdown"
                multiple
                disabled={uploading}
                className="hidden"
                onChange={e => {
                  handleUpload(e.target.files);
                  e.target.value = '';
                }}
              />
            </label>
            {uploadProgress && (
              <p className="text-[11px] text-muted-foreground mt-2">{uploadProgress}</p>
            )}
          </div>

          <div className="flex items-center justify-between gap-3 border border-border rounded-2xl px-4 py-3">
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">Google Drive</p>
              <p className="text-xs text-muted-foreground">
                Pulls the transcript out of each Gemini notes doc. Runs in batches — click again if more are waiting.
              </p>
            </div>
            <button
              onClick={handleSyncDrive}
              disabled={syncing}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold border border-border text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-all disabled:opacity-50 shrink-0"
            >
              {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              {syncing ? 'Syncing…' : 'Sync now'}
            </button>
          </div>

          {jobs.length > 0 && (
            <div>
              <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                Videos waiting to be transcribed ({jobs.filter(j => j.status === 'pending').length})
              </h3>
              <div className="space-y-2">
                {jobs.slice(0, 10).map(job => (
                  <div key={job.id} className="flex items-center gap-3 border border-border rounded-xl px-3 py-2.5">
                    <Clapperboard className="w-4 h-4 text-muted-foreground shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground truncate">{job.title}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {job.status}
                        {job.size_bytes ? ` · ${(job.size_bytes / 1_000_000_000).toFixed(2)} GB` : ''}
                        {job.error ? ` · ${job.error}` : ''}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-2">
            {docs.map(doc => (
              <div key={doc.id} className="flex items-center gap-3 border border-border rounded-xl px-3 py-2.5">
                <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground truncate">{doc.title}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {SOURCE_LABELS[doc.source_type] ?? doc.source_type} · {doc.word_count.toLocaleString()} words
                  </p>
                </div>
                <button
                  onClick={() => handleDeleteDoc(doc.id)}
                  className="text-muted-foreground hover:text-destructive p-1.5 rounded-lg hover:bg-destructive/10 shrink-0"
                  aria-label="Remove"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </PageLayout>
  );
}

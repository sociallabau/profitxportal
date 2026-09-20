import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { Upload, Loader2, FileSpreadsheet, Trash2, ChevronDown } from 'lucide-react';

/**
 * Pulls the text out of a PDF in the browser. pdf.js is a heavy library and
 * most uploads are CSVs, so it is only fetched when someone actually picks a
 * PDF — the rest of the app never pays for it.
 */
async function extractPdfText(file: File): Promise<string> {
  const pdfjs = await import('pdfjs-dist');
  pdfjs.GlobalWorkerOptions.workerSrc = (
    await import('pdfjs-dist/build/pdf.worker.min.mjs?url')
  ).default;

  const doc = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
  const pages: string[] = [];

  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const text = content.items
      .map(item => ('str' in item ? item.str : ''))
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (text) pages.push(text);
  }

  return pages.join('\n\n');
}

type Kind = 'pnl' | 'ads';

interface Audit {
  id: string;
  kind: string;
  filename: string | null;
  period: string | null;
  audit: string | null;
  created_at: string;
}

const KINDS: { id: Kind; label: string; hint: string }[] = [
  {
    id: 'pnl',
    label: 'P&L',
    hint: 'Export it from Xero, MYOB or QuickBooks as PDF or CSV, or paste the numbers straight in.',
  },
  {
    id: 'ads',
    label: 'Ad tracking',
    hint: 'Your ad tracking sheet as CSV or PDF — spend, leads, calls booked, calls showed, closes.',
  },
];

export default function FinancialAudit() {
  const [kind, setKind] = useState<Kind>('pnl');
  const [text, setText] = useState('');
  const [filename, setFilename] = useState<string | null>(null);
  const [period, setPeriod] = useState('');
  const [running, setRunning] = useState(false);
  const [reading, setReading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [history, setHistory] = useState<Audit[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => { loadHistory(); }, []);

  const loadHistory = async () => {
    const { data } = await supabase
      .from('financial_audits')
      .select('id, kind, filename, period, audit, created_at')
      .order('created_at', { ascending: false })
      .limit(10);
    setHistory(data ?? []);
  };

  const handleFile = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;

    const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
    if (file.size > (isPdf ? 15_000_000 : 2_000_000)) {
      toast.error('That file is huge — export just the summary and try again');
      return;
    }

    setReading(true);
    try {
      const contents = isPdf ? await extractPdfText(file) : await file.text();

      if (contents.trim().length < 40) {
        toast.error(
          isPdf
            ? "That PDF has no readable text — it's probably a scan. Export it as CSV, or paste the numbers in below."
            : "That file looks empty — check the export and try again",
        );
        return;
      }

      setText(contents);
      setFilename(file.name);
      setResult(null);
    } catch (err) {
      console.error(err);
      toast.error(
        isPdf
          ? "Couldn't read that PDF — try exporting as CSV instead"
          : "Couldn't read that file — export it as CSV",
      );
    } finally {
      setReading(false);
    }
  };

  const handleRun = async () => {
    if (text.trim().length < 40) {
      toast.error('Upload a file or paste your numbers first');
      return;
    }
    setRunning(true);
    setResult(null);

    const { data, error } = await supabase.functions.invoke('audit-financials', {
      body: { kind, filename, period: period || null, text },
    });

    setRunning(false);
    if (error || data?.error) {
      toast.error(data?.error ?? "Couldn't run the audit — try again");
      console.error(error ?? data?.error);
      return;
    }
    setResult(data.audit ?? '');
    loadHistory();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this audit?')) return;
    await supabase.from('financial_audits').delete().eq('id', id);
    setHistory(prev => prev.filter(h => h.id !== id));
  };

  const inputCls = "w-full px-4 py-2.5 bg-input border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 transition";
  const active = KINDS.find(k => k.id === kind)!;

  return (
    <div className="mt-8 bg-card border border-border rounded-xl p-5">
      <h3 className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Get it audited</h3>
      <p className="text-sm text-muted-foreground mb-4 max-w-xl">
        Upload your numbers and get Dan's read on them — where the money's actually going and
        the two or three things worth changing.
      </p>

      <div className="flex gap-1 mb-4">
        {KINDS.map(k => (
          <button
            key={k.id}
            onClick={() => { setKind(k.id); setResult(null); }}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              kind === k.id
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
            }`}
          >
            {k.label}
          </button>
        ))}
      </div>

      <p className="text-xs text-muted-foreground mb-3">{active.hint}</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
        <label className="flex items-center justify-center gap-2 px-4 py-2.5 border border-dashed border-border rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-muted/40 cursor-pointer transition">
          {reading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
          {reading ? 'Reading the file…' : (filename ?? 'Choose a PDF or CSV')}
          <input
            type="file"
            accept=".csv,.tsv,.txt,.pdf,text/csv,text/plain,application/pdf"
            disabled={reading}
            className="hidden"
            onChange={e => { handleFile(e.target.files); e.target.value = ''; }}
          />
        </label>
        <input
          className={inputCls}
          placeholder="Which period? e.g. August 2026"
          value={period}
          onChange={e => setPeriod(e.target.value)}
        />
      </div>

      <textarea
        className={`${inputCls} min-h-28 resize-y font-mono text-xs`}
        placeholder="…or paste the numbers here"
        value={text}
        onChange={e => { setText(e.target.value); setFilename(null); }}
      />

      <button
        onClick={handleRun}
        disabled={running || text.trim().length < 40}
        className="mt-3 flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-primary to-primary/80 text-primary-foreground rounded-lg text-sm font-semibold hover:shadow-lg hover:shadow-primary/30 transition-all disabled:opacity-50"
      >
        {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileSpreadsheet className="w-4 h-4" />}
        {running ? 'Reading your numbers…' : 'Audit it'}
      </button>

      {result && (
        <div className="mt-5 border border-border rounded-xl overflow-hidden">
          <div className="px-4 py-2.5 bg-muted/40 border-b border-border">
            <span className="text-xs font-semibold text-foreground">Dan's read</span>
          </div>
          <pre className="px-4 py-4 text-sm text-foreground whitespace-pre-wrap break-words font-sans leading-relaxed">
            {result}
          </pre>
        </div>
      )}

      {history.length > 0 && (
        <div className="mt-6">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
            Previous audits
          </p>
          <div className="space-y-2">
            {history.map(h => (
              <div key={h.id} className="border border-border rounded-xl overflow-hidden">
                <div className="flex items-center gap-2 px-3 py-2.5">
                  <button
                    onClick={() => setOpenId(openId === h.id ? null : h.id)}
                    className="flex items-center gap-2 min-w-0 flex-1 text-left"
                  >
                    <ChevronDown className={`w-3.5 h-3.5 text-muted-foreground shrink-0 transition-transform ${openId === h.id ? 'rotate-180' : ''}`} />
                    <span className="text-sm text-foreground truncate">
                      {h.kind === 'ads' ? 'Ad tracking' : 'P&L'}
                      {h.period ? ` · ${h.period}` : ''}
                      {h.filename ? ` · ${h.filename}` : ''}
                    </span>
                    <span className="text-[11px] text-muted-foreground shrink-0 ml-auto">
                      {new Date(h.created_at).toLocaleDateString()}
                    </span>
                  </button>
                  <button
                    onClick={() => handleDelete(h.id)}
                    className="text-muted-foreground hover:text-destructive p-1 rounded shrink-0"
                    aria-label="Delete audit"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
                {openId === h.id && h.audit && (
                  <pre className="px-4 py-3 border-t border-border text-sm text-foreground whitespace-pre-wrap break-words font-sans leading-relaxed">
                    {h.audit}
                  </pre>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

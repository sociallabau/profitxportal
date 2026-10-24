import type { CSSProperties, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, PlayCircle, ShieldCheck, ScanSearch } from 'lucide-react';
import { resourceLink } from '@/data/resourceCatalogue';

export interface Point { do: string; why: string }
/** What an answer was built from: the member's own data and counts only (see buildSources in ask-dan). */
export interface Sources {
  months?: number; latest_month?: string | null; gate?: string | null;
  build?: { done: number; total: number } | null; context_fields?: number; memory?: boolean;
  passages?: number; library?: { workshops: number; calls: number; notes: number };
  checks?: number; rules?: number; noticed?: string[]; clients?: number;
}
export interface Answer {
  answer: string; points: Point[]; note: string | null; resource: string | null;
  context_used?: boolean; sources?: Sources; all_clients?: boolean;
  /** Why this member should watch the prescribed session. */
  resource_why?: string | null;
  /** A next action button, e.g. the Monthly Check-In when their numbers are old. */
  cta?: { label: string; href: string } | null;
}

const monthName = (m?: string | null) => m ? new Date(`${m.slice(0, 7)}-01T12:00:00`).toLocaleDateString('en-AU', { month: 'short' }) : null;

/** The recording Dan AI prescribes, with its workbook and templates. */
function Prescription({ line, why }: { line: string; why?: string | null }) {
  const r = resourceLink(line);
  const body = (
    <>
      <span className="w-10 h-10 shrink-0 rounded-xl flex items-center justify-center bg-gradient-to-br from-[hsl(var(--dan-violet))] to-[hsl(var(--dan-cyan))] shadow-[0_0_24px_-4px_hsl(var(--dan-violet))]">
        <PlayCircle className="w-5 h-5 text-white" />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold truncate">{r.title}</span>
        {why && <span className="block text-[12px] leading-4 text-[hsl(var(--dan-muted))] mt-0.5">Why watch: {why}</span>}
      </span>
    </>
  );
  const cls = 'flex items-center gap-3 rounded-xl px-3 py-2.5 dan-glass hover:border-[hsl(var(--dan-cyan)/0.5)] transition-colors';
  return (
    <div className="space-y-1.5">
      {!r.href ? <div className={cls}>{body}</div>
        : r.external ? <a href={r.href} target="_blank" rel="noreferrer" className={cls}>{body}</a>
        : <Link to={r.href} className={cls}>{body}</Link>}
      {r.extras.length > 0 && (
        <p className="text-xs text-[hsl(var(--dan-muted))] pl-1">
          {r.extras.map((x, i) => <span key={x.url}>{i > 0 && ' · '}<a href={x.url} target="_blank" rel="noreferrer" className="hover:text-[hsl(var(--dan-ink))] underline-offset-2 hover:underline">{x.label}</a></span>)}
        </p>
      )}
    </div>
  );
}

/** "Under the hood": short chips for what this answer read and checked (their own data and counts only). */
function UnderTheHood({ s }: { s: Sources }) {
  const chips: string[] = [];
  if (s.clients) chips.push(`${s.clients} clients`);
  if (s.months) chips.push(`${s.months} mo numbers`);
  if (s.build) chips.push(`Build ${s.build.done}/${s.build.total}`);
  if (s.memory) chips.push('Your history');
  if (s.passages) chips.push(`${s.passages} Dan sessions`);
  chips.push(s.checks ? `${s.checks} checks fixed` : 'Checked');
  return (
    <div className="flex flex-wrap items-center gap-1.5 pt-1">
      <ShieldCheck className="w-3.5 h-3.5 text-[hsl(var(--dan-cyan))]" aria-label="Under the hood" />
      {chips.map(c => <span key={c} className="dan-chip text-[10px] py-0.5 px-2">{c}</span>)}
    </div>
  );
}

export default function AnswerCard({ a, animate, footer }: { a: Answer; animate: boolean; footer?: ReactNode }) {
  const words = a.answer.split(/(\s+)/);
  const noticed = a.sources?.noticed ?? [];
  return (
    <div className="dan-glass rounded-[24px] p-5 sm:p-6 space-y-4">
      <p className="text-lg sm:text-xl font-semibold leading-snug tracking-tight whitespace-pre-wrap break-words">
        {animate ? words.map((w, i) => /^\s+$/.test(w) ? w : <span key={i} className="dan-word" style={{ '--i': i / 2 } as CSSProperties}>{w}</span>) : a.answer}
      </p>

      {noticed.length > 0 && (
        <div className={`rounded-xl border border-[hsl(var(--dan-cyan)/0.25)] bg-[hsl(var(--dan-cyan)/0.06)] px-3 py-2.5 ${animate ? 'dan-move' : ''}`} style={{ '--i': 0 } as CSSProperties}>
                    <ul className="text-[13px] leading-5 text-[hsl(var(--dan-ink)/0.9)] space-y-0.5">
            {noticed.map(n => <li key={n} className="flex gap-2"><ScanSearch className="w-3.5 h-3.5 mt-0.5 shrink-0 text-[hsl(var(--dan-cyan))]" />{n}</li>)}
          </ul>
        </div>
      )}

      {a.points.length > 0 && (
        <ol className="space-y-2.5">
          {a.points.map((pt, i) => (
            <li key={i} className={`flex gap-3.5 rounded-xl px-3.5 py-3 bg-white/[0.035] border border-white/10 ${animate ? 'dan-move' : ''}`} style={{ '--i': i + 1 } as CSSProperties}>
              <span className="dan-num text-lg font-bold leading-6 w-7 shrink-0">{String(i + 1).padStart(2, '0')}</span>
              <span className="min-w-0 text-[15px] leading-6">
                <span className="font-medium">{pt.do}</span>
                {pt.why && <span className="block text-[13px] leading-5 text-[hsl(var(--dan-muted))] mt-0.5">{pt.why}</span>}
              </span>
            </li>
          ))}
        </ol>
      )}

      {a.note && <p className="text-[13px] leading-5 text-[hsl(var(--dan-muted))] border-l-2 border-[hsl(var(--dan-violet)/0.6)] pl-3">{a.note}</p>}
      {a.cta && (
        <Link to={a.cta.href} className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white bg-gradient-to-br from-[hsl(var(--dan-violet))] to-[hsl(var(--dan-cyan))] shadow-[0_0_24px_-6px_hsl(var(--dan-violet))] hover:brightness-110 transition">
          {a.cta.label}<ArrowRight className="w-4 h-4" />
        </Link>
      )}
      {a.resource && <Prescription line={a.resource} why={a.resource_why} />}
      {a.sources && <UnderTheHood s={a.sources} />}
      {footer}
    </div>
  );
}

import { useEffect, useState } from 'react';
import { Check, Loader2 } from 'lucide-react';

/**
 * The live trace while Dan AI works: each status the server streams becomes a
 * step that scans in and ticks off when the next one starts; only the latest three show.
 */
export default function ThinkingTrace({ steps }: { steps: string[] }) {
  const [started] = useState(() => performance.now());
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setElapsed((performance.now() - started) / 1000), 100);
    return () => clearInterval(id);
  }, [started]);

  return (
    <div className="dan-glass dan-ring dan-ring-on rounded-2xl px-4 py-3.5 w-full max-w-[680px] mx-auto" role="status" aria-live="polite">
      <div className="flex items-center justify-between mb-2.5">
        <span className="w-1.5 h-1.5 rounded-full bg-[hsl(var(--dan-cyan))] shadow-[0_0_8px_hsl(var(--dan-cyan))] animate-pulse" />
        <span className="dan-mono text-[11px] tabular-nums text-[hsl(var(--dan-muted))]">{elapsed.toFixed(1)}s</span>
      </div>
      <ol className="space-y-1.5">
        {steps.slice(-3).map((s, i, shown) => {
          const live = i === shown.length - 1;
          return (
            <li key={s} className="dan-step flex items-start gap-2.5 text-[13px] leading-5">
              <span className={`mt-0.5 w-4 h-4 shrink-0 rounded-full flex items-center justify-center ${live ? 'text-[hsl(var(--dan-cyan))]' : 'bg-[hsl(var(--dan-violet)/0.25)] text-[hsl(var(--dan-ink))]'}`}>
                {live ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-2.5 h-2.5" />}
              </span>
              <span className={live ? 'text-[hsl(var(--dan-ink))]' : 'text-[hsl(var(--dan-muted))]'}>{s}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

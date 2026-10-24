import { Check, Lock } from 'lucide-react';
import { ROMAN, type GateNumber, type PlaybookGate } from '@/lib/playbook';

type State = 'done' | 'current' | 'locked';
const stateOf = (gate: number, current: number): State => gate < current ? 'done' : gate === current ? 'current' : 'locked';

// Deterministic sparkle field around the current gate (no randomness between renders).
const SPARKS = Array.from({ length: 42 }, (_, i) => {
  const angle = (i * 137.5 * Math.PI) / 180;
  const radius = 58 + ((i * 29) % 46);
  return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius * 0.62, size: 1.5 + (i % 3) * 0.8, opacity: 0.3 + ((i * 7) % 10) / 16 };
});

function Orb({ gate, state, size }: { gate: GateNumber; state: State; size: 'lg' | 'md' | 'sm' }) {
  const px = { lg: 'w-28 h-28 sm:w-36 sm:h-36 text-4xl sm:text-5xl', md: 'w-20 h-20 text-3xl', sm: 'w-14 h-14 text-xl' }[size];
  if (state === 'locked') {
    return (
      <div className={`${px} rounded-full grid place-items-center glass border-dashed !border-primary/30 grayscale text-muted-foreground`}>
        <Lock className="w-1/3 h-1/3 opacity-60" />
      </div>
    );
  }
  const current = state === 'current';
  const spread = size === 'lg' ? 1.25 : 0.7;
  return (
    <div className="relative grid place-items-center">
      {current && (
        <>
          <div className="absolute -inset-8 rounded-full border border-dashed border-primary/30" style={{ animation: 'spin-slow 40s linear infinite' }} aria-hidden />
          <div className="absolute inset-0 pointer-events-none" style={{ animation: 'spin-slow 60s linear infinite' }} aria-hidden>
            {SPARKS.map((s, i) => (
              <span key={i} className="absolute left-1/2 top-1/2 rounded-full bg-primary"
                style={{ width: s.size, height: s.size, opacity: s.opacity, transform: `translate(${s.x * spread}px, ${s.y * spread}px)` }} />
            ))}
          </div>
        </>
      )}
      <div
        className={`${px} relative rounded-full grid place-items-center text-white font-black italic`}
        style={{
          background: 'radial-gradient(circle at 34% 28%, #fff 0%, #dcc8ff 20%, #9b5cff 55%, #4b17b0 100%)',
          animation: current ? 'orb-float 5s ease-in-out infinite, orb-pulse 4s ease-in-out infinite' : undefined,
          boxShadow: current ? undefined : '0 16px 34px -10px rgb(133 54 245 / 0.7)',
        }}
      >
        {state === 'done' && size === 'sm' ? <Check className="w-1/3 h-1/3" strokeWidth={3} /> : ROMAN[gate]}
      </div>
    </div>
  );
}

function Label({ g, state, align = 'center' }: { g: PlaybookGate; state: State; align?: 'center' | 'left' }) {
  return (
    <div className={align === 'center' ? 'text-center' : 'text-left'}>
      <p className={`mono-label text-[10px] font-bold ${state === 'locked' ? 'text-muted-foreground/60' : 'text-primary'}`}>
        {state === 'done' ? 'Cleared' : state === 'current' ? "You're here" : 'Locked'}
      </p>
      <p className={`font-black italic tracking-tight ${state === 'current' ? 'text-3xl sm:text-4xl' : 'text-2xl'} ${state === 'locked' ? 'text-muted-foreground/50' : 'text-foreground'}`}>{g.name}</p>
      <span className={`inline-block whitespace-nowrap mt-1.5 mono-label text-[10px] font-bold px-3 py-1.5 rounded-full ${state === 'current' ? 'violet-grad text-white shadow-[0_10px_24px_-8px_rgb(133_54_245/0.8)]' : 'glass-tile text-muted-foreground'}`}>
        {g.headline}
      </span>
    </div>
  );
}

/** The level-select map: a winding path on desktop, a vertical trail on mobile. */
export default function LevelMap({ gates, current }: { gates: PlaybookGate[]; current: GateNumber }) {
  const xs = [9, 37, 65, 90];
  const ys = [60, 46, 60, 42];
  const lit = xs[current - 1] / 100;
  return (
    <>
      <div className="relative hidden md:block h-[360px]">
        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
          <defs>
            <linearGradient id="pb-path" x1="0" x2="1">
              <stop offset="0" stopColor="#b98cff" />
              <stop offset={lit} stopColor="#7a2ff0" />
              <stop offset={lit + 0.001} stopColor="rgb(133 54 245 / 0.25)" />
              <stop offset="1" stopColor="rgb(133 54 245 / 0.15)" />
            </linearGradient>
          </defs>
          <path d="M9 60 C 18 38, 28 70, 37 46 S 56 32, 65 60 S 82 68, 90 42" fill="none" stroke="url(#pb-path)"
            strokeDasharray="1 9" strokeLinecap="round" vectorEffect="non-scaling-stroke"
            style={{ strokeWidth: 3, animation: 'dash-flow 1.6s linear infinite' }} />
        </svg>
        {gates.map(g => {
          const state = stateOf(g.gate, current);
          return (
            <div key={g.gate} className={`absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center z-10 ${state === 'current' ? 'gap-10' : 'gap-3'}`}
              style={{ left: `${xs[g.gate - 1]}%`, top: `${ys[g.gate - 1]}%` }}>
              <Orb gate={g.gate} state={state} size={state === 'current' ? 'lg' : 'md'} />
              <Label g={g} state={state} />
            </div>
          );
        })}
      </div>

      <ol className="md:hidden relative mt-4 space-y-6">
        <span className="absolute left-7 top-7 bottom-7 border-l-2 border-dashed border-primary/25" aria-hidden />
        {gates.map(g => {
          const state = stateOf(g.gate, current);
          return (
            <li key={g.gate} className={`relative flex items-center gap-5 ${state === 'current' ? 'py-3' : ''}`}>
              <div className="w-14 shrink-0 grid place-items-center">
                <Orb gate={g.gate} state={state} size="sm" />
              </div>
              <Label g={g} state={state} align="left" />
            </li>
          );
        })}
      </ol>
    </>
  );
}

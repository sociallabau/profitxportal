const TIERS = [
  { label: '$10k', threshold: 10000, sub: 'PER\nMONTH', color: '#9ca3af', glow: 'rgba(156,163,175,0.35)', dark: '#4b5563' },
  { label: '$20k', threshold: 20000, sub: 'PER\nMONTH', color: '#10b981', glow: 'rgba(16,185,129,0.35)', dark: '#047857' },
  { label: '$30k', threshold: 30000, sub: 'PER\nMONTH', color: '#f59e0b', glow: 'rgba(245,158,11,0.35)', dark: '#b45309' },
  { label: '$40k', threshold: 40000, sub: 'PER\nMONTH', color: '#f97316', glow: 'rgba(249,115,22,0.35)', dark: '#c2410c' },
  { label: '$50k', threshold: 50000, sub: 'PER\nMONTH', color: '#ef4444', glow: 'rgba(239,68,68,0.35)', dark: '#b91c1c' },
  { label: '$84k', threshold: 84000, sub: 'PER\nMONTH', color: '#06b6d4', glow: 'rgba(6,182,212,0.35)', dark: '#0e7490' },
  { label: '$100k', threshold: 100000, sub: 'PER\nMONTH', color: '#a855f7', glow: 'rgba(168,85,247,0.35)', dark: '#7e22ce' },
  { label: 'Black', threshold: 150000, sub: 'BOOK', color: '#1f2937', glow: 'rgba(31,41,55,0.5)', dark: '#111827' },
];

function Diamond({ color, glow, dark }: { color: string; glow: string; dark: string }) {
  return (
    <svg viewBox="0 0 80 100" className="w-12 h-14 sm:w-14 sm:h-16 mx-auto">
      <defs>
        <filter id={`glow-${color.replace('#', '')}`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="4" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>
      {/* Outer glow */}
      <ellipse cx="40" cy="50" rx="28" ry="36" fill={glow} opacity="0.6" filter={`url(#glow-${color.replace('#', '')})`} />
      {/* Top crown facet */}
      <polygon points="40,8 58,32 40,44 22,32" fill={color} opacity="0.9" />
      {/* Left crown facet */}
      <polygon points="22,32 40,44 40,56 12,42" fill={color} opacity="0.75" />
      {/* Right crown facet */}
      <polygon points="58,32 68,42 40,56 40,44" fill={color} opacity="0.85" />
      {/* Left pavilion facet */}
      <polygon points="12,42 40,56 40,88 22,58" fill={dark} opacity="0.9" />
      {/* Right pavilion facet */}
      <polygon points="68,42 40,56 40,88 58,58" fill={dark} opacity="0.8" />
      {/* Center highlight line */}
      <polygon points="40,8 40,44 40,56 40,88" fill="white" opacity="0.15" />
    </svg>
  );
}

export default function RevenueLadder({ currentRevenue }: { currentRevenue?: number | null }) {
  const activeIndex =
    currentRevenue && currentRevenue > 0
      ? currentRevenue < 10000
        ? 0
        : TIERS.reduce((best, tier, idx) => (currentRevenue >= tier.threshold ? idx : best), -1)
      : -1;

  return (
    <div className="w-full mb-8">
      {/* Title */}
      <div className="text-center mb-6">
        <h2 className="text-xl sm:text-2xl font-bold text-foreground tracking-tight">
          Revenue Ladder<sup className="text-primary text-sm">™</sup>
        </h2>
        <div className="flex items-center justify-center gap-3 mt-2">
          <div className="h-px w-12 bg-border" />
          <span className="text-xs tracking-[0.25em] text-muted-foreground uppercase">Progression</span>
          <span className="text-muted-foreground">→</span>
          <div className="h-px w-12 bg-border" />
        </div>
      </div>

      {/* Diamonds row */}
      <div className="grid grid-cols-4 gap-2 sm:flex sm:items-start sm:justify-center sm:gap-3 sm:overflow-x-auto sm:pb-2 sm:px-2">
        {TIERS.map((tier, idx) => (
          <div key={tier.label} className="relative flex flex-col items-center">
            <Diamond color={tier.color} glow={tier.glow} dark={tier.dark} />
            <div
              className="mt-2 w-full rounded-lg px-1 py-1 sm:px-1.5 sm:py-1.5 text-center"
              style={{ backgroundColor: tier.color }}
            >
              <p className="text-[10px] sm:text-xs font-bold text-white leading-tight">
                {tier.label}
              </p>
              {tier.sub.split('\n').map((line, i) => (
                <p key={i} className="text-[8px] sm:text-[10px] text-white/90 uppercase tracking-wider leading-tight">
                  {line}
                </p>
              ))}
            </div>
            {/* Active neon dot */}
            {idx === activeIndex && (
              <div
                className="mt-2 w-3 h-3 rounded-full animate-pulse"
                style={{
                  backgroundColor: '#fff',
                  boxShadow: `0 0 6px 2px ${tier.color}, 0 0 12px 4px ${tier.glow}, 0 0 20px 6px ${tier.glow}`,
                }}
              />
            )}
          </div>
        ))}
      </div>

      {/* Tagline */}
      <p className="text-center text-xs text-muted-foreground mt-4 italic">
        Wherever you start — move up the levels to reach the Black Book<sup className="text-[8px]">™</sup>.
      </p>
    </div>
  );
}

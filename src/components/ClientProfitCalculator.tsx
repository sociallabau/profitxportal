import { useEffect, useState } from 'react';
import { Calculator, Plus, X } from 'lucide-react';
import { calculateClient, type MarginRating } from '@/lib/clientProfit';

/** Inputs are kept as strings so fields can be cleared while typing. */
type ClientForm = { name: string; packagePrice: string; shootHours: string; managementHours: string; videos: string };
type SavedState = { hourlyCost: string; editorCostPerVideo: string; clients: ClientForm[] };

const blankClient = (i: number): ClientForm => ({ name: `Client ${String.fromCharCode(65 + (i % 26))}`, packagePrice: '', shootHours: '', managementHours: '', videos: '' });

const DEFAULT_STATE: SavedState = {
  hourlyCost: '40',
  editorCostPerVideo: '75',
  clients: [{ name: 'Example Client', packagePrice: '3500', shootHours: '4', managementHours: '4', videos: '4' }],
};

const RATING: Record<MarginRating, { label: string; cls: string }> = {
  green:  { label: 'Healthy margin',  cls: 'bg-green-500/15 border-green-500/40 text-success' },
  yellow: { label: 'Review pricing',  cls: 'bg-yellow-500/15 border-yellow-500/40 text-yellow-700' },
  red:    { label: 'Unprofitable client', cls: 'bg-red-500/15 border-red-500/40 text-red-600' },
};

const inputCls = 'w-full px-3 py-2 bg-input border border-border rounded-lg text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 transition';
const money = (v: number) => `${v < 0 ? '-' : ''}$${Math.abs(Math.round(v)).toLocaleString()}`;
const num = (s: string) => parseFloat(s);

function loadState(key: string): SavedState {
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw) as SavedState;
      if (Array.isArray(parsed.clients) && parsed.clients.length > 0) return parsed;
    }
  } catch { /* storage unavailable: fall back to the example */ }
  return DEFAULT_STATE;
}

function Field({ label, value, onChange, prefix, placeholder }: { label: string; value: string; onChange: (v: string) => void; prefix?: string; placeholder?: string }) {
  return (
    <label className="block">
      <span className="block text-xs font-semibold text-muted-foreground mb-1">{label}</span>
      <div className="relative">
        {prefix && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">{prefix}</span>}
        <input type="number" inputMode="decimal" min={0} value={value} placeholder={placeholder ?? '0'} onChange={(e) => onChange(e.target.value)} className={`${inputCls} ${prefix ? 'pl-7' : ''}`} />
      </div>
    </label>
  );
}

export default function ClientProfitCalculator({ userId }: { userId?: string }) {
  const storageKey = `profitx-client-calculator:${userId ?? 'anon'}`;
  const [state, setState] = useState<SavedState>(() => loadState(storageKey));

  useEffect(() => {
    try { localStorage.setItem(storageKey, JSON.stringify(state)); } catch { /* not critical */ }
  }, [state, storageKey]);

  const rates = { hourlyCost: num(state.hourlyCost), editorCostPerVideo: num(state.editorCostPerVideo) };

  const updateClient = (i: number, patch: Partial<ClientForm>) =>
    setState((s) => ({ ...s, clients: s.clients.map((c, idx) => (idx === i ? { ...c, ...patch } : c)) }));
  const addClient = () => setState((s) => ({ ...s, clients: [...s.clients, blankClient(s.clients.length)] }));
  const removeClient = (i: number) => setState((s) => ({ ...s, clients: s.clients.filter((_, idx) => idx !== i) }));

  return (
    <div className="bg-card border border-border rounded-xl p-5 mb-5">
      <div className="flex items-center gap-2 mb-1">
        <Calculator className="w-4 h-4 text-primary" />
        <h2 className="text-sm font-semibold text-foreground">Client Profit Calculator</h2>
      </div>
      <p className="text-xs text-muted-foreground mb-4">See what each client really costs you and the margin you keep. Compare client against client.</p>

      <div className="grid grid-cols-2 gap-3 mb-5 max-w-md">
        <Field label="Your cost (per hour)" prefix="$" value={state.hourlyCost} onChange={(v) => setState((s) => ({ ...s, hourlyCost: v }))} />
        <Field label="Editor cost (per video)" prefix="$" value={state.editorCostPerVideo} onChange={(v) => setState((s) => ({ ...s, editorCostPerVideo: v }))} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {state.clients.map((c, i) => {
          const r = calculateClient(
            { name: c.name, packagePrice: num(c.packagePrice), shootHours: num(c.shootHours), managementHours: num(c.managementHours), videos: num(c.videos) },
            rates,
          );
          const rating = r.rating ? RATING[r.rating] : null;
          return (
            <div key={i} className="border border-border rounded-xl p-4 bg-background/40">
              <div className="flex items-center gap-2 mb-3">
                <input value={c.name} onChange={(e) => updateClient(i, { name: e.target.value })} placeholder="Client name" className={`${inputCls} font-semibold`} />
                {state.clients.length > 1 && (
                  <button onClick={() => removeClient(i)} aria-label={`Remove ${c.name || 'client'}`} className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition">
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2"><Field label="Package (per month)" prefix="$" value={c.packagePrice} onChange={(v) => updateClient(i, { packagePrice: v })} /></div>
                <Field label="Shoot time (hrs)" value={c.shootHours} onChange={(v) => updateClient(i, { shootHours: v })} />
                <Field label="Management time (hrs)" value={c.managementHours} onChange={(v) => updateClient(i, { managementHours: v })} />
                <div className="col-span-2"><Field label="Videos & posts (outsourced editing)" value={c.videos} onChange={(v) => updateClient(i, { videos: v })} /></div>
              </div>

              <div className="mt-4 pt-3 border-t border-border space-y-1.5 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Your time cost</span><span>{money(r.timeCost)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Editor cost</span><span>{money(r.editorCost)}</span></div>
                <div className="flex justify-between font-semibold"><span>Cost of client</span><span>{money(r.totalCost)}</span></div>
                <div className="flex justify-between font-semibold"><span>Net profit</span><span className="text-primary">{money(r.netProfit)}</span></div>
              </div>

              <div className={`mt-3 flex items-center justify-between rounded-lg border px-3 py-2 ${rating ? rating.cls : 'bg-muted border-border text-muted-foreground'}`}>
                <span className="text-xs font-bold uppercase tracking-wider">Net margin</span>
                <span className="text-sm font-bold">
                  {r.margin === null ? 'Add a package price' : `${r.margin.toFixed(0)}% · ${rating!.label}`}
                </span>
              </div>
            </div>
          );
        })}

        <button onClick={addClient} className="border border-dashed border-border rounded-xl p-4 min-h-[120px] flex flex-col items-center justify-center gap-2 text-sm font-semibold text-muted-foreground hover:text-primary hover:border-primary/50 transition">
          <Plus className="w-5 h-5" /> Add a client
        </button>
      </div>

      <div className="flex flex-wrap gap-x-5 gap-y-1 mt-4 text-xs font-semibold">
        <span className="text-success">● Green: 60%+ margin</span>
        <span className="text-yellow-700">● Yellow: 40–60%</span>
        <span className="text-red-600">● Red: under 40%</span>
      </div>
      <p className="text-xs text-muted-foreground mt-2">
        You'll have other business costs on top of this (software and other variable expenses) that belong on your full P&amp;L. This margin isn't your business profit. It's for comparing one client against another.
      </p>
    </div>
  );
}

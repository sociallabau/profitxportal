import type { ReactNode } from 'react';
import { Flag, Crosshair, ArrowUpRight, Flame, TrendingUp } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { REVENUE_STEPS, focusBullets, revenuePosition, submissionStreak } from '@/lib/dashboardProgress';
import { brisbaneDateKey } from '@/data/calls';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import ExampleLabel from '@/components/ExampleLabel';

export type RevenuePoint = { month: string; monthKey: string; revenue: number };
const money = (amount: number) => `$${amount.toLocaleString('en-AU', { maximumFractionDigits: 0 })}`;
const stepLabel = (amount: number) => amount === 150000 ? 'Black Book' : amount ? `$${amount / 1000}k` : '$0';

function FocusList({ items, fallback }: { items: string[]; fallback?: string }) {
  const rows = items.length ? items : fallback ? [fallback] : [];
  return (
    <ul className="space-y-2">
      {rows.map((row) => (
        <li key={row} className="flex gap-2.5 text-sm leading-relaxed">
          <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-primary" aria-hidden />
          <span>{row}</span>
        </li>
      ))}
    </ul>
  );
}

/** Once the member has a gate, the Growth Hub's "Your next move" card and build list replace the Focus card. */
export default function DashboardProgress({ series, gate, keyTask, moveUp, nextMove, buildSteps, example = false }: {
  series: RevenuePoint[]; gate?: string | null; keyTask?: string | null; moveUp?: string | null;
  nextMove?: ReactNode; buildSteps?: ReactNode; example?: boolean;
}) {
  const navigate = useNavigate();
  const current = series.at(-1);
  const revenue = current?.revenue ?? 0;
  const previous = series.at(-2)?.revenue;
  const change = previous && previous > 0 ? ((revenue - previous) / previous) * 100 : null;
  const { streak, longest } = submissionStreak(series.map(row => row.monthKey), brisbaneDateKey());
  const position = revenuePosition(revenue);
  return (
    <section className={example ? 'dashboard-example mb-8 space-y-5' : 'mb-8 space-y-5'} aria-label="Your business progress">
      <div className="border-b border-border pb-5">
        <div className="flex items-center justify-between gap-3 flex-wrap mb-10">
          <h2 className="text-sm font-semibold flex items-center gap-2 flex-wrap">Prism Progress · Revenue Ladder™ <ExampleLabel show={example} /></h2>
          <span className="text-xs text-muted-foreground">{current ? `${current.month} · ${money(revenue)}/mth` : 'No monthly report yet'}</span>
        </div>
        <div className="relative mx-3" role="progressbar" aria-label="Revenue ladder progress" aria-valuemin={0} aria-valuemax={150000} aria-valuenow={Math.min(revenue, 150000)} aria-valuetext={`${money(revenue)} per month`}>
          {current && <div className="absolute bottom-3 -translate-x-1/2 flex flex-col items-center" style={{ left: `${Math.max(3, Math.min(97, position))}%` }}>
            <span className="text-[10px] font-bold whitespace-nowrap">{money(revenue)}</span>
            <span className="text-[9px] text-muted-foreground">Now</span>
            <span className="h-2 w-px bg-foreground" />
          </div>}
          <div className="revenue-prism h-2 rounded-full" />
          {current && <span className="absolute top-1 -translate-x-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-foreground border-2 border-card" style={{ left: `${position}%` }} />}
        </div>
        <div className="flex justify-between mt-3 gap-1 text-[9px] sm:text-[10px] text-muted-foreground">
          {REVENUE_STEPS.map(step => <span key={step}>{stepLabel(step)}</span>)}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.8fr)] gap-5">
        <div className="flex flex-col gap-5">
          {nextMove ? (<>
            {nextMove}
            {buildSteps && <div className="rounded-lg bg-card border border-border p-5">
              <div className="flex items-center justify-between gap-2 mb-3">
                <h2 className="text-xs font-semibold text-muted-foreground flex items-center gap-2">Your action steps{gate ? ` · ${gate}` : ''} <ExampleLabel show={example} /></h2>
                <Button variant="link" size="sm" className="px-0 h-auto" disabled={example} onClick={() => navigate('/growth-hub')}>Growth Hub <ArrowUpRight /></Button>
              </div>
              {buildSteps}
            </div>}
          </>) : (
          <div className="dashboard-focus rounded-lg border border-primary/35 bg-card p-5 flex-1">
            <div className="flex items-center justify-between gap-2 mb-4">
              <h2 className="text-xs font-semibold text-primary flex items-center gap-2 flex-wrap"><Crosshair className="w-4 h-4" /> Your Focus <ExampleLabel show={example} /></h2>
              <Flag className="w-4 h-4 text-primary" />
            </div>
            <p className="text-base font-semibold text-primary mb-4">{gate || 'Your next step'} <ExampleLabel show={example} /></p>
            <p className="text-[10px] uppercase font-semibold text-muted-foreground mb-2">Key next task <ExampleLabel show={example} /></p>
            <FocusList items={focusBullets(keyTask)} fallback="Complete your monthly report" />
            <Button variant="link" size="sm" className="px-0 mt-2" disabled={example} onClick={() => navigate('/growth-hub')}>Open your Growth Hub <ArrowUpRight /></Button>
            {moveUp && <div className="mt-4 pt-4 border-t border-primary/20">
              <p className="text-[10px] uppercase font-semibold text-primary flex items-center gap-1 mb-2 flex-wrap"><ArrowUpRight className="w-3 h-3" /> To move up a gate <ExampleLabel show={example} /></p>
              <FocusList items={focusBullets(moveUp)} />
            </div>}
          </div>
          )}
          <div className="rounded-lg bg-card border border-border p-5">
            <h2 className="text-xs font-semibold text-muted-foreground flex items-center gap-2 flex-wrap">Monthly submission streak <ExampleLabel show={example} /> <Flame className="w-4 h-4 text-primary" /></h2>
            <p className="mt-3 flex items-baseline gap-2"><span className="text-3xl font-semibold">{streak}</span><span className="text-xs text-muted-foreground">months · longest {longest}</span></p>
            <div className="grid grid-cols-6 gap-1.5 mt-3">
              {Array.from({ length: 6 }, (_, index) => {
                const date = new Date(`${brisbaneDateKey().slice(0, 7)}-01T12:00:00+10:00`);
                date.setMonth(date.getMonth() - 5 + index);
                const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                const done = series.some(row => row.monthKey.startsWith(key));
                return <div key={key} title={`${date.toLocaleDateString('en-AU', { month: 'long', year: 'numeric' })}: ${done ? 'submitted' : 'not submitted'}`}><div className={`h-1.5 rounded-full ${done ? 'bg-primary' : 'bg-muted'}`} /><p className="text-[9px] text-muted-foreground text-center mt-1">{date.toLocaleDateString('en-AU', { month: 'short' })}</p></div>;
              })}
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-5 min-w-0 flex flex-col">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-xs text-muted-foreground font-semibold flex items-center gap-2 flex-wrap"><TrendingUp className="w-4 h-4 text-primary" /> Revenue Progress <ExampleLabel show={example} /></h2>
            <Button variant="link" size="sm" disabled={example} onClick={() => navigate('/financials')}>Financials <ArrowUpRight /></Button>
          </div>
          <div className="flex items-baseline gap-3 flex-wrap mt-3">
            <p className="text-3xl font-semibold">{current ? money(revenue) : '—'}</p>
            {change !== null && <span className={`text-xs font-semibold ${change >= 0 ? 'text-success' : 'text-destructive'}`}>{change >= 0 ? '+' : ''}{change.toFixed(1)}%</span>}
            <span className="text-xs text-muted-foreground">{current?.month || 'No reports yet'}</span>
          </div>
          <div className="h-64 lg:h-auto lg:min-h-[260px] flex-1 w-full mt-5">
            {series.length ? <ResponsiveContainer width="100%" height="100%" minHeight={260}>
              <LineChart data={series} margin={{ top: 15, right: 12, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} minTickGap={20} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} width={48} tickFormatter={value => `$${value / 1000}k`} />
                <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8 }} formatter={value => [money(Number(value)), 'Revenue']} />
                <Line dataKey="revenue" type="monotone" stroke="hsl(var(--primary))" strokeWidth={2.5} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer> : <div className="h-full flex items-center justify-center text-sm text-muted-foreground">No monthly reports yet.</div>}
          </div>
        </div>
      </div>
    </section>
  );
}

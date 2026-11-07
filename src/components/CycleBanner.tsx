/**
 * The month-start walkthrough, sitting at the top of the dashboard.
 *
 * Tells them what kind of month it is and what it wants from them: the numbers every
 * month, plus the review in a reflect month. Deliberately not a blocker — it stays put
 * and keeps asking until each step is done, and disappears once they all are.
 *
 * Both steps are derived from data that already exists (a check-in row for last month,
 * an audit row for this cycle), so there is no progress table to keep in sync.
 */
import { useNavigate } from 'react-router-dom';
import { Check, Compass, Hammer, Rocket } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCycleReview } from '@/hooks/useCycle';
import { CYCLE_MODES, CYCLE_STEPS, cycleSteps, type CycleMode, type CycleStepKey } from '@/lib/cycle';

const MODE_ICON: Record<CycleMode, LucideIcon> = { build: Hammer, implement: Rocket, reflect: Compass };
const MODE_TONE: Record<CycleMode, string> = {
  build: 'border-orange-500/50 bg-orange-500/10',
  implement: 'border-blue-500/50 bg-blue-500/10',
  reflect: 'border-success/50 bg-success/10',
};

export default function CycleBanner({ userId, now }: { userId: string | undefined; now?: Date }) {
  const navigate = useNavigate();
  const { cycle, numbersIn, reviewDone, loading } = useCycleReview(userId, now);

  const steps = cycleSteps(cycle.mode);
  const isDone: Record<CycleStepKey, boolean> = { numbers: numbersIn, review: reviewDone };
  const outstanding = steps.filter(s => !isDone[s]);

  // Nothing to nag about, and nothing to show while we still don't know.
  if (loading || outstanding.length === 0) return null;

  const Icon = MODE_ICON[cycle.mode];
  const mode = CYCLE_MODES[cycle.mode];
  const lastMonth = new Date(`${cycle.previousMonth}-15T12:00:00`).toLocaleDateString('en-AU', { month: 'long' });

  return (
    <div className={`mb-6 rounded-xl border p-5 ${MODE_TONE[cycle.mode]}`}>
      <div className="flex items-start gap-3">
        <Icon className="mt-0.5 h-5 w-5 shrink-0 text-foreground" />
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            This is {mode.label === 'Implement' ? 'an' : 'a'} {mode.label} month
          </p>
          <h2 className="text-lg font-semibold text-foreground">{mode.blurb}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {outstanding.length > 1 ? 'Two things to get out of the way first:' : 'One thing left to get out of the way:'}
          </p>

          <div className="mt-3 space-y-2">
            {steps.map(key => {
              const step = CYCLE_STEPS[key];
              const done = isDone[key];
              const label = key === 'numbers' ? `Submit your ${lastMonth} numbers` : step.label;
              return (
                <div key={key} className="flex flex-wrap items-center gap-3">
                  <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${done ? 'border-success bg-success' : 'border-muted-foreground'}`}>
                    {done && <Check className="h-3 w-3 text-background" />}
                  </span>
                  <span className={`flex-1 text-sm ${done ? 'text-muted-foreground line-through' : 'font-medium text-foreground'}`}>
                    {label}
                  </span>
                  {!done && (
                    <Button size="sm" variant={key === 'numbers' ? 'default' : 'outline'} onClick={() => navigate(step.href)}>
                      {key === 'numbers' ? 'Submit' : 'Start the review'}
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

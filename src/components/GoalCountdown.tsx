import { Target, Calendar, TrendingUp } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useGoal } from '@/hooks/useGoal';

interface Props {
  currentMrr: number;
}

export default function GoalCountdown({ currentMrr }: Props) {
  const { goal } = useGoal();
  const navigate = useNavigate();
  const goalData = goal.data;

  const retainerTiers = [
    goalData?.retainer_tier_1,
    goalData?.retainer_tier_2,
    goalData?.retainer_tier_3,
  ]
    .map((v) => Number(v))
    .filter((v) => v > 0);

  if (!goalData?.target_mrr || !goalData?.target_date) {
    return (
      <div className="bg-card border border-border border-dashed rounded-xl p-5 mb-6 text-center">
        <Target className="w-7 h-7 text-muted-foreground mx-auto mb-2 opacity-40" />
        <p className="text-sm text-muted-foreground mb-3">Set a 90-day MRR goal to unlock your countdown.</p>
        <button onClick={() => navigate('/settings')} className="text-xs font-semibold text-primary hover:underline">Set goal in Settings →</button>
      </div>
    );
  }

  const target = Number(goalData.target_mrr);
  const targetDate = new Date(goalData.target_date);
  const today = new Date();
  const daysLeft = Math.max(0, Math.ceil((targetDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)));
  const gap = Math.max(0, target - currentMrr);
  const progressPct = target > 0 ? Math.min(100, Math.round((currentMrr / target) * 100)) : 0;

  const onTrack = daysLeft > 0 && gap === 0;
  const urgency = daysLeft <= 14 ? 'text-destructive' : daysLeft <= 30 ? 'text-orange-400' : 'text-primary';

  return (
    <div className="bg-card border border-border rounded-xl p-5 mb-6">
      <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
        <div className="flex items-center gap-2">
          <Target className="w-4 h-4 text-primary" />
          <h2 className="text-sm font-semibold text-foreground">Goal Countdown</h2>
        </div>
        <button onClick={() => navigate('/settings')} className="text-xs text-muted-foreground hover:text-foreground transition">Edit goal →</button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
        <div>
          <div className="flex items-center gap-1.5 mb-1">
            <Calendar className={`w-3.5 h-3.5 ${urgency}`} />
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Days Left</p>
          </div>
          <p className={`text-2xl font-bold ${urgency}`}>{daysLeft}</p>
          <p className="text-xs text-muted-foreground mt-0.5">until {targetDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</p>
        </div>
        <div>
          <div className="flex items-center gap-1.5 mb-1">
            <TrendingUp className="w-3.5 h-3.5 text-primary" />
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Current MRR</p>
          </div>
          <p className="text-2xl font-bold text-foreground">${currentMrr.toLocaleString()}</p>
          <p className="text-xs text-muted-foreground mt-0.5">target ${target.toLocaleString()}</p>
        </div>
        <div>
          <div className="flex items-center gap-1.5 mb-1">
            <Target className="w-3.5 h-3.5 text-primary" />
            <p className="text-xs text-muted-foreground uppercase tracking-wider">MRR Gap</p>
          </div>
          <p className={`text-2xl font-bold ${gap === 0 ? 'text-green-400' : 'text-foreground'}`}>
            {gap === 0 ? '✓ Hit!' : `$${gap.toLocaleString()}`}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">{progressPct}% to goal</p>
        </div>
      </div>

      <div className="w-full h-2 bg-muted/40 rounded-full overflow-hidden mb-5">
        <div
          className={`h-full rounded-full transition-all ${gap === 0 ? 'bg-green-400' : 'bg-primary'}`}
          style={{ width: `${progressPct}%` }}
        />
      </div>

      {gap > 0 ? (
        retainerTiers.length === 0 ? (
          <div className="bg-background/50 border border-border border-dashed rounded-lg p-4 text-center">
            <p className="text-xs text-muted-foreground mb-2">Add your retainer prices in Settings to see how many clients you need to hit your goal.</p>
            <button onClick={() => navigate('/settings')} className="text-xs font-semibold text-primary hover:underline">Set retainer tiers →</button>
          </div>
        ) : (
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2.5">Retainers needed to close the gap</p>
            <div className={`grid gap-3 ${retainerTiers.length === 1 ? 'grid-cols-1' : retainerTiers.length === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
              {retainerTiers.map((price) => {
                const needed = Math.ceil(gap / price);
                const perWeek = daysLeft > 0 ? (needed / (daysLeft / 7)).toFixed(1) : '∞';
                const label = price >= 1000 && price % 1000 === 0 ? `$${price / 1000}k retainer` : `$${price.toLocaleString()} retainer`;
                return (
                  <div key={price} className="bg-background/50 border border-border rounded-lg p-3 text-center">
                    <p className="text-xs text-muted-foreground mb-1">{label}</p>
                    <p className="text-2xl font-bold text-primary">{needed}</p>
                    <p className="text-[10px] text-muted-foreground mt-1">~{perWeek}/week</p>
                  </div>
                );
              })}
            </div>
          </div>
        )
      ) : onTrack ? (
        <p className="text-sm text-green-400 font-semibold text-center py-2">🎉 You've hit your MRR goal — push for the stretch!</p>
      ) : (
        <p className="text-sm text-orange-400 font-semibold text-center py-2">⏰ Deadline passed — set a new 90-day goal in Settings.</p>
      )}
    </div>
  );
}

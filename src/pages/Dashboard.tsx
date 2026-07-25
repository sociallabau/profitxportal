import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Trophy, Calendar, ExternalLink, Sparkles, Hammer, Rocket, Compass, Video, TrendingUp, FileText } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import PageLayout from '@/components/PageLayout';
import AnnouncementsModal from '@/components/AnnouncementsModal';
import { useRequireAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { usePageTracking } from '@/hooks/usePageTracking';
import { supabase } from '@/lib/supabase';
import { getUpcomingCalls, brisbaneDateKey, type Call } from '@/data/calls';

// -------- Quarterly cycle --------
type Phase = 'Build' | 'Implement' | 'Reflect';
const PHASES: Phase[] = ['Build', 'Implement', 'Reflect'];
const PHASE_META: Record<Phase, { icon: any; blurb: string; color: string; bg: string }> = {
  Build:     { icon: Hammer,  blurb: 'Lay the foundations. Design offers, ads and systems.', color: 'text-orange-400', bg: 'from-orange-500/25 to-orange-500/5' },
  Implement: { icon: Rocket,  blurb: 'Push hard. Launch, execute and gather real data.',    color: 'text-blue-400',   bg: 'from-blue-500/25 to-blue-500/5' },
  Reflect:   { icon: Compass, blurb: 'Review the quarter. Refine, reset, re-align.',        color: 'text-green-400',  bg: 'from-green-500/25 to-green-500/5' },
};

// One-day intensives — March, July, November (each year)
const INTENSIVE_MONTHS = [2, 6, 10]; // 0-indexed

function brisbaneNowParts() {
  // Return current Brisbane year + monthIdx (0-11)
  const [y, m] = brisbaneDateKey().split('-').map(Number);
  return { year: y, monthIdx: m - 1 };
}

function currentCycle() {
  const { year, monthIdx } = brisbaneNowParts();
  const quarter = Math.floor(monthIdx / 3) + 1;         // 1-4
  const monthInQuarter = (monthIdx % 3) + 1;            // 1-3
  const phase = PHASES[monthInQuarter - 1];
  const nextPhase = PHASES[monthInQuarter % 3];
  const nextMonthIdx = (monthIdx + 1) % 12;
  const nextMonthName = new Date(2000, nextMonthIdx, 1).toLocaleString(undefined, { month: 'long' });
  const monthName = new Date(2000, monthIdx, 1).toLocaleString(undefined, { month: 'long' });
  return { year, monthIdx, monthName, quarter, monthInQuarter, phase, nextPhase, nextMonthName };
}

// -------- Upcoming calls bar --------
function CallCard({ call }: { call: Call }) {
  const d = new Date(call.start);
  const dateStr = d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
  const timeStr = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  return (
    <div className="flex gap-3 bg-card border border-border rounded-xl p-3 hover:border-primary/50 transition group">
      <div className="w-24 sm:w-32 aspect-video rounded-lg overflow-hidden bg-gradient-to-br from-primary/20 to-transparent flex items-center justify-center shrink-0">
        {call.thumbnail ? (
          <img src={call.thumbnail} alt="" className="w-full h-full object-cover" />
        ) : (
          <Video className="w-6 h-6 text-primary/80" />
        )}
      </div>
      <div className="flex-1 min-w-0 flex flex-col">
        <span className="text-[10px] font-bold uppercase tracking-widest text-primary">{call.category}</span>
        <h3 className="text-sm font-semibold text-foreground leading-tight line-clamp-2">{call.title}</h3>
        <p className="text-xs text-muted-foreground mt-0.5">{dateStr} · {timeStr}</p>
        <a
          href={call.meetUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-auto self-start inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
        >
          Join <ExternalLink className="w-3 h-3" />
        </a>
      </div>
    </div>
  );
}

// -------- Yearly calendar --------
function YearlyCalendar() {
  const { year, monthIdx } = brisbaneNowParts();
  const months = Array.from({ length: 12 }, (_, i) => {
    const q = Math.floor(i / 3) + 1;
    const phase = PHASES[i % 3];
    const isNow = i === monthIdx;
    const hasIntensive = INTENSIVE_MONTHS.includes(i);
    const name = new Date(2000, i, 1).toLocaleString(undefined, { month: 'short' });
    return { i, q, phase, isNow, hasIntensive, name };
  });

  const phaseDot: Record<Phase, string> = {
    Build: 'bg-orange-400',
    Implement: 'bg-blue-400',
    Reflect: 'bg-green-400',
  };

  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div>
          <h2 className="text-sm font-semibold text-foreground">The ProfitX Year — {year}</h2>
          <p className="text-xs text-muted-foreground">Quarters · Cycles · 1-Day Intensives</p>
        </div>
        <div className="flex items-center gap-3 text-[10px] uppercase tracking-widest font-semibold">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-orange-400" /> Build</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-400" /> Implement</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-400" /> Reflect</span>
          <span className="flex items-center gap-1"><Sparkles className="w-3 h-3 text-primary" /> Intensive</span>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-3">
        {[1, 2, 3, 4].map((q) => (
          <div key={q} className="flex flex-col gap-1.5">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground text-center">Q{q}</p>
            {months.filter(m => m.q === q).map(m => (
              <div
                key={m.i}
                className={`relative rounded-lg border p-2 text-center transition ${
                  m.isNow ? 'border-primary bg-primary/10 shadow-lg shadow-primary/20' : 'border-border bg-background/40'
                }`}
              >
                {m.hasIntensive && (
                  <Sparkles className="w-3 h-3 text-primary absolute top-1 right-1" />
                )}
                <p className={`text-sm font-bold ${m.isNow ? 'text-primary' : 'text-foreground'}`}>{m.name}</p>
                <div className="flex items-center justify-center gap-1 mt-1">
                  <span className={`w-1.5 h-1.5 rounded-full ${phaseDot[m.phase]}`} />
                  <span className="text-[9px] uppercase tracking-wider text-muted-foreground">{m.phase}</span>
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>

      <p className="text-xs text-muted-foreground mt-4 flex items-center gap-1.5">
        <Sparkles className="w-3.5 h-3.5 text-primary shrink-0" />
        1-Day Intensives in <span className="font-semibold text-foreground">March, July & November</span> — deep dive, reflect and re-align.
      </p>
    </div>
  );
}

export default function Dashboard() {
  const { user } = useRequireAuth();
  const { data: profile } = useProfile();
  usePageTracking('dashboard');
  const navigate = useNavigate();

  const cycle = currentCycle();
  const PhaseIcon = PHASE_META[cycle.phase].icon;
  const upcomingCalls = getUpcomingCalls(2);

  const { data: wins = [] } = useQuery({
    queryKey: ['dashboard-wins', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from('weekly_wins')
        .select('id, win_text, cash_amount, created_at')
        .eq('user_id', user!.id)
        .not('win_text', 'eq', '')
        .order('created_at', { ascending: false })
        .limit(4);
      return data ?? [];
    },
  });

  const { data: revenueSeries = [] } = useQuery({
    queryKey: ['dashboard-revenue', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from('monthly_totals')
        .select('month, mrr, total_revenue')
        .eq('user_id', user!.id)
        .order('month', { ascending: true });
      return (data ?? []).map((r: any) => ({
        month: new Date(r.month).toLocaleDateString(undefined, { month: 'short', year: '2-digit' }),
        revenue: Number(r.total_revenue) || Number(r.mrr) || 0,
      }));
    },
  });

  return (
    <PageLayout>
      <AnnouncementsModal />

      <div className="mb-6">
        <h1 className="text-2xl font-bold">
          Welcome back{profile?.full_name ? `, ${profile.full_name.split(' ')[0]}` : ''}.
        </h1>
        <p className="text-sm text-muted-foreground">Here's where ProfitX is right now.</p>
      </div>

      {/* Upcoming calls bar */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-semibold text-foreground">Next Up</h2>
          </div>
          <button onClick={() => navigate('/calls')} className="text-xs text-primary hover:underline">See all calls →</button>
        </div>
        {upcomingCalls.length === 0 ? (
          <div className="bg-card border border-border border-dashed rounded-xl p-6 text-center text-sm text-muted-foreground">
            No upcoming calls scheduled.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {upcomingCalls.map(c => <CallCard key={c.meetUrl + c.start} call={c} />)}
          </div>
        )}
      </div>

      {/* Current cycle */}
      <div className={`bg-gradient-to-br ${PHASE_META[cycle.phase].bg} bg-card border border-border rounded-xl p-6 mb-6`}>
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div className="flex items-start gap-4">
            <div className={`w-12 h-12 rounded-xl bg-background/60 border border-border flex items-center justify-center ${PHASE_META[cycle.phase].color}`}>
              <PhaseIcon className="w-6 h-6" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                Quarter {cycle.quarter} · Month {cycle.monthInQuarter} of 3 · {cycle.monthName} {cycle.year}
              </p>
              <h2 className={`text-2xl font-bold mt-1 ${PHASE_META[cycle.phase].color}`}>
                {cycle.phase} Month
              </h2>
              <p className="text-sm text-muted-foreground mt-1 max-w-md">
                {PHASE_META[cycle.phase].blurb}
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Coming next</p>
            <p className="text-sm font-semibold text-foreground mt-1">{cycle.nextMonthName} · {cycle.nextPhase}</p>
          </div>
        </div>

        {/* Phase progress */}
        <div className="mt-5 grid grid-cols-3 gap-2">
          {PHASES.map((p, idx) => {
            const active = idx + 1 === cycle.monthInQuarter;
            const done = idx + 1 < cycle.monthInQuarter;
            return (
              <div key={p} className={`h-1.5 rounded-full ${active ? 'bg-primary' : done ? 'bg-primary/40' : 'bg-border'}`} />
            );
          })}
        </div>
      </div>

      {/* Yearly calendar */}
      <div className="mb-6">
        <YearlyCalendar />
      </div>

      {/* Recent wins — hype */}
      <div className="bg-card border border-border rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Trophy className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-semibold text-foreground">Recent Wins</h2>
          </div>
          <button onClick={() => navigate('/wins')} className="text-xs text-primary hover:underline">See all →</button>
        </div>
        {wins.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">No wins logged yet. Add your first one on the Wins Wall!</p>
        ) : (
          <div className="space-y-3">
            {wins.map((w: any) => (
              <div key={w.id} className="flex items-start gap-3 py-2 border-b border-border/50 last:border-0">
                <span className="text-base mt-0.5">🏆</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground">{w.win_text}</p>
                  {w.cash_amount > 0 && <p className="text-xs text-primary font-semibold mt-0.5">+${Number(w.cash_amount).toLocaleString()}</p>}
                </div>
                <span className="text-xs text-muted-foreground shrink-0">{new Date(w.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </PageLayout>
  );
}

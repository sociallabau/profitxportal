import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Trophy, Calendar, ExternalLink, Sparkles, Hammer, Rocket, Compass, Video, FileText } from 'lucide-react';
import DashboardProgress from '@/components/DashboardProgress';
import { Button } from '@/components/ui/button';
import PageLayout from '@/components/PageLayout';
import AnnouncementsModal from '@/components/AnnouncementsModal';
import { useRequireAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { usePageTracking } from '@/hooks/usePageTracking';
import { supabase } from '@/lib/supabase';
import { getUpcomingCalls, brisbaneDateKey, type Call } from '@/data/calls';
import type { LucideIcon } from 'lucide-react';
import { useUpcomingCalls } from '@/hooks/useUpcomingCalls';
import ExampleLabel from '@/components/ExampleLabel';
import { NextMove } from '@/components/growth-hub/GrowthHubCards';
import DanAiButton from '@/components/DanAiButton';
import { useGateBuild } from '@/hooks/useGrowthHub';
import { gateNumber, nextTask } from '@/lib/growthHub';
import { isExampleDashboard, EXAMPLE_PROFILE, EXAMPLE_REVENUE, EXAMPLE_CALLS, EXAMPLE_WINS, EXAMPLE_NEXT } from '@/lib/dashboardExample';

// -------- Quarterly cycle --------
type Phase = 'Build' | 'Implement' | 'Reflect';
const PHASES: Phase[] = ['Build', 'Implement', 'Reflect'];
const PHASE_META: Record<Phase, { icon: LucideIcon; blurb: string; color: string; bg: string }> = {
  Build:     { icon: Hammer,  blurb: 'Learn or improve the core components of a ProfitX Business.', color: 'text-orange-600', bg: 'from-orange-500/25 to-orange-500/5' },
  Implement: { icon: Rocket,  blurb: 'Implement the components into your business. Take massive action.', color: 'text-blue-600', bg: 'from-blue-500/25 to-blue-500/5' },
  Reflect:   { icon: Compass, blurb: 'Reflect on how the implementation went. Set direction for the next quarter.', color: 'text-success', bg: 'from-green-500/25 to-green-500/5' },
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
function CallCard({ call, example = false }: { call: Call; example?: boolean }) {
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
        <span className="text-[10px] font-bold uppercase tracking-widest text-primary">{call.category === 'Workshop' && call.workshopType ? `${call.workshopType === 'learn' ? 'Learn' : 'Do'} Workshop` : call.category}</span>
        <h3 className="text-sm font-semibold text-foreground leading-tight line-clamp-2">{call.title}</h3>
        <ExampleLabel show={example} />
        <p className="text-xs text-muted-foreground mt-0.5">{dateStr} · {timeStr}</p>
        <a
          href={call.meetUrl}
          onClick={example ? (event) => event.preventDefault() : undefined}
          aria-disabled={example}
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
function YearlyCalendar({ example = false }: { example?: boolean }) {
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
          <h2 className="text-sm font-semibold text-foreground">The ProfitX Year — {year} <ExampleLabel show={example} /></h2>
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

function ThreeWeekCalendar({ calls, example = false }: { calls: Call[]; example?: boolean }) {
  const cycle = currentCycle();
  const PhaseIcon = PHASE_META[cycle.phase].icon;
  const todayKey = brisbaneDateKey();
  const [ty, tm, td] = todayKey.split('-').map(Number);
  const start = new Date(Date.UTC(ty, tm - 1, td));
  const days = Array.from({ length: 21 }, (_, i) => {
    const d = new Date(start);
    d.setUTCDate(start.getUTCDate() + i);
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
    return { date: d, key, dayNum: d.getUTCDate(), weekday: d.toLocaleDateString(undefined, { weekday: 'short', timeZone: 'UTC' }) };
  });
  const byDay: Record<string, Call[]> = {};
  calls.forEach((c) => {
    const k = c.start.slice(0, 10);
    if (k >= days[0].key && k <= days[20].key) (byDay[k] ||= []).push(c);
  });
  const catColor = (c: Call) => {
    if (c.category === 'Workshop') {
      return c.workshopType === 'learn'
        ? 'workshop-learn'
        : 'workshop-do';
    }
    if (c.category === 'Q&A') return 'bg-blue-400/80 text-blue-950';
    return 'bg-primary/80 text-primary-foreground';
  };

  return (
    <div className="bg-card border border-border rounded-xl p-5 mb-6">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-semibold text-foreground">Next 3 Weeks <ExampleLabel show={example} /></h2>
          </div>
          <div className="flex items-center gap-2 border-l border-border pl-3">
            <PhaseIcon className="w-3.5 h-3.5 text-primary" />
            <span className="text-xs font-semibold">{cycle.phase} Month</span>
            <ExampleLabel show={example} />
            <span className="text-[10px] text-muted-foreground">{cycle.monthName} · Q{cycle.quarter}</span>
          </div>
        </div>
        <div className="flex items-center gap-3 text-[10px] uppercase tracking-widest font-semibold text-muted-foreground">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-orange-400" /> Do Workshop</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-sky-400" /> Learn Workshop</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-primary" /> Coaching</span>
        </div>
      </div>
      <div className="flex items-center justify-between gap-3 flex-wrap border-t border-border pt-3 mb-4">
        <p className="text-xs text-muted-foreground">{cycle.phase === 'Build' ? 'Preparing for Christmas & Building Ad Campaigns' : PHASE_META[cycle.phase].blurb}</p>
        <span className="text-[10px] text-muted-foreground">Next: {cycle.nextMonthName} · {cycle.nextPhase}</span>
      </div>
      <div className="grid grid-cols-7 gap-1.5">
        {days.map((d) => {
          const isToday = d.key === todayKey;
          const events = byDay[d.key] ?? [];
          return (
            <div
              key={d.key}
              className={`min-h-[74px] rounded-lg border p-1.5 flex flex-col gap-1 ${
                isToday ? 'border-primary bg-primary/10' : 'border-border bg-background/40'
              }`}
            >
              <div className="flex items-baseline justify-between">
                <span className="text-[9px] uppercase tracking-wider text-muted-foreground">{d.weekday}</span>
                <span className={`text-xs font-bold ${isToday ? 'text-primary' : 'text-foreground'}`}>{d.dayNum}</span>
              </div>
              <div className="flex flex-col gap-1">
                {events.map((e) => {
                  const t = new Date(e.start).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
                  return (
                    <a
                      key={e.meetUrl + e.start}
                      href={e.meetUrl}
                      onClick={example ? (event) => event.preventDefault() : undefined}
                      aria-disabled={example}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={`${e.title} · ${t}`}
                      className={`text-[9px] leading-tight rounded px-1 py-0.5 truncate font-semibold ${catColor(e)} hover:opacity-90`}
                    >
                      {t} {e.title.replace(/^ProfitX\s*[-—]\s*(Workshop\s*[-—]\s*)?/i, '')}
                    </a>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { user } = useRequireAuth();
  const { data: profile } = useProfile();
  usePageTracking('dashboard');
  const navigate = useNavigate();
  const dataUserId = user?.id;
  const example = isExampleDashboard(dataUserId);
  const dashboardProfile = example ? EXAMPLE_PROFILE : profile;
  // The build list drives "what to do next" everywhere, so Dashboard and Growth Hub always agree.
  const gate = example ? null : gateNumber(profile?.gate);
  const { tasks: buildTasks } = useGateBuild(example ? null : user?.id, gate);
  const next = nextTask(buildTasks);

  const { calls: allUpcoming } = useUpcomingCalls();
  const upcomingCalls = (example ? EXAMPLE_CALLS : allUpcoming).slice(0, 2);
  const threeWeekCalls = example ? EXAMPLE_CALLS : allUpcoming;

  const { data: memberWins = [] } = useQuery({
    queryKey: ['dashboard-wins', dataUserId],
    enabled: Boolean(dataUserId && profile && !example),
    queryFn: async () => {
      const { data } = await supabase
        .from('weekly_wins')
        .select('id, win_text, cash_amount, created_at')
        .eq('user_id', dataUserId ?? '')
        .not('win_text', 'eq', '')
        .order('created_at', { ascending: false })
        .limit(4);
      return data ?? [];
    },
  });

  const { data: memberRevenueSeries = [] } = useQuery({
    queryKey: ['dashboard-revenue', dataUserId],
    enabled: Boolean(dataUserId && profile && !example),
    queryFn: async () => {
      const { data } = await supabase
        .from('monthly_totals')
        .select('month, mrr, mrr_manual, oneoff_revenue, total_revenue')
        .eq('user_id', dataUserId ?? '')
        .order('month', { ascending: true });
      return (data ?? []).map(r => ({
        month: new Date(`${r.month.slice(0, 7)}-15T12:00:00`).toLocaleDateString('en-AU', { month: 'short', year: '2-digit' }),
        monthKey: r.month,
        revenue: Number(r.total_revenue) || (Number(r.mrr_manual ?? r.mrr) || 0) + (Number(r.oneoff_revenue) || 0),
      }));
    },
  });

  const wins = example ? EXAMPLE_WINS : memberWins;
  const revenueSeries = example ? EXAMPLE_REVENUE : memberRevenueSeries;

  return (
    <PageLayout>
      {!example && <AnnouncementsModal />}

      <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold">
            Welcome back{dashboardProfile?.full_name ? `, ${dashboardProfile.full_name.split(' ')[0]}` : ''}.
            {' '}<ExampleLabel show={example} />
          </h1>
          <p className="text-sm text-muted-foreground">Here’s where ProfitX is right now.</p>
        </div>
        <div className="flex items-center gap-3">
        {!example && <DanAiButton isAdmin={Boolean(profile?.is_admin)} />}
        <Button
          disabled={example}
          onClick={() => navigate('/submissions/monthly')}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition shadow-lg shadow-primary/20"
        >
          <FileText className="w-4 h-4" />
          Submit Monthly Report
          <ExampleLabel show={example} />
        </Button>
        </div>
      </div>

      <DashboardProgress example={example} series={revenueSeries} gate={dashboardProfile?.gate} moveUp={dashboardProfile?.gate_move_up} keyTask={dashboardProfile?.gate_key_task}
        nextMove={example
          ? <NextMove task={EXAMPLE_NEXT} isAdmin={Boolean(profile?.is_admin)} compact />
          : <NextMove task={next} isAdmin={Boolean(profile?.is_admin)} userId={user?.id} compact noGate={!gate} />} />

      {/* Upcoming calls bar */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-semibold text-foreground">Next Up <ExampleLabel show={example} /></h2>
          </div>
          <Button variant="link" size="sm" disabled={example} onClick={() => navigate('/calls')} className="text-xs text-primary hover:underline">See all calls →</Button>
        </div>
        {upcomingCalls.length === 0 ? (
          <div className="bg-card border border-border border-dashed rounded-xl p-6 text-center text-sm text-muted-foreground">
            No upcoming calls scheduled.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {upcomingCalls.map(c => <CallCard example={example} key={c.meetUrl + c.start} call={c} />)}
          </div>
        )}
      </div>

      {/* Next 3 weeks calendar */}
      <ThreeWeekCalendar calls={threeWeekCalls} example={example} />

      {/* Yearly calendar */}
      <div className="mb-6">
        <YearlyCalendar example={example} />
      </div>

      {/* Recent wins — hype */}
      <div className="bg-card border border-border rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Trophy className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-semibold text-foreground">Recent Wins <ExampleLabel show={example} /></h2>
          </div>
          <Button variant="link" size="sm" disabled={example} onClick={() => navigate('/wins')} className="text-xs text-primary hover:underline">See all →</Button>
        </div>
        {wins.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">No wins logged yet. Add your first one on the Wins Wall!</p>
        ) : (
          <div className="space-y-3">
            {wins.map(w => (
              <div key={w.id} className="flex items-start gap-3 py-2 border-b border-border/50 last:border-0">
                <span className="text-base mt-0.5">🏆</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground">{w.win_text} <ExampleLabel show={example} /></p>
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

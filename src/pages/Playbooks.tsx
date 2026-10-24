import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { PartyPopper } from 'lucide-react';
import PageLayout from '@/components/PageLayout';
import LevelMap from '@/components/playbook/LevelMap';
import { BuildList, GateGoals, GateTrainings, NextMove } from '@/components/playbook/PlaybookCards';
import { supabase } from '@/lib/supabase';
import { useRequireAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { usePageTracking } from '@/hooks/usePageTracking';
import { useGateBuild } from '@/hooks/usePlaybook';
import { useDanBrief } from '@/hooks/useDanBrief';
import { GATES, ROMAN, buildProgress, gateNumber, nextTask, type GateNumber } from '@/lib/playbook';

const money = (n: number) => `$${n >= 1000 ? `${(n / 1000).toFixed(1).replace(/\.0$/, '')}K` : n}`;

/** Days left to submit this month's check-in (due end of month). */
function daysToCheckIn(today = new Date()) {
  const end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  return Math.max(0, Math.ceil((end.getTime() - today.getTime()) / 86400000));
}

/** Celebrates once, the first time a member opens Playbooks after Dan moves them up. */
function useUnlock(userId: string | undefined, gate: GateNumber | null) {
  const [unlocked, setUnlocked] = useState<GateNumber | null>(null);
  useEffect(() => {
    if (!userId || !gate) return;
    const key = `pb-seen-gate-${userId}`;
    try {
      const seen = Number(localStorage.getItem(key) || 0);
      if (seen && gate > seen) setUnlocked(gate);
      localStorage.setItem(key, String(gate));
    } catch { /* storage blocked: no celebration */ }
  }, [userId, gate]);
  return { unlocked, dismiss: () => setUnlocked(null) };
}

export default function Playbooks() {
  const { user } = useRequireAuth();
  usePageTracking('playbooks');
  const { data: profile } = useProfile();
  const isAdmin = Boolean(profile?.is_admin);

  // Admins preview any member's playbook; members only ever see their own.
  const [viewAs, setViewAs] = useState('');
  const { data: members } = useQuery({
    queryKey: ['playbook-members'],
    enabled: isAdmin,
    queryFn: async () => (await supabase.from('profiles').select('id, full_name, gate').eq('is_admin', false).is('archived_at', null).order('full_name')).data ?? [],
  });
  const viewed = isAdmin && viewAs ? members?.find(m => m.id === viewAs) : null;
  const memberId = viewed?.id ?? user?.id;
  const gate = gateNumber(viewed ? viewed.gate : profile?.gate);
  const current: GateNumber = gate ?? 1;

  const { tasks, content, member, isLoading } = useGateBuild(memberId, current);
  const brief = useDanBrief(memberId, !!viewed);
  const { data: months } = useQuery({
    queryKey: ['playbook-months', memberId],
    enabled: !!memberId,
    queryFn: async () => (await supabase.from('monthly_totals').select('month, content_posts, leads_generated, new_clients, mrr, mrr_manual')
      .eq('user_id', memberId!).order('month', { ascending: false }).limit(6)).data ?? [],
  });
  const { unlocked, dismiss } = useUnlock(viewed ? undefined : user?.id, gate);

  const gates = content?.gates ?? GATES;
  const g = gates[current - 1];
  const progress = buildProgress(tasks);
  const next = nextTask(tasks);
  const mrr = months?.[0] ? (months[0].mrr ?? months[0].mrr_manual) : null;

  return (
    <PageLayout>
      {isAdmin && (
        <div className="mb-4 flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Preview as</span>
          <select value={viewAs} onChange={e => setViewAs(e.target.value)} className="rounded-full border border-white/90 bg-white/70 px-3 py-1.5 text-sm">
            <option value="">Myself</option>
            {(members ?? []).map(m => <option key={m.id} value={m.id}>{m.full_name ?? 'Unnamed'} · {m.gate ?? 'no gate'}</option>)}
          </select>
        </div>
      )}

      {/* Level select */}
      <section className="glass relative overflow-hidden rounded-[1.75rem] p-5 sm:p-8 mb-5">
        <div className="absolute inset-x-[-10%] top-[45%] h-[420px] opacity-30 pointer-events-none hidden md:block" aria-hidden
          style={{
            backgroundImage: 'linear-gradient(rgb(133 54 245 / .35) 1px, transparent 1px), linear-gradient(90deg, rgb(133 54 245 / .35) 1px, transparent 1px)',
            backgroundSize: '56px 56px', transform: 'perspective(600px) rotateX(64deg)', transformOrigin: 'top',
            maskImage: 'linear-gradient(transparent, #000 25%, #000 55%, transparent)',
          }} />
        <div className="relative flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <h1 className="text-5xl sm:text-7xl font-black italic tracking-tighter leading-[1.15] pb-2 pr-4 -mb-2 bg-gradient-to-b from-foreground from-40% to-[#6a2ad8] bg-clip-text text-transparent">Playbooks</h1>
          <div className="flex flex-wrap gap-2">
            {mrr != null && <span className="glass-tile mono-label text-[10.5px] font-bold rounded-full px-3.5 py-2">MRR <span className="text-primary">{money(mrr)}</span></span>}
            <span className="glass-tile mono-label text-[10.5px] font-bold rounded-full px-3.5 py-2">Build <span className="text-primary">{progress.done}/{progress.total}</span></span>
            <Link to="/submissions/monthly" className="violet-grad text-white mono-label text-[10.5px] font-bold rounded-full px-3.5 py-2 shadow-[0_10px_24px_-10px_rgb(133_54_245/0.8)]">
              Check-in · {daysToCheckIn()} days →
            </Link>
          </div>
        </div>
        <LevelMap gates={gates} current={current} />
        {!gate && <p className="relative text-sm text-muted-foreground mt-4">Dan sets your gate after your kickoff call. Until then, here's where everyone starts.</p>}
        <div className="relative mt-6 md:mt-0 max-w-sm">
          <p className="mono-label text-[10.5px] font-bold text-primary">Gate {ROMAN[current]} · build progress</p>
          <p className="text-3xl font-extrabold mt-1">{progress.done}<span className="text-base text-muted-foreground font-bold"> / {progress.total} ticked</span></p>
          <div className="h-2.5 rounded-full bg-primary/10 mt-2 overflow-hidden">
            <div className="h-full rounded-full violet-grad shadow-[0_0_14px_rgb(155_92_255/0.8)] transition-[width] duration-700" style={{ width: `${progress.pct}%` }} />
          </div>
        </div>
      </section>

      <div className="grid lg:grid-cols-[1.5fr_1fr] gap-5">
        <div className="order-2 lg:order-1 space-y-5">
          <section className="glass rounded-[1.75rem] p-5 sm:p-6">
            <div className="flex items-center justify-between gap-3 mb-4">
              <h2 className="mono-label text-[12px] font-bold text-primary">Your build list</h2>
              <span className="text-xs text-muted-foreground text-right">{viewed ? `${progress.approved} approved` : 'Tap to tick · proof to Dan on WhatsApp'}</span>
            </div>
            {isLoading ? <p className="text-sm text-muted-foreground">Loading…</p> : <BuildList tasks={tasks} isAdmin={isAdmin} userId={viewed ? undefined : user?.id} />}
          </section>
        </div>
        <div className="order-1 lg:order-2 space-y-5">
          <NextMove task={next} brief={brief} isAdmin={isAdmin} userId={viewed ? undefined : user?.id} />
          <section className="glass rounded-[1.75rem] p-5 sm:p-6">
            <div className="flex items-center justify-between gap-3 mb-4">
              <h2 className="mono-label text-[12px] font-bold text-primary">Gate goals</h2>
              <span className="text-xs text-muted-foreground">Hold 2 months to move up</span>
            </div>
            <GateGoals gate={current} months={months ?? []} />
            {member?.settings.fast_track_lead_gen && <p className="text-xs font-semibold text-primary mt-3">Lead gen fast-track approved by Dan</p>}
          </section>
        </div>
      </div>

      <section className="glass rounded-[1.75rem] p-5 sm:p-6 mt-5">
        <div className="flex items-center justify-between gap-3 mb-4">
          <h2 className="mono-label text-[12px] font-bold text-primary">Trainings for {g.name}</h2>
          <Link to="/roadmap" className="text-xs font-semibold text-primary hover:underline">Full roadmap →</Link>
        </div>
        <GateTrainings
          modules={(content?.modules ?? []).filter(m => m.gate === current)}
          nextModules={current < 4 ? (content?.modules ?? []).filter(m => m.gate === current + 1) : []}
          extra={member?.settings.extra_modules ?? []}
        />
      </section>

      {unlocked && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-white/40 backdrop-blur-md p-6" onClick={dismiss} role="dialog" aria-label="Gate unlocked">
          <div className="glass rounded-[2rem] p-8 text-center max-w-sm" style={{ animation: 'unlock-pop .6s cubic-bezier(.2,.9,.3,1.3) both' }}>
            <div className="mx-auto w-28 h-28 rounded-full grid place-items-center text-white text-5xl font-black italic"
              style={{ background: 'radial-gradient(circle at 34% 28%, #fff 0%, #dcc8ff 20%, #9b5cff 55%, #4b17b0 100%)', animation: 'orb-pulse 3s ease-in-out infinite' }}>
              {ROMAN[unlocked]}
            </div>
            <p className="mono-label text-[11px] font-bold text-primary mt-6 flex items-center justify-center gap-1.5"><PartyPopper className="w-4 h-4" />Gate unlocked</p>
            <p className="text-4xl font-black italic mt-1">{gates[unlocked - 1].name}</p>
            <p className="text-sm text-muted-foreground mt-2">{gates[unlocked - 1].headline}. New build list and trainings are open.</p>
            <button onClick={dismiss} className="mt-6 violet-grad text-white rounded-full px-6 py-2.5 text-sm font-bold">Let's go</button>
          </div>
        </div>
      )}
    </PageLayout>
  );
}

import { Link } from 'react-router-dom';
import { Check, Lock, MessageCircle, Play, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { moduleName } from '@/data/modules';
import { useCanUseDanAi } from '@/lib/danAccess';
import {
  GATE_GOALS, goalStatus, helpPrompt, trainingLink,
  type GateNumber, type TaskStatus, type TaskWithStatus,
} from '@/lib/growthHub';
import { useModulePages, useTickTask, useUntickTask, type GateModule } from '@/hooks/useGrowthHub';

const STATUS: Record<TaskStatus, { label: string; cls: string }> = {
  approved: { label: 'Approved', cls: 'violet-grad text-white' },
  submitted: { label: 'Ticked', cls: 'bg-primary/10 text-primary' },
  needs_changes: { label: 'Sent back', cls: 'bg-orange-500/15 text-orange-700' },
  open: { label: 'To do', cls: 'bg-foreground/[0.06] text-muted-foreground' },
};
const KIND: Record<TaskWithStatus['kind'], string> = { kickoff: 'With Dan', once: 'Once', monthly: 'Monthly' };

function TrainingChip({ task }: { task: TaskWithStatus }) {
  const t = trainingLink(task, useModulePages());
  if (!t) return null;
  const cls = 'inline-flex items-center gap-1 text-[11.5px] font-bold rounded-full px-2.5 py-1 bg-primary/10 text-primary hover:bg-primary/15 transition-colors';
  const label = task.module_codes.length ? (t.status ? `${task.module_codes.join(' + ')} · ${t.label}` : `${t.label} · ${moduleName(task.module_codes[0])}`) : t.label;
  const icon = <Play className="w-3 h-3 fill-current" />;
  if (!t.href) return <span className={cls}>{icon}{label}</span>;
  return t.external
    ? <a href={t.href} target="_blank" rel="noreferrer" className={cls}>{icon}{label}</a>
    : <Link to={t.href} className={cls}>{icon}{label}</Link>;
}

const askHref = (task: TaskWithStatus) => `/dan-ai?q=${encodeURIComponent(helpPrompt(task))}`;
const pill = 'inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-[13px] font-bold';

/** Proof goes to Dan on WhatsApp, not into the portal. */
const proofPrompt = (task: TaskWithStatus) => `Send Dan your proof on WhatsApp${task.proof_hint ? `: ${task.proof_hint}` : ''}.`;
const canTickTask = (task: TaskWithStatus) => task.kind !== 'kickoff' && task.status !== 'approved';

/** Tick or untick a build task, with the WhatsApp proof nudge on tick. */
function useTicking(userId?: string) {
  const tick = useTickTask(userId);
  const untick = useUntickTask(userId);
  const onError = (e: Error) => toast.error(e.message);
  return {
    busy: tick.isPending || untick.isPending,
    tick: (task: TaskWithStatus) => tick.mutate(
      { task_id: task.id, period: task.period, proof_url: null, member_note: null },
      { onSuccess: () => toast.success('Ticked off', { description: proofPrompt(task) }), onError },
    ),
    untick: (task: TaskWithStatus) => untick.mutate({ task_id: task.id, period: task.period }, { onError }),
  };
}

/** The one thing to do next. Dan AI's brief when there is one, the task either way. */
export function NextMove({ task, brief, isAdmin, userId, compact = false }: { task: TaskWithStatus | null; brief: string | null; isAdmin: boolean; userId?: string; compact?: boolean }) {
  const hasPage = useModulePages();
  const canAsk = useCanUseDanAi(isAdmin);
  const training = task ? trainingLink(task, hasPage) : null;
  const ticking = useTicking(userId);
  return (
    <div className="relative overflow-hidden rounded-[1.75rem] p-5 sm:p-6 text-white violet-grad shadow-[0_30px_60px_-20px_rgb(133_54_245/0.7)]">
      <div className="absolute inset-0 bg-gradient-to-br from-white/35 via-transparent to-transparent pointer-events-none" aria-hidden />
      <div className="absolute right-5 top-5 w-12 h-12 sm:w-16 sm:h-16 rounded-full shadow-[0_0_30px_rgb(255_255_255/0.6)]"
        style={{ background: 'radial-gradient(circle at 34% 28%, #fff, #e4d4ff 30%, #a875ff 70%)', animation: 'orb-float 5s ease-in-out infinite' }} aria-hidden />
      <p className="relative mono-label text-[10.5px] font-bold opacity-85">Your next move</p>
      {task ? (
        <>
          <p className={`relative font-bold leading-snug mt-2.5 pr-16 sm:pr-20 ${compact ? 'text-lg' : 'text-xl sm:text-[22px]'}`}>{brief || task.title}</p>
          {brief && <p className="relative text-sm opacity-85 mt-2 pr-16">{task.title}</p>}
          {task.status === 'needs_changes' && task.progress?.review_note && (
            <p className="relative text-sm mt-2 bg-white/15 rounded-xl px-3 py-2">Dan: "{task.progress.review_note}"</p>
          )}
          <div className="relative flex flex-wrap gap-2 mt-4">
            {training?.href && (training.external
              ? <a href={training.href} target="_blank" rel="noreferrer" className={`${pill} bg-white text-primary`}><Play className="w-3.5 h-3.5 fill-current" />{training.status ? training.label : `Watch ${training.label}`}</a>
              : <Link to={training.href} className={`${pill} bg-white text-primary`}><Play className="w-3.5 h-3.5 fill-current" />Watch {training.label}</Link>)}
            {canAsk && (
              <Link to={askHref(task)} className={`${pill} bg-white/15 border border-white/40`}><Sparkles className="w-3.5 h-3.5" />Help me do this</Link>
            )}
            {userId && canTickTask(task) && (
              <button type="button" disabled={ticking.busy} onClick={() => ticking.tick(task)} className={`${pill} bg-white/15 border border-white/40 disabled:opacity-60`}><Check className="w-3.5 h-3.5" strokeWidth={3} />Tick it off</button>
            )}
          </div>
        </>
      ) : (
        <p className="relative font-bold text-xl mt-2.5 pr-16">{brief || 'Build list clear for this month. Hold your numbers and Dan will move you up.'}</p>
      )}
    </div>
  );
}

function TaskRow({ task, isAdmin, ticking, canTick }: {
  task: TaskWithStatus; isAdmin: boolean; ticking: ReturnType<typeof useTicking>; canTick: boolean;
}) {
  const s = STATUS[task.status];
  const canAsk = useCanUseDanAi(isAdmin);
  const kickoff = task.kind === 'kickoff';
  const ticked = task.status === 'submitted' || task.status === 'approved';
  const tickable = canTick && canTickTask(task);
  return (
    <li className="glass-tile rounded-[1.25rem] p-3.5 sm:p-4 grid grid-cols-[36px_1fr] sm:grid-cols-[40px_1fr_auto] gap-3 sm:gap-4 items-center">
      <button type="button" disabled={!tickable || ticking.busy}
        onClick={() => (task.status === 'submitted' ? ticking.untick(task) : ticking.tick(task))}
        title={kickoff ? 'Dan ticks this off after your kickoff call' : task.status === 'approved' ? 'Approved by Dan' : ticked ? 'Tap to untick' : 'Tick it off'}
        aria-label={ticked ? `Untick: ${task.title}` : `Tick off: ${task.title}`}
        className={`w-9 h-9 rounded-xl grid place-items-center transition-transform enabled:hover:scale-105 enabled:active:scale-95 disabled:cursor-default ${task.status === 'approved' ? 'violet-grad text-white shadow-[0_8px_18px_-6px_rgb(133_54_245/0.7)]' : ticked ? 'border-[1.5px] border-primary bg-primary/10 text-primary' : 'border-[1.5px] border-primary/30 bg-white/70'}`}>
        {ticked ? <Check className="w-4 h-4" strokeWidth={3} /> : kickoff ? <Lock className="w-3.5 h-3.5 text-muted-foreground" /> : null}
      </button>
      <div className="min-w-0">
        <p className="text-[15px] font-semibold leading-snug">{task.title}</p>
        {task.why && <p className="text-[12.5px] text-muted-foreground mt-0.5">{task.why}</p>}
        {task.status === 'needs_changes' && task.progress?.review_note && (
          <p className="text-[12.5px] text-orange-700 mt-1">Dan: "{task.progress.review_note}"</p>
        )}
        {task.status === 'submitted' && (
          <p className="text-[12.5px] text-primary font-semibold mt-1 inline-flex items-start gap-1"><MessageCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />{proofPrompt(task)}</p>
        )}
        <div className="flex flex-wrap items-center gap-1.5 mt-2">
          <TrainingChip task={task} />
          <span className="text-[11.5px] font-bold rounded-full px-2.5 py-1 bg-foreground/[0.06] text-muted-foreground">{KIND[task.kind]}</span>
          {canAsk && task.status !== 'approved' && (
            <Link to={askHref(task)} className="text-[11.5px] font-bold text-primary hover:underline inline-flex items-center gap-1"><Sparkles className="w-3 h-3" />Help me do this</Link>
          )}
          <span className={`sm:hidden mono-label text-[10px] font-bold rounded-full px-2.5 py-1 ${s.cls}`}>{s.label}</span>
        </div>
      </div>
      <span className={`hidden sm:inline mono-label text-[10px] font-bold rounded-full px-3 py-1.5 whitespace-nowrap ${s.cls}`}>{s.label}</span>
    </li>
  );
}

/** The gate's build list. Members tick tasks off right here and send proof on WhatsApp; Dan reviews from Client Health. */
export function BuildList({ tasks, isAdmin, userId }: { tasks: TaskWithStatus[]; isAdmin: boolean; userId?: string }) {
  const ticking = useTicking(userId);
  if (!tasks.length) return <p className="text-sm text-muted-foreground">Your build list appears once Dan sets your gate.</p>;
  return (
    <ul className="space-y-2.5">
      {tasks.map(task => <TaskRow key={task.id} task={task} isAdmin={isAdmin} ticking={ticking} canTick={!!userId} />)}
    </ul>
  );
}

type Month = { month: string; content_posts: number | null; leads_generated: number | null; new_clients: number | null };
export function GateGoals({ gate, months }: { gate: GateNumber; months: Month[] }) {
  return (
    <div className="grid grid-cols-2 gap-2.5">
      {GATE_GOALS[gate].map(goal => {
        const { value, held } = goalStatus(goal, months);
        return (
          <div key={goal.label} className="glass-tile rounded-[1.25rem] p-3.5">
            <p className="mono-label text-[10px] font-bold text-muted-foreground">{goal.label}</p>
            <p className="text-[34px] font-extrabold tracking-tight leading-none mt-2">{value ?? '–'}<span className="text-sm text-muted-foreground font-bold">/{goal.target}</span></p>
            <div className="flex gap-1.5 mt-2.5" title="Hit it 2 months in a row to hold it">
              {[...held].reverse().map((ok, i) => (
                <span key={i} className={`h-1.5 w-6 rounded-full ${ok ? 'violet-grad shadow-[0_0_8px_rgb(155_92_255/0.7)]' : 'bg-primary/15'}`} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function GateTrainings({ modules, nextModules, extra }: { modules: GateModule[]; nextModules: GateModule[]; extra: string[] }) {
  const open = [
    ...modules.map(m => ({ code: m.module_code, note: m.note })),
    ...extra.filter(code => !modules.some(m => m.module_code === code)).map(code => ({ code, note: 'Unlocked by Dan' })),
  ];
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
      {open.map(m => (
        <Link key={m.code} to={`/module/${m.code}`} className="glass-tile rounded-[1.25rem] p-3.5 hover:-translate-y-0.5 transition-transform">
          <span className="violet-grad text-white text-[11px] font-extrabold rounded-lg px-2 py-0.5">{m.code}</span>
          <p className="text-[13px] font-bold mt-2.5 leading-tight">{moduleName(m.code)}</p>
          {m.note && <p className="text-[11px] text-muted-foreground mt-1 leading-snug">{m.note}</p>}
        </Link>
      ))}
      {nextModules.slice(0, 2).map(m => (
        <div key={m.module_code} className="glass-tile rounded-[1.25rem] p-3.5 opacity-55 grayscale">
          <span className="bg-muted-foreground/40 text-white text-[11px] font-extrabold rounded-lg px-2 py-0.5">{m.module_code}</span>
          <p className="text-[13px] font-bold mt-2.5 leading-tight">{moduleName(m.module_code)}</p>
          <p className="text-[11px] text-muted-foreground mt-1 inline-flex items-center gap-1"><Lock className="w-3 h-3" />Next gate</p>
        </div>
      ))}
    </div>
  );
}

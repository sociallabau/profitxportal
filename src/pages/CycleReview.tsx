/**
 * The reflect-month review. Four sections, in order:
 *
 *   1. What happened — computed from their own check-ins, nothing asked.
 *   2. What the numbers can't say — the three open questions and a confidence read.
 *   3. The diagnostic — the 18 traffic lights, which also shortlist the projects.
 *   4. The two picks — one project to grow the business, one to tighten it.
 *
 * Saving writes one roadmap_audits row for the cycle now starting. Dan AI reads it
 * back, so what they say here is what he works from for the next three months.
 */
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, Compass, FileText, TrendingDown, TrendingUp } from 'lucide-react';
import PageLayout from '@/components/PageLayout';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { useRequireAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { usePageTracking } from '@/hooks/usePageTracking';
import { useCycleReview, useSaveCycleReview } from '@/hooks/useCycle';
import { cycleMonths } from '@/lib/cycle';
import { gateNumber } from '@/lib/growthHub';
import { AUDIT_QUESTIONS, classifyAudit, pickOptions, type Rating } from '@/lib/roadmapAudit';
import { moduleName } from '@/data/modules';

const monthLabel = (key: string) =>
  new Date(`${key}-15T12:00:00`).toLocaleDateString('en-AU', { month: 'short' });
const money = (n: number) => `$${Math.round(n).toLocaleString('en-AU')}`;

const DOTS: { r: Rating; cls: string; label: string }[] = [
  { r: 'red', cls: 'bg-destructive', label: 'Not yet' },
  { r: 'amber', cls: 'bg-warning', label: 'Kind of' },
  { r: 'green', cls: 'bg-success', label: 'Nailed it' },
];

const CONFIDENCE_AREAS = [
  { key: 'offer', label: 'Your offer', hint: 'Tiers, pricing, how easy it is to explain' },
  { key: 'content', label: 'Your content', hint: 'Posting consistently, and it landing' },
  { key: 'conversations', label: 'Your conversations', hint: 'Enough of them, and they convert' },
  { key: 'delivery', label: 'Your delivery', hint: 'Clients looked after without you drowning' },
] as const;

function Stat({ label, value, sub, trend }: { label: string; value: string; sub?: string; trend?: number | null }) {
  const Icon = trend != null && trend < 0 ? TrendingDown : TrendingUp;
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-bold text-foreground">{value}</p>
      {trend != null && (
        <p className={`mt-0.5 flex items-center gap-1 text-xs font-semibold ${trend < 0 ? 'text-destructive' : 'text-success'}`}>
          <Icon className="h-3 w-3" />{trend > 0 ? '+' : ''}{trend}% across the cycle
        </p>
      )}
      {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

function Section({ n, title, blurb, children }: { n: number; title: string; blurb: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <div className="mb-3 flex items-baseline gap-3">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/20 text-xs font-bold text-primary">{n}</span>
        <div>
          <h2 className="text-base font-semibold text-foreground">{title}</h2>
          <p className="text-xs text-muted-foreground">{blurb}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

function PickList({ title, blurb, codes, value, onPick }: {
  title: string; blurb: string; codes: string[]; value: string; onPick: (code: string) => void;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-sm font-semibold text-foreground">{title}</p>
      <p className="mb-3 text-xs text-muted-foreground">{blurb}</p>
      <div className="space-y-2">
        {codes.map(code => (
          <button
            key={code}
            type="button"
            onClick={() => onPick(code)}
            className={`flex w-full items-center gap-3 rounded-lg border p-3 text-left transition ${
              value === code ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/50'
            }`}
          >
            <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${value === code ? 'border-primary bg-primary' : 'border-muted-foreground'}`}>
              {value === code && <Check className="h-3 w-3 text-primary-foreground" />}
            </span>
            <span className="shrink-0 rounded bg-primary/20 px-2 py-0.5 text-xs font-bold text-primary">{code}</span>
            <span className="text-sm text-foreground">{moduleName(code)}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export default function CycleReview() {
  const { user } = useRequireAuth();
  const { data: profile } = useProfile();
  usePageTracking('cycle-review');
  const navigate = useNavigate();

  const { cycle, reviewed, review, numbersIn, reviewDone, saved, loading } = useCycleReview(user?.id);
  const save = useSaveCycleReview(cycle.key);
  const gate = gateNumber(profile?.gate);

  const [answers, setAnswers] = useState<Record<string, Rating>>({});
  const [movedNeedle, setMovedNeedle] = useState('');
  const [stalled, setStalled] = useState('');
  const [notDoing, setNotDoing] = useState('');
  const [confidence, setConfidence] = useState({ offer: 5, content: 5, conversations: 5, delivery: 5 });
  const [biggerCode, setBiggerCode] = useState('');
  const [betterCode, setBetterCode] = useState('');

  // The same cut the Roadmap's audit makes, so the diagnostic is one instrument wherever
  // they meet it. The picks below are capped separately, by gate.
  const includeScale = profile?.tier === 'in_flow_scale';
  const questions = useMemo(
    () => (includeScale ? AUDIT_QUESTIONS : AUDIT_QUESTIONS.filter(q => q.stage === 'launchpad')),
    [includeScale],
  );
  // Only ever offer a project for an area they were just asked to rate. pickOptions already
  // caps by gate, but a member with no gate set yet would otherwise see scale work here.
  const picks = useMemo(() => {
    const shown = new Set(questions.map(q => q.code));
    const all = pickOptions(answers, gate);
    return { bigger: all.bigger.filter(c => shown.has(c)), better: all.better.filter(c => shown.has(c)) };
  }, [answers, gate, questions]);
  const months = cycleMonths(reviewed);
  const answered = questions.filter(q => answers[q.code]).length;
  const ready = answered === questions.length && Boolean(biggerCode) && Boolean(betterCode);

  const submit = () => {
    const res = classifyAudit(answers);
    save.mutate(
      { movedNeedle, stalled, notDoing, confidence, biggerCode, betterCode, answers, issue: res.issue, focus: res.focus },
      {
        onSuccess: () => toast.success('Review saved — Dan AI has it from here'),
        onError: (e: Error) => toast.error(e.message || 'Could not save your review'),
      },
    );
  };

  if (reviewDone && saved) {
    return (
      <PageLayout>
        <div className="mx-auto max-w-2xl">
          <div className="rounded-xl border border-success/50 bg-success/10 p-6 text-center">
            <Check className="mx-auto h-8 w-8 text-success" />
            <h1 className="mt-2 text-xl font-semibold">Your review is in for this cycle</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Saved {new Date(saved.created_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'long' })}.
              Dan AI is working from it for the next three months.
            </p>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {([['Grow', saved.bigger_code], ['Tighten up', saved.better_code]] as const).map(([label, code]) => (
              <div key={label} className="rounded-xl border border-border bg-card p-4">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{label}</p>
                <p className="mt-1 font-semibold text-foreground">{code ? moduleName(code) : 'Not picked'}</p>
              </div>
            ))}
          </div>
          <Button variant="outline" className="mt-4 w-full" onClick={() => navigate('/roadmap')}>
            Open the roadmap and get into it →
          </Button>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      <div className="mx-auto max-w-2xl">
        <div className="mb-6 flex items-start gap-3">
          <Compass className="mt-1 h-6 w-6 shrink-0 text-success" />
          <div>
            <h1 className="text-2xl font-semibold">Your cycle review</h1>
            <p className="text-sm text-muted-foreground">
              Looking back on {monthLabel(months[0])}–{monthLabel(months[2])}, then setting the next three months.
            </p>
          </div>
        </div>

        {!numbersIn && (
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-warning/50 bg-warning/10 p-4">
            <p className="text-sm">
              <span className="font-semibold">Last month's numbers aren't in yet.</span>{' '}
              <span className="text-muted-foreground">The summary below is missing a month until they are.</span>
            </p>
            <Button size="sm" onClick={() => navigate('/submissions/monthly')}>
              <FileText className="mr-1.5 h-3.5 w-3.5" />Submit them
            </Button>
          </div>
        )}

        <Section n={1} title="What happened" blurb={`Straight from your check-ins — ${review.submitted} of 3 months submitted.`}>
          {review.submitted === 0 ? (
            <p className="rounded-xl border border-dashed border-border bg-card p-6 text-center text-sm text-muted-foreground">
              No check-ins for {monthLabel(months[0])}–{monthLabel(months[2])}, so there is nothing to total up.
              You can still answer the questions below.
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              <Stat label="Revenue" value={money(review.revenue.total)} trend={review.revenue.changePct} sub="Across the three months" />
              <Stat label="Profit" value={money(review.profit.total)} sub={review.profit.marginPct != null ? `${review.profit.marginPct}% margin` : 'No expenses logged'} />
              <Stat
                label="Retainers"
                value={review.retainers.end != null ? String(review.retainers.end) : '–'}
                sub={`${review.retainers.signed} signed · ${review.retainers.lost} lost`}
              />
              <Stat label="Output" value={`${review.output.posts} posts`} sub={`${review.output.convos} retainer conversations`} />
              {review.confidence.first != null && (
                <div className="rounded-xl border border-border bg-card p-4 sm:col-span-2">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Confidence</p>
                  <p className="mt-1 text-sm text-foreground">
                    You scored yourself <span className="font-bold">{review.confidence.first}/10</span> at the start of the cycle
                    {review.confidence.last != null && review.confidence.last !== review.confidence.first
                      ? <> and <span className="font-bold">{review.confidence.last}/10</span> at the end.</>
                      : '.'}
                  </p>
                </div>
              )}
            </div>
          )}
        </Section>

        <Section n={2} title="What the numbers can't say" blurb="Short answers are fine. This is what Dan AI quotes back at you.">
          <div className="space-y-4">
            {([
              ['What actually moved the needle?', movedNeedle, setMovedNeedle, 'The one or two things that genuinely made a difference.'],
              ['What stalled, and why?', stalled, setStalled, "Be straight about it — this is the blocker Dan AI will push on."],
              ["What have you decided you're not doing?", notDoing, setNotDoing, "Ruled out on purpose. Dan AI won't prescribe it again."],
            ] as const).map(([label, value, set, hint]) => (
              <div key={label}>
                <label className="block text-sm font-semibold text-foreground">{label}</label>
                <p className="mb-1.5 text-xs text-muted-foreground">{hint}</p>
                <textarea
                  value={value}
                  onChange={e => set(e.target.value)}
                  rows={3}
                  className="w-full rounded-lg border border-border bg-background p-3 text-sm focus:border-primary focus:outline-none"
                />
              </div>
            ))}
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-sm font-semibold text-foreground">Where are you right now, 1–10?</p>
              <p className="mb-3 text-xs text-muted-foreground">Anything at 4 or under becomes a priority in your advice.</p>
              <div className="space-y-3">
                {CONFIDENCE_AREAS.map(a => (
                  <div key={a.key}>
                    <div className="flex items-baseline justify-between">
                      <span className="text-sm font-medium text-foreground">{a.label}</span>
                      <span className="text-lg font-bold text-primary">{confidence[a.key]}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">{a.hint}</p>
                    <input
                      type="range" min="1" max="10" value={confidence[a.key]}
                      onChange={e => setConfidence({ ...confidence, [a.key]: Number(e.target.value) })}
                      className="mt-1 w-full accent-primary"
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Section>

        <Section n={3} title="The diagnostic" blurb={`Be honest — the reds are where the growth is. ${answered}/${questions.length} answered.`}>
          <div className="space-y-2">
            {questions.map(q => (
              <div key={q.code} className="rounded-xl border border-border bg-card p-3">
                <div className="flex items-start gap-2">
                  <span className="shrink-0 rounded bg-primary/20 px-2 py-0.5 text-xs font-bold text-primary">{q.code}</span>
                  <p className="text-sm text-foreground">{q.text}</p>
                </div>
                <div className="mt-2 flex gap-2">
                  {DOTS.map(d => (
                    <button
                      key={d.r}
                      type="button"
                      onClick={() => setAnswers({ ...answers, [q.code]: d.r })}
                      className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg border p-2 text-xs transition ${
                        answers[q.code] === d.r ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/50'
                      }`}
                    >
                      <span className={`h-3 w-3 rounded-full ${d.cls}`} />{d.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Section>

        <Section n={4} title="Pick your two projects" blurb="Weakest first, and only what's in reach at your gate. These are what the next three months are for.">
          <div className="grid gap-3 sm:grid-cols-2">
            <PickList title="Go bigger" blurb="Grow the business: offer and clients." codes={picks.bigger} value={biggerCode} onPick={setBiggerCode} />
            <PickList title="Get better" blurb="Tighten it up: delivery and team." codes={picks.better} value={betterCode} onPick={setBetterCode} />
          </div>
        </Section>

        <div className="sticky bottom-4 rounded-xl border border-border bg-card/95 p-4 backdrop-blur">
          <Button className="w-full" size="lg" disabled={!ready || save.isPending || loading} onClick={submit}>
            {save.isPending ? 'Saving…' : 'Save my review →'}
          </Button>
          {!ready && (
            <p className="mt-2 text-center text-xs text-muted-foreground">
              {answered < questions.length
                ? `${questions.length - answered} diagnostic question${questions.length - answered === 1 ? '' : 's'} left`
                : 'Pick one project on each side'}
            </p>
          )}
        </div>
      </div>
    </PageLayout>
  );
}

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { AUDIT_QUESTIONS, classifyAudit, type Rating } from '@/lib/roadmapAudit';

const DOTS: { r: Rating; cls: string; label: string }[] = [
  { r: 'red', cls: 'bg-destructive', label: 'Not yet' },
  { r: 'amber', cls: 'bg-warning', label: 'Kind of' },
  { r: 'green', cls: 'bg-success', label: 'Nailed it' },
];

export default function RoadmapAudit({ onOpenModule, includeScale }: { onOpenModule: (code: string) => void; includeScale: boolean }) {
  const QUESTIONS = includeScale ? AUDIT_QUESTIONS : AUDIT_QUESTIONS.filter(q => q.stage === 'launchpad');
  const [open, setOpen] = useState(false);
  const [answers, setAnswers] = useState<Record<string, Rating>>({});
  const [step, setStep] = useState(0);
  const done = step >= QUESTIONS.length;
  const result = classifyAudit(answers);

  const reset = () => { setAnswers({}); setStep(0); };

  const answer = async (r: Rating) => {
    const q = QUESTIONS[step];
    const next = { ...answers, [q.code]: r };
    setAnswers(next);
    setStep(step + 1);
    if (step + 1 === QUESTIONS.length) {
      const res = classifyAudit(next);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { error } = await (supabase as any).from('roadmap_audits').insert({
        user_id: user.id, answers: next, issue: res.issue, focus: res.focus,
      });
      if (error) toast.error('Could not save your audit');
    }
  };

  const q = QUESTIONS[step];

  return (
    <>
      <Button size="lg" className="mb-6 shadow-[0_0_24px_hsl(var(--primary)/0.5)]" onClick={() => { reset(); setOpen(true); }}>
        Take the Roadmap Audit
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>ProfitX Diagnostic<span className="text-primary">™</span></DialogTitle>
            {!done && <p className="text-sm text-muted-foreground">Be honest — the reds are where the growth is.</p>}
          </DialogHeader>

          {!done ? (
            <div className="space-y-6">
              <div>
                <div className="flex justify-between text-xs text-muted-foreground mb-1">
                  <span className="font-bold tracking-widest text-primary">{q.stage === 'launchpad' ? '$0–20K LAUNCHPAD' : '$30–84K SCALE'} · {q.pillar.toUpperCase()}</span>
                  <span>{step + 1} / {QUESTIONS.length}</span>
                </div>
                <div className="h-1 rounded bg-muted"><div className="h-1 rounded bg-primary transition-all" style={{ width: `${(step / QUESTIONS.length) * 100}%` }} /></div>
              </div>
              <div className="text-center space-y-3 py-4">
                <span className="inline-block rounded bg-primary/20 px-2 py-0.5 text-sm font-bold text-primary">{q.code}</span>
                <p className="text-lg font-medium">{q.text}</p>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {DOTS.map(d => (
                  <button key={d.r} onClick={() => answer(d.r)}
                    className="flex flex-col items-center gap-2 rounded-xl border border-border bg-card p-4 hover:border-primary transition">
                    <span className={`h-8 w-8 rounded-full ${d.cls}`} />
                    <span className="text-sm">{d.label}</span>
                  </button>
                ))}
              </div>
              {step > 0 && <Button variant="ghost" size="sm" onClick={() => setStep(step - 1)}>← Back</Button>}
            </div>
          ) : (
            <div className="space-y-5">
              <div className="rounded-xl border border-primary/50 bg-primary/10 p-5 text-center">
                <p className="text-xs uppercase tracking-widest text-muted-foreground">You have a</p>
                <p className="text-3xl font-bold text-primary mt-1">
                  {result.issue === 'balanced' ? 'No red flags' : result.issue === 'supply' ? 'Supply Issue' : 'Demand Issue'}
                </p>
                <p className="text-sm text-muted-foreground mt-2">
                  {result.issue === 'supply' && 'Your offer and client flow need work — fix what you sell and how leads come in.'}
                  {result.issue === 'demand' && 'Your delivery is the bottleneck — systemise and build the team so you can handle more clients.'}
                  {result.issue === 'balanced' && 'No reds — keep tightening your ambers.'}
                </p>
                <p className="text-xs text-muted-foreground mt-2">Offer + Clients reds: {result.supplyReds} · Delivery reds: {result.demandReds}</p>
              </div>
              {result.focus.length > 0 && (
                <div>
                  <p className="font-semibold mb-2">Focus on these first:</p>
                  <div className="space-y-2">
                    {result.focus.map(code => {
                      const q = QUESTIONS.find(x => x.code === code)!;
                      return (
                        <button key={code} onClick={() => { setOpen(false); onOpenModule(code); }}
                          className="w-full flex items-center gap-3 rounded-lg border border-border bg-card p-3 text-left hover:border-primary">
                          <span className={`h-3 w-3 shrink-0 rounded-full ${answers[code] === 'red' ? 'bg-destructive' : 'bg-warning'}`} />
                          <span className="shrink-0 rounded bg-primary/20 px-2 py-0.5 text-xs font-bold text-primary">{code}</span>
                          <span className="text-sm">{q.text}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
              <Button variant="outline" className="w-full" onClick={reset}>Retake audit</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

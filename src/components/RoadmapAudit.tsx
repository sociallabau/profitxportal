import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AUDIT_QUESTIONS, classifyAudit, type Rating } from '@/lib/roadmapAudit';

const DOTS: { r: Rating; cls: string }[] = [
  { r: 'red', cls: 'bg-destructive' },
  { r: 'amber', cls: 'bg-warning' },
  { r: 'green', cls: 'bg-success' },
];

export default function RoadmapAudit({ onOpenModule }: { onOpenModule: (code: string) => void }) {
  const [open, setOpen] = useState(false);
  const [answers, setAnswers] = useState<Record<string, Rating>>({});
  const [done, setDone] = useState(false);
  const complete = AUDIT_QUESTIONS.every(q => answers[q.code]);
  const result = classifyAudit(answers);

  const reset = () => { setAnswers({}); setDone(false); };

  return (
    <>
      <Button size="lg" className="mb-6 shadow-[0_0_24px_hsl(var(--primary)/0.5)]" onClick={() => { reset(); setOpen(true); }}>
        Take the Roadmap Audit
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>ProfitX Diagnostic<span className="text-primary">™</span></DialogTitle>
            {!done && <p className="text-sm text-muted-foreground">For each statement, mark where you're really at. Be honest — the reds are where the growth is.</p>}
          </DialogHeader>

          {!done ? (
            <div className="space-y-2">
              {(['launchpad', 'scale'] as const).map(stage => (
                <div key={stage} className="space-y-2">
                  <p className="text-xs font-bold tracking-widest text-primary mt-3">{stage === 'launchpad' ? '$0–20K LAUNCHPAD' : '$30–84K SCALE'}</p>
                  {AUDIT_QUESTIONS.filter(q => q.stage === stage).map(q => (
                    <div key={q.code} className="flex items-center gap-3 rounded-lg border border-border bg-card p-2.5">
                      <span className="shrink-0 rounded bg-primary/20 px-2 py-0.5 text-xs font-bold text-primary">{q.code}</span>
                      <span className="flex-1 text-sm">{q.text}</span>
                      <div className="flex gap-1.5 shrink-0">
                        {DOTS.map(d => (
                          <button key={d.r} aria-label={`${q.code} ${d.r}`}
                            onClick={() => setAnswers(a => ({ ...a, [q.code]: d.r }))}
                            className={`h-5 w-5 rounded-full ${d.cls} transition ${answers[q.code] === d.r ? 'ring-2 ring-foreground scale-110' : 'opacity-30 hover:opacity-70'}`} />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ))}
              <Button className="w-full mt-4" disabled={!complete} onClick={() => setDone(true)}>
                {complete ? 'See my results' : `Answer all ${AUDIT_QUESTIONS.length} statements`}
              </Button>
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
                      const q = AUDIT_QUESTIONS.find(x => x.code === code)!;
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

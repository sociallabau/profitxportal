import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { resourceCatalogue, vaultSources } from '@/data/resourceCatalogue';
import { toast } from 'sonner';
import { Loader2, Play, RotateCw } from 'lucide-react';

interface Test { id: string; name: string; persona_key: string; question: string; category: string; position: number }
interface Crit { criterion: string; type: string; pass: boolean; why: string }
interface CodeCheck { check: string; pass: boolean; why: string }
interface Result { id: string; test_id: string; answer: { answer?: string } | null; debug: unknown; criteria: Crit[]; code_checks: CodeCheck[]; pass: boolean | null }
interface Run { id: string; run_at: string; round: number; summary: { tests_passed?: number; tests_total?: number; criteria_passed?: number; criteria_total?: number; privacy_boundary_pass?: boolean } }

const invoke = (body: Record<string, unknown>) =>
  supabase.functions.invoke('ask-dan', { body: { catalogue: resourceCatalogue(), vault_sources: vaultSources(), ...body } });

export default function TestsAdmin() {
  const [tests, setTests] = useState<Test[]>([]);
  const [runs, setRuns] = useState<Run[]>([]);
  const [runId, setRunId] = useState<string | null>(null);
  const [results, setResults] = useState<Result[]>([]);
  const [busy, setBusy] = useState<Set<string>>(new Set());
  const [running, setRunning] = useState(false);

  const loadRuns = async () => {
    const { data } = await supabase.from('dan_ai_test_runs').select('id, run_at, round, summary').order('run_at', { ascending: false }).limit(30);
    setRuns((data as unknown as Run[]) ?? []);
    if (!runId && data?.[0]) setRunId(data[0].id);
  };
  const loadResults = async (id: string) => {
    const { data } = await supabase.from('dan_ai_test_results').select('id, test_id, answer, debug, criteria, code_checks, pass').eq('run_id', id);
    setResults((data as unknown as Result[]) ?? []);
  };
  useEffect(() => {
    supabase.from('dan_ai_tests').select('id, name, persona_key, question, category, position').eq('active', true).order('position')
      .then(({ data }) => setTests((data as Test[]) ?? []));
    loadRuns();
  }, []);
  useEffect(() => { if (runId) loadResults(runId); }, [runId]);

  const runOne = async (rid: string, t: Test) => {
    setBusy(b => new Set(b).add(t.id));
    const a = await invoke({ action: 'test', run_id: rid, test_id: t.id });
    if (!a.error) await invoke({ action: 'grade', run_id: rid, test_id: t.id });
    else toast.error(`${t.name} failed to run`);
    setBusy(b => { const n = new Set(b); n.delete(t.id); return n; });
    await loadResults(rid);
  };

  const runAll = async () => {
    setRunning(true);
    const { data } = await invoke({ action: 'start_run', round: (runs[0]?.round ?? 0) + 1 });
    const rid = data?.run_id as string;
    setRunId(rid);
    const later = tests.filter(t => t.name === 'ADS_5_DAYS_SCALE');
    await Promise.all(tests.filter(t => !later.includes(t)).map(t => runOne(rid, t)));
    for (const t of later) await runOne(rid, t);
    await invoke({ action: 'finalize', run_id: rid });
    await loadRuns();
    setRunning(false);
  };

  const rerun = async (t: Test) => {
    if (!runId) return;
    await runOne(runId, t);
    await invoke({ action: 'finalize', run_id: runId });
    loadRuns();
  };

  const passed = results.filter(r => r.pass).length;
  const critTotal = results.reduce((n, r) => n + r.criteria.length, 0);
  const critPass = results.reduce((n, r) => n + r.criteria.filter(c => c.pass).length, 0);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <button onClick={runAll} disabled={running}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50">
          {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />} Run all tests
        </button>
        {runId && (
          <p className="text-sm text-foreground">
            Tests passed <b>{passed}/{tests.length}</b> · Criteria passed <b>{critPass}/{critTotal}</b>
          </p>
        )}
      </div>

      <div className="space-y-2">
        {tests.map(t => {
          const r = results.find(x => x.test_id === t.id);
          const highlight = t.category === 'privacy' || t.category === 'boundary';
          return (
            <details key={t.id} className={`rounded-xl border p-3 ${highlight ? 'border-primary/40' : 'border-border'}`}>
              <summary className="cursor-pointer flex items-center gap-2 text-sm">
                <span className={`w-5 text-center font-bold ${r?.pass ? 'text-primary' : r ? 'text-destructive' : 'text-muted-foreground'}`}>
                  {busy.has(t.id) ? '…' : r?.pass ? '✓' : r ? '✗' : '–'}
                </span>
                <span className="font-semibold text-foreground">{t.position}. {t.name}</span>
                <span className="text-xs text-muted-foreground">{t.persona_key}{highlight ? ` · ${t.category}` : ''}</span>
                <button onClick={e => { e.preventDefault(); rerun(t); }} disabled={!runId || busy.has(t.id)}
                  className="ml-auto flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground disabled:opacity-40">
                  <RotateCw className="w-3 h-3" /> Re-run
                </button>
              </summary>
              <div className="mt-3 space-y-3 text-xs">
                <p className="text-muted-foreground"><b>Q:</b> {t.question}</p>
                {r?.answer?.answer && <pre className="whitespace-pre-wrap font-sans text-foreground bg-muted/30 rounded-lg p-3">{r.answer.answer}</pre>}
                {r && (
                  <ul className="space-y-1">
                    {r.criteria.map((c, i) => (
                      <li key={i}><span className={c.pass ? 'text-primary' : 'text-destructive'}>{c.pass ? '✓' : '✗'}</span> <b>{c.type === 'must_not' ? 'Must not: ' : ''}{c.criterion}</b> — <span className="text-muted-foreground">{c.why}</span></li>
                    ))}
                    {r.code_checks.map((c, i) => (
                      <li key={`c${i}`}><span className={c.pass ? 'text-primary' : 'text-destructive'}>{c.pass ? '✓' : '✗'}</span> <b>Code: {c.check}</b> — <span className="text-muted-foreground">{c.why}</span></li>
                    ))}
                  </ul>
                )}
                {r?.debug != null && (
                  <details><summary className="cursor-pointer text-muted-foreground">Debug</summary>
                    <pre className="whitespace-pre-wrap text-[10px] text-muted-foreground mt-1">{JSON.stringify(r.debug, null, 2)}</pre>
                  </details>
                )}
              </div>
            </details>
          );
        })}
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Run history</p>
        <div className="space-y-1">
          {runs.map(r => (
            <button key={r.id} onClick={() => setRunId(r.id)}
              className={`w-full flex justify-between text-xs px-3 py-2 rounded-lg ${r.id === runId ? 'bg-primary/15 text-foreground' : 'text-muted-foreground hover:bg-muted/40'}`}>
              <span>Round {r.round} · {new Date(r.run_at).toLocaleString()}</span>
              <span>{r.summary?.tests_passed ?? '–'}/{r.summary?.tests_total ?? '–'} tests · {r.summary?.criteria_passed ?? '–'}/{r.summary?.criteria_total ?? '–'} criteria{r.summary?.privacy_boundary_pass === false ? ' · privacy/boundary ✗' : ''}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

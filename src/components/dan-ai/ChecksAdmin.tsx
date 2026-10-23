import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

interface Check {
  id: string;
  question: string;
  draft: { answer?: string } | null;
  final: { answer?: string } | null;
  pass: boolean;
  issues: { type?: string; note?: string }[] | null;
  created_at: string;
}

export default function ChecksAdmin() {
  const [checks, setChecks] = useState<Check[]>([]);
  const [privacyOnly, setPrivacyOnly] = useState(false);

  useEffect(() => {
    supabase
      .from('dan_ai_checks')
      .select('id, question, draft, final, pass, issues, created_at')
      .order('created_at', { ascending: false })
      .limit(200)
      .then(({ data }) => setChecks((data as Check[]) ?? []));
  }, []);

  const shown = privacyOnly
    ? checks.filter(c => (c.issues ?? []).some(i => i.type === 'privacy'))
    : checks;

  return (
    <div className="space-y-3">
      <label className="flex items-center gap-2 text-xs text-muted-foreground">
        <input type="checkbox" checked={privacyOnly} onChange={e => setPrivacyOnly(e.target.checked)} />
        Only show privacy issues
      </label>
      {shown.length === 0 && <p className="text-sm text-muted-foreground py-8 text-center">No checks yet.</p>}
      {shown.map(c => (
        <div key={c.id} className="border border-border rounded-2xl p-4 space-y-2">
          <div className="flex items-start justify-between gap-3">
            <p className="text-sm font-semibold text-foreground">{c.question}</p>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${c.pass ? 'bg-primary/10 text-primary border-primary/20' : 'bg-destructive/10 text-destructive border-destructive/25'}`}>
              {c.pass ? 'Passed' : 'Fixed'}
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground">{new Date(c.created_at).toLocaleString()}</p>
          {(c.issues ?? []).length > 0 && (
            <ul className="space-y-1">
              {(c.issues ?? []).map((i, idx) => (
                <li key={idx} className="text-xs text-foreground">
                  <span className="font-semibold uppercase text-[10px] text-primary mr-1.5">{i.type}</span>{i.note}
                </li>
              ))}
            </ul>
          )}
          <details className="text-xs">
            <summary className="cursor-pointer text-muted-foreground">Draft vs final</summary>
            <div className="grid sm:grid-cols-2 gap-3 mt-2">
              <pre className="whitespace-pre-wrap font-sans text-muted-foreground bg-muted/30 rounded-lg p-3">{c.draft?.answer}</pre>
              <pre className="whitespace-pre-wrap font-sans text-foreground bg-muted/30 rounded-lg p-3">{c.final?.answer}</pre>
            </div>
          </details>
        </div>
      ))}
    </div>
  );
}

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Save, EyeOff, Eye } from 'lucide-react';
import { toast } from 'sonner';
import PageLayout from '@/components/PageLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/lib/supabase';
import { useGrowthHubContent } from '@/hooks/useGrowthHub';
import { ROMAN, type GateNumber, type GrowthHubTask, type TaskKind } from '@/lib/growthHub';

type Draft = Omit<GrowthHubTask, 'id'> & { id?: string };
const blank = (gate: GateNumber, position: number): Draft => ({
  gate, position, title: '', why: '', kind: 'monthly', module_codes: [], training_label: null, training_url: null, proof_hint: '', active: true,
});

function TaskEditor({ task, onSaved }: { task: Draft; onSaved: () => void }) {
  const [d, setD] = useState<Draft>(task);
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD(prev => ({ ...prev, [k]: v }));
  const save = useMutation({
    mutationFn: async (draft: Draft) => {
      const row = { ...draft, title: draft.title.trim(), training_label: draft.training_label?.trim() || null, training_url: draft.training_url?.trim() || null, updated_at: new Date().toISOString() };
      const { error } = draft.id
        ? await supabase.from('playbook_tasks').update(row).eq('id', draft.id)
        : await supabase.from('playbook_tasks').insert(row);
      if (error) throw error;
    },
    onSuccess: (_, draft) => { setD(draft); toast.success('Saved'); onSaved(); },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <div className={`bg-card border border-border rounded-2xl p-4 space-y-3 ${d.active ? '' : 'opacity-60'}`}>
      <div className="flex gap-2">
        <Input value={d.position} type="number" onChange={e => set('position', Number(e.target.value))} className="w-16" aria-label="Order" />
        <Input value={d.title} onChange={e => set('title', e.target.value)} placeholder="Task, e.g. Post 4 BTS videos…" className="flex-1 font-semibold" />
      </div>
      <Textarea value={d.why} onChange={e => set('why', e.target.value)} placeholder="Why (one line)" rows={2} />
      <div className="grid sm:grid-cols-2 gap-2">
        <select value={d.kind} onChange={e => set('kind', e.target.value as TaskKind)} className="rounded-xl border border-input bg-white/70 px-3 py-2 text-sm">
          <option value="monthly">Monthly (resets each month)</option>
          <option value="once">Once</option>
          <option value="kickoff">Kickoff (Dan ticks it)</option>
        </select>
        <Input value={d.module_codes.join(', ')} onChange={e => set('module_codes', e.target.value.toUpperCase().split(/[,\s]+/).filter(Boolean))} placeholder="Modules, e.g. C1, C2" />
        <Input value={d.training_label ?? ''} onChange={e => set('training_label', e.target.value)} placeholder="Training name (if no module)" />
        <Input value={d.training_url ?? ''} onChange={e => set('training_url', e.target.value)} placeholder="Training link (Loom etc.)" />
      </div>
      <Input value={d.proof_hint} onChange={e => set('proof_hint', e.target.value)} placeholder="Proof to send, e.g. Post links + Ads Manager screenshot" />
      <div className="flex gap-2 justify-end">
        {d.id && (
          <Button variant="ghost" size="sm" disabled={save.isPending} onClick={() => save.mutate({ ...d, active: !d.active })}>
            {d.active ? <><EyeOff /> Hide</> : <><Eye /> Show</>}
          </Button>
        )}
        <Button size="sm" disabled={!d.title.trim() || save.isPending} onClick={() => save.mutate(d)}><Save /> Save</Button>
      </div>
    </div>
  );
}

export default function GrowthHubEditor() {
  const qc = useQueryClient();
  const { data } = useGrowthHubContent();
  const [gate, setGate] = useState<GateNumber>(1);
  const [adding, setAdding] = useState(false);
  const refresh = () => { setAdding(false); qc.invalidateQueries({ queryKey: ['growth-hub-content'] }); };
  const tasks = (data?.tasks ?? []).filter(t => t.gate === gate);
  return (
    <PageLayout>
      <h1 className="text-4xl mb-1">Growth Hub Editor</h1>
      <p className="text-sm text-muted-foreground mb-6">The build list members see for each gate. Changes show straight away, and Dan AI uses them in its answers.</p>
      <div className="flex flex-wrap gap-2 mb-5">
        {(data?.gates ?? []).map(g => (
          <button key={g.gate} onClick={() => { setGate(g.gate); setAdding(false); }}
            className={`rounded-full px-4 py-2 text-sm font-bold ${gate === g.gate ? 'violet-grad text-white' : 'bg-card border border-border'}`}>
            Gate {ROMAN[g.gate]} · {g.name}
          </button>
        ))}
      </div>
      <div className="space-y-3">
        {tasks.map(t => <TaskEditor key={t.id} task={t} onSaved={refresh} />)}
        {adding
          ? <TaskEditor task={blank(gate, (tasks.at(-1)?.position ?? 0) + 1)} onSaved={refresh} />
          : <Button variant="outline" onClick={() => setAdding(true)}><Plus /> Add a task to Gate {ROMAN[gate]}</Button>}
      </div>
    </PageLayout>
  );
}

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, RotateCcw, Sparkles, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/lib/supabase';
import { useGateBuild, useReviewTask } from '@/hooks/usePlaybook';
import { PROFITX_MODULES } from '@/data/modules';
import { GATES, ROMAN, buildProgress, gateLabel, gateNumber, type GateNumber } from '@/lib/playbook';

/**
 * Dan's controls for one member: set their gate, approve or send back build
 * proof, lead gen fast-track, extra modules, and what Dan AI currently knows.
 */
export default function PlaybookPanel({ memberId, gate: gateRaw }: { memberId: string; gate: string | null }) {
  const qc = useQueryClient();
  const gate = gateNumber(gateRaw);
  const { tasks, member } = useGateBuild(memberId, gate);
  const review = useReviewTask(memberId);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const progress = buildProgress(tasks);

  const setGate = useMutation({
    mutationFn: async (g: GateNumber) => {
      const { error } = await supabase.from('profiles').update({ gate: gateLabel(g) }).eq('id', memberId);
      if (error) throw error;
    },
    onSuccess: () => { toast.success('Gate updated'); qc.invalidateQueries(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveSettings = useMutation({
    mutationFn: async (patch: { fast_track_lead_gen?: boolean; extra_modules?: string[] }) => {
      const { data: auth } = await supabase.auth.getUser();
      const { error } = await supabase.from('member_playbook').upsert({
        user_id: memberId, ...patch,
        ...(patch.fast_track_lead_gen ? { fast_track_since: new Date().toISOString().slice(0, 10) } : {}),
        updated_at: new Date().toISOString(), updated_by: auth.user?.id ?? null,
      }, { onConflict: 'user_id' });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['member-playbook', memberId] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const { data: memory, refetch: refetchMemory } = useQuery({
    queryKey: ['member-memory', memberId],
    queryFn: async () => (await supabase.from('member_memory').select('summary, brief, refreshed_at, instagram_handle, instagram_fetched_at').eq('user_id', memberId).maybeSingle()).data,
  });
  const refreshMemory = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.functions.invoke('ask-dan', { body: { action: 'refresh_memory', member_id: memberId } });
      if (error) throw error;
    },
    onSuccess: () => { toast.success('Dan AI memory refreshed'); refetchMemory(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const extra = member?.settings.extra_modules ?? [];
  const toggleModule = (code: string) =>
    saveSettings.mutate({ extra_modules: extra.includes(code) ? extra.filter(c => c !== code) : [...extra, code] });

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs font-semibold text-muted-foreground mb-2">Gate</p>
        <div className="flex flex-wrap gap-1.5">
          {GATES.map(g => (
            <button key={g.gate} disabled={setGate.isPending} onClick={() => setGate.mutate(g.gate)}
              className={`rounded-full px-3 py-1.5 text-xs font-bold ${gate === g.gate ? 'violet-grad text-white' : 'bg-muted text-muted-foreground hover:text-foreground'}`}>
              {ROMAN[g.gate]} · {g.name}
            </button>
          ))}
        </div>
      </div>

      {gate && (
        <div>
          <p className="text-xs font-semibold text-muted-foreground mb-2">Build list · {progress.done}/{progress.total} approved</p>
          <div className="space-y-2">
            {tasks.map(t => (
              <div key={t.id} className="rounded-xl border border-border p-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-semibold">{t.title}</p>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground whitespace-nowrap">
                    {t.status === 'open' ? (t.kind === 'kickoff' ? 'kickoff' : 'not submitted') : t.status.replace('_', ' ')}
                  </span>
                </div>
                {t.progress?.proof_url && (
                  <a href={t.progress.proof_url} target="_blank" rel="noreferrer" className="text-xs text-primary inline-flex items-center gap-1 mt-1 break-all">
                    <ExternalLink className="w-3 h-3 shrink-0" />{t.progress.proof_url}
                  </a>
                )}
                {t.progress?.member_note && <p className="text-xs text-muted-foreground mt-1">"{t.progress.member_note}"</p>}
                {t.status !== 'approved' && (t.status !== 'open' || t.kind === 'kickoff') && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    <Button size="sm" disabled={review.isPending} onClick={() => review.mutate({ task_id: t.id, period: t.period, status: 'approved' })}>
                      <Check /> Approve
                    </Button>
                    {t.kind !== 'kickoff' && (
                      <>
                        <input value={notes[t.id] ?? ''} onChange={e => setNotes(n => ({ ...n, [t.id]: e.target.value }))}
                          placeholder="What to fix" className="flex-1 min-w-[120px] px-3 py-1.5 rounded-full border border-input text-xs" />
                        <Button size="sm" variant="outline" disabled={review.isPending || !notes[t.id]?.trim()}
                          onClick={() => review.mutate({ task_id: t.id, period: t.period, status: 'needs_changes', review_note: notes[t.id].trim() })}>
                          <RotateCcw /> Send back
                        </Button>
                      </>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <label className="flex items-center justify-between gap-3 rounded-xl border border-border p-3">
        <span>
          <span className="text-sm font-semibold block">Lead gen fast-track</span>
          <span className="text-xs text-muted-foreground">Higher revenue but few retainers: allow lead gen ads before Gate 3. Dan AI follows this.</span>
        </span>
        <Switch checked={!!member?.settings.fast_track_lead_gen} onCheckedChange={v => saveSettings.mutate({ fast_track_lead_gen: v })} />
      </label>

      <div>
        <p className="text-xs font-semibold text-muted-foreground mb-2">Extra modules unlocked</p>
        <div className="flex flex-wrap gap-1.5">
          {Object.keys(PROFITX_MODULES).map(code => (
            <button key={code} onClick={() => toggleModule(code)} title={PROFITX_MODULES[code]}
              className={`rounded-lg px-2 py-1 text-[11px] font-bold ${extra.includes(code) ? 'violet-grad text-white' : 'bg-muted text-muted-foreground'}`}>
              {code}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-primary/30 bg-primary/5 p-3">
        <div className="flex items-center justify-between gap-2 mb-2">
          <p className="text-xs font-semibold text-primary flex items-center gap-1"><Sparkles className="w-3.5 h-3.5" />What Dan AI knows</p>
          <Button size="sm" variant="ghost" disabled={refreshMemory.isPending} onClick={() => refreshMemory.mutate()}>
            {refreshMemory.isPending ? 'Refreshing…' : 'Refresh'}
          </Button>
        </div>
        {memory?.summary
          ? <p className="text-xs whitespace-pre-line leading-relaxed">{memory.summary}</p>
          : <p className="text-xs text-muted-foreground">No memory yet. It builds after their next question or check-in, or hit Refresh.</p>}
        {memory?.brief && <p className="text-xs mt-2 pt-2 border-t border-primary/20"><span className="font-semibold">They see:</span> {memory.brief}</p>}
        <p className="text-[10px] text-muted-foreground mt-2">
          {memory?.refreshed_at ? `Updated ${new Date(memory.refreshed_at).toLocaleString()}` : ''}
          {memory?.instagram_handle ? ` · IG @${memory.instagram_handle}${memory.instagram_fetched_at ? ` pulled ${new Date(memory.instagram_fetched_at).toLocaleDateString()}` : ''}` : ''}
        </p>
      </div>
    </div>
  );
}

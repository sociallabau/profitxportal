import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import {
  GATES, monthKey, withStatus,
  type GateNumber, type PlaybookGate, type PlaybookTask, type TaskProgress, type TaskWithStatus,
} from '@/lib/playbook';

export type GateModule = { gate: GateNumber; module_code: string; note: string | null; position: number };
export type MemberPlaybook = { fast_track_lead_gen: boolean; fast_track_since: string | null; extra_modules: string[] };

/** Gate copy, every task and every gate→module link. Same for all members, so cached long. */
export function usePlaybookContent() {
  return useQuery({
    queryKey: ['playbook-content'],
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      const [gates, tasks, modules] = await Promise.all([
        supabase.from('playbook_gates').select('gate, name, headline, focus, what_you_get').order('gate'),
        supabase.from('playbook_tasks').select('*').order('gate').order('position'),
        supabase.from('playbook_gate_modules').select('gate, module_code, note, position').order('gate').order('position'),
      ]);
      return {
        // Before the migration runs the tables don't exist: fall back to the built-in gate copy.
        gates: (gates.data?.length ? gates.data : GATES) as PlaybookGate[],
        tasks: (tasks.data ?? []) as PlaybookTask[],
        modules: (modules.data ?? []) as GateModule[],
      };
    },
  });
}

/** One member's ticks, proof and Dan's settings for them. */
export function useMemberPlaybook(userId?: string | null) {
  return useQuery({
    queryKey: ['member-playbook', userId],
    enabled: !!userId,
    queryFn: async () => {
      const [progress, settings] = await Promise.all([
        supabase.from('member_task_progress').select('*').eq('user_id', userId!),
        supabase.from('member_playbook').select('fast_track_lead_gen, fast_track_since, extra_modules').eq('user_id', userId!).maybeSingle(),
      ]);
      return {
        progress: (progress.data ?? []) as TaskProgress[],
        settings: (settings.data ?? { fast_track_lead_gen: false, fast_track_since: null, extra_modules: [] }) as MemberPlaybook,
      };
    },
  });
}

/** A gate's build list with this member's status for the current month. */
export function useGateBuild(userId: string | null | undefined, gate: GateNumber | null, month = monthKey()) {
  const content = usePlaybookContent();
  const member = useMemberPlaybook(userId);
  const tasks: TaskWithStatus[] = gate && content.data
    ? withStatus(content.data.tasks.filter(t => t.gate === gate), member.data?.progress ?? [], month)
    : [];
  return { tasks, content: content.data, member: member.data, isLoading: content.isLoading || member.isLoading };
}

export type SubmitTask = { task_id: string; period: string; proof_url: string | null; member_note: string | null };

/** Member submits proof (the DB trigger forces status back to 'submitted'). */
export function useSubmitTasks(userId?: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (rows: SubmitTask[]) => {
      if (!rows.length) return;
      const { error } = await supabase.from('member_task_progress').upsert(
        rows.map(r => ({ ...r, user_id: userId!, status: 'submitted' })),
        { onConflict: 'user_id,task_id,period' },
      );
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['member-playbook', userId] }),
  });
}

/** Admin: approve or send back a task (or tick a kickoff task on the member's behalf). */
export function useReviewTask(userId?: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (r: { task_id: string; period: string; status: 'approved' | 'needs_changes'; review_note?: string | null }) => {
      const { data: auth } = await supabase.auth.getUser();
      const { error } = await supabase.from('member_task_progress').upsert({
        user_id: userId!, task_id: r.task_id, period: r.period, status: r.status,
        review_note: r.review_note ?? null, reviewed_at: new Date().toISOString(), reviewed_by: auth.user?.id ?? null,
      }, { onConflict: 'user_id,task_id,period' });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['member-playbook', userId] }),
  });
}

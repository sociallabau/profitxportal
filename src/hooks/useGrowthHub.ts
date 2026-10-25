import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import {
  GATES, monthKey, withStatus,
  type GateNumber, type GrowthHubGate, type GrowthHubTask, type TaskProgress, type TaskTracking, type TaskWithStatus,
} from '@/lib/growthHub';

// member_task_tracking is newer than the generated Supabase types; Lovable regenerates them after the migration.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const trackingTable = () => (supabase as any).from('member_task_tracking');

export type GateModule = { gate: GateNumber; module_code: string; note: string | null; position: number };
export type MemberGrowthHub = { fast_track_lead_gen: boolean; fast_track_since: string | null; extra_modules: string[] };

/** Which modules have training content, same list the Roadmap tiles use. */
export function useModulePages() {
  const { data = [], isSuccess } = useQuery({
    queryKey: ['module-pages-list'],
    queryFn: async () => (await supabase.from('module_pages').select('module_id')).data?.map(d => d.module_id) ?? [],
  });
  return isSuccess ? (code: string) => data.includes(code) : undefined;
}

/** Gate copy, every task and every gate→module link. Same for all members, so cached long. */
export function useGrowthHubContent() {
  return useQuery({
    queryKey: ['growth-hub-content'],
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      const [gates, tasks, modules] = await Promise.all([
        supabase.from('playbook_gates').select('gate, name, headline, focus, what_you_get').order('gate'),
        supabase.from('playbook_tasks').select('*').order('gate').order('position'),
        supabase.from('playbook_gate_modules').select('gate, module_code, note, position').order('gate').order('position'),
      ]);
      return {
        // Before the migration runs the tables don't exist: fall back to the built-in gate copy.
        gates: (gates.data?.length ? gates.data : GATES) as GrowthHubGate[],
        tasks: (tasks.data ?? []) as GrowthHubTask[],
        modules: (modules.data ?? []) as GateModule[],
      };
    },
  });
}

/** One member's ticks, proof and Dan's settings for them. */
export function useMemberGrowthHub(userId?: string | null) {
  return useQuery({
    queryKey: ['member-growth-hub', userId],
    enabled: !!userId,
    queryFn: async () => {
      const [progress, settings, tracking] = await Promise.all([
        supabase.from('member_task_progress').select('*').eq('user_id', userId!),
        supabase.from('member_playbook').select('fast_track_lead_gen, fast_track_since, extra_modules').eq('user_id', userId!).maybeSingle(),
        // Before the tracking migration runs this table doesn't exist; the build list just shows no tallies.
        trackingTable().select('task_id, period, working, count').eq('user_id', userId!),
      ]);
      return {
        progress: (progress.data ?? []) as TaskProgress[],
        tracking: (tracking.data ?? []) as TaskTracking[],
        settings: (settings.data ?? { fast_track_lead_gen: false, fast_track_since: null, extra_modules: [] }) as MemberGrowthHub,
      };
    },
  });
}

/** A gate's build list with this member's status for the current month. */
export function useGateBuild(userId: string | null | undefined, gate: GateNumber | null, month = monthKey()) {
  const content = useGrowthHubContent();
  const member = useMemberGrowthHub(userId);
  const tasks: TaskWithStatus[] = gate && content.data
    ? withStatus(content.data.tasks.filter(t => t.gate === gate), member.data?.progress ?? [], month, member.data?.tracking ?? [])
    : [];
  return { tasks, content: content.data, member: member.data, isLoading: content.isLoading || member.isLoading };
}

export type TickTask = { task_id: string; period: string; proof_url: string | null; member_note: string | null };

/** Member ticks a task off (the DB trigger keeps it 'submitted' until Dan reviews). */
export function useTickTask(userId?: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (t: TickTask) => {
      const { error } = await supabase.from('member_task_progress')
        .upsert({ ...t, user_id: userId!, status: 'submitted' }, { onConflict: 'user_id,task_id,period' });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['member-growth-hub', userId] }),
  });
}

/** Member updates their running tally or "working on it" on a monthly task (not a tick; Dan doesn't review it). */
export function useTrackTask(userId?: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (t: { task_id: string; period: string; working: boolean; count: number }) => {
      const { error } = await trackingTable()
        .upsert({ ...t, user_id: userId!, updated_at: new Date().toISOString() }, { onConflict: 'user_id,task_id,period' });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['member-growth-hub', userId] }),
  });
}

/** Member unticks a task Dan hasn't approved yet. */
export function useUntickTask(userId?: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (t: { task_id: string; period: string }) => {
      const { error } = await supabase.from('member_task_progress').delete()
        .eq('user_id', userId!).eq('task_id', t.task_id).eq('period', t.period);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['member-growth-hub', userId] }),
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
    onSuccess: () => qc.invalidateQueries({ queryKey: ['member-growth-hub', userId] }),
  });
}

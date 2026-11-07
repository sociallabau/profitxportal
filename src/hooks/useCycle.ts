/**
 * The reflect-month review: what the cycle did, and what the member says about it.
 *
 * Everything numeric is computed from their own check-ins (src/lib/cycle.ts), so the
 * review only ever asks the three things the numbers cannot answer plus a confidence
 * read. The answers land on a roadmap_audits row keyed to the cycle now starting,
 * which is what Dan AI reads back.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { cycleBefore, cycleMonths, cycleOf, reviewCycle, type Cycle, type CycleReview, type CycleTotals } from '@/lib/cycle';
import type { Rating } from '@/lib/roadmapAudit';

/** Only the columns the review adds up. A new check-in field is invisible here until it is listed. */
const TOTALS_COLUMNS =
  'month, total_revenue, expenses, active_retainers, retainers_lost, new_clients, content_posts, retainer_convos, business_confidence';

export type CycleState = {
  /** The cycle we are in now. Its key is what a saved review is filed under. */
  cycle: Cycle;
  /** The cycle the review looks back on: the three months that just ran. */
  reviewed: Cycle;
  review: CycleReview;
  /** Last month's check-in is in — the step every month asks for. */
  numbersIn: boolean;
  /** This cycle's review is already saved. */
  reviewDone: boolean;
  loading: boolean;
};

export function useCycleReview(userId: string | undefined, now = new Date()) {
  const cycle = cycleOf(now);
  const reviewed = cycleBefore(cycle);

  const { data: totals, isLoading: totalsLoading } = useQuery({
    queryKey: ['cycle-totals', userId, cycle.key],
    enabled: Boolean(userId),
    queryFn: async () => {
      // The reviewed cycle plus the month just gone, which is the "numbers in" check.
      const from = `${cycleMonths(reviewed)[0]}-01`;
      const { data, error } = await supabase
        .from('monthly_totals')
        .select(TOTALS_COLUMNS)
        .eq('user_id', userId ?? '')
        .gte('month', from)
        .order('month', { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as CycleTotals[];
    },
  });

  const { data: saved, isLoading: savedLoading } = useQuery({
    queryKey: ['cycle-audit', userId, cycle.key],
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('roadmap_audits')
        .select('id, created_at, bigger_code, better_code, moved_needle, stalled, not_doing, confidence_offer, confidence_content, confidence_conversations, confidence_delivery')
        .eq('user_id', userId ?? '')
        .eq('cycle_key', cycle.key)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const rows = totals ?? [];
  const state: CycleState = {
    cycle,
    reviewed,
    review: reviewCycle(reviewed, rows),
    numbersIn: rows.some(r => String(r.month).slice(0, 7) === cycle.previousMonth),
    reviewDone: Boolean(saved),
    loading: totalsLoading || savedLoading,
  };
  return { ...state, saved: saved ?? null };
}

export type CycleAnswers = {
  movedNeedle: string;
  stalled: string;
  notDoing: string;
  confidence: { offer: number; content: number; conversations: number; delivery: number };
  biggerCode: string;
  betterCode: string;
  /** The audit answers, so the review keeps doubling as the diagnostic. */
  answers: Record<string, Rating>;
  issue: string;
  focus: string[];
};

export function useSaveCycleReview(cycleKey: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (a: CycleAnswers) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Sign in again to save your review');
      const trim = (v: string) => (v.trim() ? v.trim() : null);
      const { error } = await supabase.from('roadmap_audits').insert({
        user_id: user.id,
        cycle_key: cycleKey,
        answers: a.answers,
        issue: a.issue,
        focus: a.focus,
        bigger_code: a.biggerCode || null,
        better_code: a.betterCode || null,
        moved_needle: trim(a.movedNeedle),
        stalled: trim(a.stalled),
        not_doing: trim(a.notDoing),
        confidence_offer: a.confidence.offer,
        confidence_content: a.confidence.content,
        confidence_conversations: a.confidence.conversations,
        confidence_delivery: a.confidence.delivery,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cycle-audit'] });
    },
  });
}

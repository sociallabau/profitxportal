import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from './useAuth';

export function useGoal() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const goal = useQuery({
    queryKey: ['goal', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from('goals')
        .select('*')
        .eq('user_id', user!.id)
        .maybeSingle();
      return data;
    },
  });

  const setGoal = useMutation({
    mutationFn: async (values: {
      target_mrr: number;
      starting_mrr: number;
      target_date: string;
      retainer_tier_1?: number | null;
      retainer_tier_2?: number | null;
      retainer_tier_3?: number | null;
    }) => {
      // Resolve a valid session, retrying briefly in case the JWT hasn't
      // finished attaching yet (common right after signup/email confirm).
      const getUid = async () => {
        const { data: { session } } = await supabase.auth.getSession();
        return session?.user?.id ?? null;
      };
      let uid = await getUid();
      if (!uid) {
        await supabase.auth.refreshSession().catch(() => {});
        for (let i = 0; i < 5 && !uid; i++) {
          await new Promise(r => setTimeout(r, 300));
          uid = await getUid();
        }
      }
      uid = uid ?? user?.id ?? null;
      if (!uid) {
        throw new Error('Could not verify your session. Please refresh the page and try again.');
      }
      const { error } = await supabase.from('goals').upsert(
        { user_id: uid, ...values } as any,
        { onConflict: 'user_id' }
      );
      if (error) {
        if (error.message?.includes('row-level security')) {
          throw new Error('Could not verify your session. Please refresh the page and try again.');
        }
        throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['goal'] }),
  });

  return { goal, setGoal };
}

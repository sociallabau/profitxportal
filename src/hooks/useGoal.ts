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
      // Always pull the live session — the cached `user` may be stale/expired,
      // which causes RLS inserts to fail with "new row violates row-level security policy".
      const { data: { session } } = await supabase.auth.getSession();
      const uid = session?.user?.id;
      if (!uid) {
        throw new Error('Your session has expired. Please sign in again to save your goal.');
      }
      const { error } = await supabase.from('goals').upsert(
        { user_id: uid, ...values } as any,
        { onConflict: 'user_id' }
      );
      if (error) {
        // Surface a friendlier message for the most common cause
        if (error.message?.includes('row-level security')) {
          throw new Error('Your session has expired. Please sign in again to save your goal.');
        }
        throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['goal'] }),
  });

  return { goal, setGoal };
}

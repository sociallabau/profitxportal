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
    mutationFn: async (values: { target_mrr: number; starting_mrr: number; target_date: string }) => {
      const { error } = await supabase.from('goals').upsert(
        { user_id: user!.id, ...values },
        { onConflict: 'user_id' }
      );
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['goal'] }),
  });

  return { goal, setGoal };
}

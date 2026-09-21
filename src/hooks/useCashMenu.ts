import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

export function useCashMenu() {
  const queryClient = useQueryClient();

  const { data: completed = [] } = useQuery({
    queryKey: ['cash-menu'],
    queryFn: async () => {
      const { data } = await supabase
        .from('cash_menu_actions')
        .select('action_key');
      return (data ?? []).map(row => row.action_key);
    },
  });

  const markDone = useMutation({
    mutationFn: async (actionKey: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from('cash_menu_actions').upsert({
        user_id: user!.id,
        action_key: actionKey,
        completed_at: new Date().toISOString(),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cash-menu'] });
      queryClient.invalidateQueries({ queryKey: ['cash-menu-count'] });
    },
  });

  return { completed, markDone: markDone.mutate };
}

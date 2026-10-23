import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { ContextAnswers } from '@/lib/contextRoom';
import { carryOverContext } from '@/lib/contextCarryover';

export function useContextRoom(userId: string, enabled = true) {
  const qc = useQueryClient();
  const room = useQuery({
    queryKey: ['context-room', userId], enabled: enabled && !!userId,
    queryFn: async () => {
      const { data, error } = await supabase.from('context_rooms').select('*').eq('user_id', userId).maybeSingle();
      if (error) throw error;
      const { data: profile, error: profileError } = await supabase.from('profiles').select('business_overview').eq('id', userId).maybeSingle();
      if (profileError) throw profileError;
      if (data) return { ...data, answers: carryOverContext(data.answers as ContextAnswers, profile?.business_overview) };
      // Ignore a concurrent creator rather than replacing their answers.
      const { error: insertError } = await supabase.from('context_rooms').upsert({ user_id: userId, answers: carryOverContext({}, profile?.business_overview) }, { onConflict: 'user_id', ignoreDuplicates: true });
      if (insertError) throw insertError;
      const { data: created, error: readError } = await supabase.from('context_rooms').select('*').eq('user_id', userId).single();
      if (readError) throw readError;
      return created;
    },
  });
  const save = useMutation({
    mutationFn: async ({ section, answers, adminEdit = false }: { section: string; answers: ContextAnswers; adminEdit?: boolean }) => {
      const { error } = await supabase.rpc('save_context_section', { _user_id: userId, _section: section, _answers: answers, _admin_edit: adminEdit });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['context-room', userId] }),
  });
  const confirm = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('context_rooms').update({ confirmed_at: new Date().toISOString() }).eq('user_id', userId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['context-room', userId] }),
  });
  return { room, save, confirm };
}

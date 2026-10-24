import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

/**
 * Dan AI's member-facing "next move" line, written with the member's memory.
 * Members read their own via my_dan_brief(); an admin previewing a member reads
 * member_memory directly (admin-only RLS). Null until the first memory refresh.
 */
export function useDanBrief(memberId: string | null | undefined, adminPreview = false): string | null {
  const { data } = useQuery({
    queryKey: ['dan-brief', memberId, adminPreview],
    enabled: !!memberId,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      if (adminPreview) {
        const { data } = await supabase.from('member_memory').select('brief').eq('user_id', memberId!).maybeSingle();
        return data?.brief ?? null;
      }
      const { data } = await supabase.rpc('my_dan_brief');
      return data?.[0]?.brief ?? null;
    },
  });
  return data ?? null;
}

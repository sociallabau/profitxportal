import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

/**
 * Who can open Dan AI. Admins always can. Members can once the
 * "dan_ai_members_live" admin setting is on (read through the dan_ai_live()
 * RPC): the route, the sidebar and every "Help me do this" button follow it.
 */
export function useDanAiLive(): boolean {
  const { data } = useQuery({
    queryKey: ['dan-ai-live'],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => (await supabase.rpc('dan_ai_live')).data === true,
  });
  return data === true;
}

export function useCanUseDanAi(isAdmin: boolean | null | undefined): boolean {
  return useDanAiLive() || Boolean(isAdmin);
}

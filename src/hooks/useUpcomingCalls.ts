import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { ALL_CALLS, thumbnailFor, type Call } from '@/data/calls';

/**
 * Upcoming calls, read live from the ProfitX Google Calendar.
 *
 * Adding a call in Google is all it takes — nothing needs re-syncing here.
 * If the feed cannot be reached, the hand-listed calls are used instead, so
 * the page never comes up empty.
 */
export function useUpcomingCalls() {
  const { data, isLoading } = useQuery({
    queryKey: ['calendar-feed'],
    staleTime: 15 * 60 * 1000,
    queryFn: async (): Promise<Call[] | null> => {
      const { data, error } = await supabase.functions.invoke('calendar-feed', { body: {} });
      if (error || data?.error || !Array.isArray(data?.calls)) return null;

      return (data.calls as {
        title: string;
        category: string;
        start: string;
        durationMins: number;
        meetUrl: string;
        description: string;
      }[]).map(call => ({
        title: call.title,
        category: (call.category as Call['category']) ?? 'Coaching',
        // The feed is UTC; the rest of the app works in Brisbane local time.
        start: new Date(new Date(call.start).getTime() + 10 * 3600000)
          .toISOString()
          .slice(0, 19),
        durationMins: call.durationMins,
        meetUrl: call.meetUrl,
        description: call.description || undefined,
        thumbnail: thumbnailFor(call.title),
      }));
    },
  });

  const today = new Date().toISOString().slice(0, 10);
  const fallback = [...ALL_CALLS]
    .filter(c => c.start.slice(0, 10) >= today)
    .sort((a, b) => a.start.localeCompare(b.start));

  return {
    calls: data ?? fallback,
    isLive: Boolean(data),
    isLoading,
  };
}

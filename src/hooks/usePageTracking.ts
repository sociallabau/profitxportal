import { useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';

export function usePageTracking(page: string) {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;
    supabase.from('page_views').insert({ user_id: user.id, page }).then(() => {}).catch(() => {});
  }, [user, page]);
}

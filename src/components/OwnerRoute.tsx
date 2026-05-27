import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Loader2 } from 'lucide-react';
import { OWNER_USER_ID } from '@/lib/owner';

export default function OwnerRoute({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<'loading' | 'ok' | 'blocked' | 'unauth'>('loading');

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return setStatus('unauth');
      setStatus(user.id === OWNER_USER_ID ? 'ok' : 'blocked');
    })();
  }, []);

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }
  if (status === 'unauth') return <Navigate to="/auth" replace />;
  if (status === 'blocked') return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

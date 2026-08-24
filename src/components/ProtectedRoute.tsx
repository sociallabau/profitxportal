import { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Loader2 } from 'lucide-react';

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const [status, setStatus] = useState<'loading' | 'unauthenticated' | 'needs-onboarding' | 'revoked' | 'ready'>('loading');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (cancelled) return;
      if (!session) { setStatus('unauthenticated'); return; }

      const { data: profile } = await supabase
        .from('profiles')
        .select('onboarded, is_admin, access_revoked')
        .eq('id', session.user.id)
        .maybeSingle();

      if (cancelled) return;
      // Admins skip onboarding gate
      if (profile?.is_admin) { setStatus('ready'); return; }
      if ((profile as any)?.access_revoked) { setStatus('revoked'); return; }
      setStatus(profile?.onboarded ? 'ready' : 'needs-onboarding');
    })();
    return () => { cancelled = true; };
  }, [location.pathname]);

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (status === 'unauthenticated') {
    return <Navigate to="/auth" replace />;
  }

  if (status === 'needs-onboarding' && location.pathname !== '/onboarding') {
    return <Navigate to="/onboarding" replace />;
  }

  return <>{children}</>;
}

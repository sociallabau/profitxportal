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

  if (status === 'revoked') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="max-w-md w-full bg-card border border-border rounded-xl p-6 text-center">
          <h1 className="text-lg font-semibold text-foreground mb-2">Access paused</h1>
          <p className="text-sm text-muted-foreground mb-5">
            Your ProfitX portal access is currently inactive. Your data is safe and will be here if you rejoin —
            reach out to Dan if you think this is a mistake.
          </p>
          <button
            onClick={() => supabase.auth.signOut()}
            className="h-10 px-5 bg-primary text-primary-foreground font-semibold rounded-lg text-sm hover:bg-primary/90 transition-colors"
          >
            Sign out
          </button>
        </div>
      </div>
    );
  }

  if (status === 'needs-onboarding' && location.pathname !== '/onboarding') {
    return <Navigate to="/onboarding" replace />;
  }

  return <>{children}</>;
}

import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function AdminRoute({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<'loading' | 'admin' | 'not-admin' | 'unauthenticated'>('loading');

  useEffect(() => {
    const check = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setStatus('unauthenticated');
        return;
      }
      const { data } = await supabase
        .from('profiles')
        .select('is_admin')
        .eq('id', session.user.id)
        .single();

      if (data?.is_admin) {
        setStatus('admin');
      } else {
        toast.error("You don't have permission to access this page.");
        setStatus('not-admin');
      }
    };
    check();
  }, []);

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (status === 'unauthenticated') return <Navigate to="/auth" replace />;
  if (status === 'not-admin') return <Navigate to="/dashboard" replace />;

  return <>{children}</>;
}

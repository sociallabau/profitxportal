import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { Info, X } from 'lucide-react';

interface Props {
  onDismiss: () => void;
}

export default function OnboardingNoticeModal({ onDismiss }: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();

  const dismiss = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('profiles')
        .update({ onboarding_notice_seen: true })
        .eq('id', user!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['profile'] });
      qc.invalidateQueries({ queryKey: ['profile-tier'] });
      onDismiss();
    },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm px-4">
      <div className="w-full max-w-lg bg-card border border-border rounded-2xl p-7 shadow-2xl relative"
        style={{ boxShadow: '0 0 60px rgba(170,68,255,0.15)' }}>
        <button
          onClick={() => dismiss.mutate()}
          className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-lg bg-primary/10">
            <Info className="w-5 h-5 text-primary" />
          </div>
          <h2 className="text-xl font-bold italic text-foreground">Welcome to ProfitX</h2>
        </div>

        <div className="space-y-4 text-sm text-foreground leading-relaxed">
          <p>
            During your onboarding you only have access to the <strong>On-Ramp legacy modules</strong> to prevent overwhelm and keep you focused on the right things.
          </p>
          <p>
            Dan will give you a game plan on the kickoff call as well as the follow-up velocity calls during the first <strong>4–6 weeks</strong> — to make sure you have a solid base set before joining the rest of the crew in the monthly flow.
          </p>
          <p>
            You still have access to all the weekly calls, workshops, Q&amp;A&apos;s etc. (in the <strong>Upcoming Calls</strong> tab) but please make sure you only focus on the tasks Dan has set during the initial onboarding phase.
          </p>
        </div>

        <div className="mt-6 flex justify-end">
          <button
            onClick={() => dismiss.mutate()}
            disabled={dismiss.isPending}
            className="px-6 py-2 bg-primary text-primary-foreground font-semibold rounded-lg text-sm hover:bg-primary/90 transition-all disabled:opacity-50"
          >
            {dismiss.isPending ? 'Saving...' : 'Got it'}
          </button>
        </div>
      </div>
    </div>
  );
}

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { useGoal } from '@/hooks/useGoal';

interface Props { onComplete: () => void; }

export default function OnboardingModal({ onComplete }: Props) {
  const { user } = useAuth();
  const { setGoal } = useGoal();
  const qc = useQueryClient();
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [targetMrr, setTargetMrr] = useState('');

  const finish = useMutation({
    mutationFn: async () => {
      await supabase.from('profiles').update({
        full_name: name,
        onboarded: true,
      }).eq('id', user!.id);
      if (targetMrr) {
        await setGoal.mutateAsync({
          target_mrr: parseFloat(targetMrr),
          starting_mrr: 0,
          target_date: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['profile'] });
      onComplete();
    },
  });

  const steps = [
    {
      title: 'Welcome to ProfitX 👋',
      subtitle: 'Your coaching hub. Let\'s get you set up in 2 steps.',
      content: (
        <div>
          <label className="block text-sm font-semibold text-foreground mb-1.5">What's your name?</label>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Your first name"
            autoFocus
            className="w-full px-4 py-2.5 bg-input border border-border rounded-lg text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/40" />
        </div>
      ),
      canNext: name.trim().length > 0,
    },
    {
      title: `Let's set your goal, ${name} 🎯`,
      subtitle: 'What MRR do you want to hit in the next 90 days?',
      content: (
        <div>
          <label className="block text-sm font-semibold text-foreground mb-1.5">Target MRR ($)</label>
          <input type="number" value={targetMrr} onChange={e => setTargetMrr(e.target.value)}
            placeholder="e.g. 15000"
            autoFocus
            className="w-full px-4 py-2.5 bg-input border border-border rounded-lg text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/40" />
          <p className="text-xs text-muted-foreground mt-2">You can update this anytime in Settings.</p>
        </div>
      ),
      canNext: true,
    },
  ];

  const current = steps[step];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm px-4">
      <div className="w-full max-w-sm bg-card border border-border rounded-2xl p-7 shadow-2xl"
        style={{ boxShadow: '0 0 60px rgba(170,68,255,0.15)' }}>
        <div className="flex gap-1.5 mb-6">
          {steps.map((_, i) => (
            <div key={i} className={`h-1 flex-1 rounded-full transition-all ${i <= step ? 'bg-primary' : 'bg-border'}`} />
          ))}
        </div>
        <h2 className="text-xl font-bold italic text-foreground mb-1">{current.title}</h2>
        <p className="text-sm text-muted-foreground mb-5">{current.subtitle}</p>
        {current.content}
        <div className="flex items-center justify-between mt-6">
          {step > 0
            ? <button onClick={() => setStep(s => s - 1)} className="text-sm text-muted-foreground hover:text-foreground">← Back</button>
            : <span />}
          {step < steps.length - 1 ? (
            <button onClick={() => setStep(s => s + 1)} disabled={!current.canNext}
              className="px-6 py-2 bg-primary text-primary-foreground font-semibold rounded-lg text-sm hover:bg-primary/90 transition-all disabled:opacity-50">
              Next →
            </button>
          ) : (
            <button onClick={() => finish.mutate()} disabled={finish.isPending}
              className="px-6 py-2 bg-primary text-primary-foreground font-semibold rounded-lg text-sm hover:bg-primary/90 transition-all disabled:opacity-50">
              {finish.isPending ? 'Setting up...' : 'Enter ProfitX →'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

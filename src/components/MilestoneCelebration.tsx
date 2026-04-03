import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';

const MILESTONES = [
  { value: 5000,  label: '$5k MRR',  emoji: '🚀', message: 'First $5k! The retainer machine is starting.' },
  { value: 10000, label: '$10k MRR', emoji: '🔥', message: 'Five figures! You\'re running a real business.' },
  { value: 15000, label: '$15k MRR', emoji: '💜', message: '$15k MRR. Growth tier unlocked — keep pushing.' },
  { value: 20000, label: '$20k MRR', emoji: '👑', message: '$20k MRR. Elite level. Scale mode activated.' },
];

interface Props {
  currentMrr: number;
  milestonesHit: number[];
}

export default function MilestoneCelebration({ currentMrr, milestonesHit }: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [active, setActive] = useState<typeof MILESTONES[0] | null>(null);

  const markHit = useMutation({
    mutationFn: async (value: number) => {
      await supabase.from('profiles').update({
        milestones_hit: [...milestonesHit, value]
      }).eq('id', user!.id);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['profile'] }),
  });

  useEffect(() => {
    const newMilestone = MILESTONES.find(
      m => currentMrr >= m.value && !milestonesHit.includes(m.value)
    );
    if (newMilestone) {
      setActive(newMilestone);
      markHit.mutate(newMilestone.value);
    }
  }, [currentMrr]);

  if (!active) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={() => setActive(null)}>
      <div className="text-center px-8 py-12 max-w-sm" onClick={e => e.stopPropagation()}>
        <div className="relative inline-flex items-center justify-center mb-6">
          <div className="absolute w-32 h-32 rounded-full bg-primary/20 animate-ping" />
          <div className="absolute w-24 h-24 rounded-full bg-primary/30 animate-pulse" />
          <span className="relative text-6xl">{active.emoji}</span>
        </div>
        <h1 className="text-4xl font-bold italic text-foreground mb-2">{active.label}</h1>
        <p className="text-muted-foreground mb-8 leading-relaxed">{active.message}</p>
        <button onClick={() => setActive(null)}
          className="px-8 py-3 bg-primary text-primary-foreground font-bold rounded-xl hover:bg-primary/90 transition-all shadow-lg shadow-primary/30">
          Let's Keep Going →
        </button>
        <p className="text-xs text-muted-foreground mt-4">Click anywhere to dismiss</p>
      </div>
    </div>
  );
}

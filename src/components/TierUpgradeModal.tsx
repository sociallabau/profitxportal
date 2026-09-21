import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Sparkles, Check } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';

type Tier = 'onramp' | 'growth' | 'scale' | string;

const TIER_LABELS: Record<string, string> = {
  onramp: 'On-Ramp',
  growth: 'Growth',
  scale: 'Scale',
};

// Features unlocked at each tier (cumulative — what's NEW vs the prior tier)
const TIER_FEATURES: Record<string, { headline: string; features: string[] }> = {
  onramp: {
    headline: "Welcome to On-Ramp — let's lay the foundations.",
    features: [
      'Roadmap with foundational modules',
      'Cash Menu — quick moves to generate revenue',
      'Weekly wins tracking',
      'Monthly submissions & financials',
    ],
  },
  growth: {
    headline: "You've unlocked Growth — time to scale your offer.",
    features: [
      'Full Content Studio with Instagram research',
      'Hot List CRM for tracking leads',
      'Advanced roadmap modules (Traffic & Conversion pillars)',
      'Launch HQ for ad campaigns',
    ],
  },
  scale: {
    headline: "Welcome to Scale — the top tier. Let's build a machine.",
    features: [
      'All Vault resources & templates',
      'Priority access to upcoming live calls',
      'Advanced Launch HQ features',
      'Full roadmap unlocked across every pillar',
    ],
  },
};

interface Props {
  userId: string;
  newTier: string;
  onClose: () => void;
}

export default function TierUpgradeModal({ userId, newTier, onClose }: Props) {
  const qc = useQueryClient();
  const [saving, setSaving] = useState(false);
  const config = TIER_FEATURES[newTier] ?? TIER_FEATURES.onramp;
  const tierLabel = TIER_LABELS[newTier] ?? newTier;

  const handleClose = async () => {
    setSaving(true);
    await supabase.from('profiles').update({ tier_seen: newTier }).eq('id', userId);
    qc.invalidateQueries({ queryKey: ['profile', userId] });
    setSaving(false);
    onClose();
  };

  return (
    <Dialog open={true} onOpenChange={(open) => { if (!open) handleClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center">
              <Sparkles className="w-8 h-8 text-primary" />
            </div>
          </div>
          <DialogTitle className="text-center text-2xl">
            You've been upgraded to {tierLabel}!
          </DialogTitle>
        </DialogHeader>

        <p className="text-center text-muted-foreground">{config.headline}</p>

        <div className="bg-card/50 border border-border rounded-lg p-4 space-y-3">
          <p className="text-sm font-semibold text-foreground">Newly unlocked features:</p>
          <ul className="space-y-2">
            {config.features.map((feature) => (
              <li key={feature} className="flex items-start gap-2 text-sm">
                <Check className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                <span>{feature}</span>
              </li>
            ))}
          </ul>
        </div>

        <DialogFooter>
          <Button onClick={handleClose} disabled={saving} className="w-full">
            {saving ? 'Saving…' : "Let's go"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

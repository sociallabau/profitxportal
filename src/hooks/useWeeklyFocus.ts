import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from './useAuth';
import { useProfile } from './useProfile';

const TIER_ORDER = ['onramp', 'growth', 'scale'];

const ALL_MODULES = [
  { pillar: 'build', pillarLabel: 'Retainer Offer', n: 1, tier: 'onramp', title: 'Build Your Offer' },
  { pillar: 'build', pillarLabel: 'Retainer Offer', n: 2, tier: 'onramp', title: 'Get Client Results' },
  { pillar: 'build', pillarLabel: 'Retainer Offer', n: 3, tier: 'growth', title: 'Offer Optimisation' },
  { pillar: 'build', pillarLabel: 'Retainer Offer', n: 4, tier: 'growth', title: 'Case Study System' },
  { pillar: 'build', pillarLabel: 'Retainer Offer', n: 5, tier: 'scale', title: 'Premium Positioning' },
  { pillar: 'build', pillarLabel: 'Retainer Offer', n: 6, tier: 'scale', title: 'Offer to Agency' },
  { pillar: 'traffic', pillarLabel: 'Growth Engine', n: 1, tier: 'onramp', title: 'Content Foundation' },
  { pillar: 'traffic', pillarLabel: 'Growth Engine', n: 2, tier: 'onramp', title: 'First 1k Followers' },
  { pillar: 'traffic', pillarLabel: 'Growth Engine', n: 3, tier: 'growth', title: 'Ads Foundations' },
  { pillar: 'traffic', pillarLabel: 'Growth Engine', n: 4, tier: 'growth', title: 'Paid Traffic System' },
  { pillar: 'traffic', pillarLabel: 'Growth Engine', n: 5, tier: 'scale', title: 'Content → Leads Machine' },
  { pillar: 'traffic', pillarLabel: 'Growth Engine', n: 6, tier: 'scale', title: 'Full Funnel' },
  { pillar: 'sales', pillarLabel: 'Sales System', n: 1, tier: 'onramp', title: 'Discovery Call Framework' },
  { pillar: 'sales', pillarLabel: 'Sales System', n: 2, tier: 'onramp', title: 'Objection Handling' },
  { pillar: 'sales', pillarLabel: 'Sales System', n: 3, tier: 'growth', title: 'Close Rate Optimisation' },
  { pillar: 'sales', pillarLabel: 'Sales System', n: 4, tier: 'growth', title: 'Sales CRM Setup' },
  { pillar: 'sales', pillarLabel: 'Sales System', n: 5, tier: 'scale', title: 'Sales Script Mastery' },
  { pillar: 'sales', pillarLabel: 'Sales System', n: 6, tier: 'scale', title: 'Hire a Setter' },
  { pillar: 'scale', pillarLabel: 'Scale System', n: 1, tier: 'onramp', title: 'Remove Yourself from Delivery' },
  { pillar: 'scale', pillarLabel: 'Scale System', n: 2, tier: 'onramp', title: 'SOP Library' },
  { pillar: 'scale', pillarLabel: 'Scale System', n: 3, tier: 'growth', title: 'First Hire' },
  { pillar: 'scale', pillarLabel: 'Scale System', n: 4, tier: 'growth', title: 'Team Systems' },
  { pillar: 'scale', pillarLabel: 'Scale System', n: 5, tier: 'scale', title: 'Agency Model' },
  { pillar: 'scale', pillarLabel: 'Scale System', n: 6, tier: 'scale', title: 'Operator Handoff' },
];

export function useWeeklyFocus() {
  const { user } = useAuth();
  const { data: profile } = useProfile();

  return useQuery({
    queryKey: ['weekly-focus', user?.id, profile?.tier],
    enabled: !!user && !!profile,
    queryFn: async () => {
      const { data: scores } = await supabase
        .from('roadmap_scores')
        .select('pillar, module_number, score')
        .eq('user_id', user!.id);

      const scoreMap: Record<string, string> = {};
      scores?.forEach(s => { scoreMap[`${s.pillar}-${s.module_number}`] = s.score ?? 'red'; });

      const tierIdx = TIER_ORDER.indexOf(profile!.tier ?? 'onramp');
      const unlocked = ALL_MODULES.filter(m => TIER_ORDER.indexOf(m.tier) <= tierIdx);

      const red = unlocked.filter(m => scoreMap[`${m.pillar}-${m.n}`] === 'red');
      const unscored = unlocked.filter(m => !scoreMap[`${m.pillar}-${m.n}`]);
      const amber = unlocked.filter(m => scoreMap[`${m.pillar}-${m.n}`] === 'amber');

      const prioritised = [...red, ...unscored, ...amber].slice(0, 3);

      return prioritised.map(m => ({
        ...m,
        status: scoreMap[`${m.pillar}-${m.n}`] ?? 'unscored',
      }));
    },
  });
}

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from './useAuth';
import { useProfile } from './useProfile';

const TIER_ORDER = ['onramp', 'growth', 'scale'];

const ALL_MODULES = [
  // Build (6)
  { pillar: 'build', pillarLabel: 'Build', n: 1, tier: 'onramp', title: 'Design Your Retainer Offer + Delivery Roadmap' },
  { pillar: 'build', pillarLabel: 'Build', n: 2, tier: 'onramp', title: 'Client Onboarding & Strategy Sessions' },
  { pillar: 'build', pillarLabel: 'Build', n: 3, tier: 'growth', title: 'P&L and Margins' },
  { pillar: 'build', pillarLabel: 'Build', n: 4, tier: 'growth', title: 'Upsell Architecture' },
  { pillar: 'build', pillarLabel: 'Build', n: 5, tier: 'scale', title: 'SOP Library' },
  { pillar: 'build', pillarLabel: 'Build', n: 6, tier: 'scale', title: 'Full Funnel Paid Ads' },
  // Traffic (6)
  { pillar: 'traffic', pillarLabel: 'Traffic', n: 1, tier: 'onramp', title: 'Optimise Your Profile' },
  { pillar: 'traffic', pillarLabel: 'Traffic', n: 2, tier: 'onramp', title: 'The Stupidly Simple Ad' },
  { pillar: 'traffic', pillarLabel: 'Traffic', n: 3, tier: 'onramp', title: 'Warm Outreach' },
  { pillar: 'traffic', pillarLabel: 'Traffic', n: 4, tier: 'growth', title: 'The 5 Ps Content Framework' },
  { pillar: 'traffic', pillarLabel: 'Traffic', n: 5, tier: 'growth', title: 'Story Sequences + Content Repurposing' },
  { pillar: 'traffic', pillarLabel: 'Traffic', n: 6, tier: 'scale', title: 'Full Content Rhythm' },
  // Sales (4)
  { pillar: 'sales', pillarLabel: 'Sales', n: 1, tier: 'onramp', title: 'Proposal Doc + Meeting Flow' },
  { pillar: 'sales', pillarLabel: 'Sales', n: 2, tier: 'onramp', title: 'DM Scripts' },
  { pillar: 'sales', pillarLabel: 'Sales', n: 3, tier: 'growth', title: 'Lead Tracking + CRM' },
  { pillar: 'sales', pillarLabel: 'Sales', n: 4, tier: 'growth', title: 'Case Studies & Results' },
  // Scale (4)
  { pillar: 'scale', pillarLabel: 'Scale', n: 1, tier: 'scale', title: 'First Hire + Delegation Mindset' },
  { pillar: 'scale', pillarLabel: 'Scale', n: 2, tier: 'scale', title: 'Watching the P&L' },
  { pillar: 'scale', pillarLabel: 'Scale', n: 3, tier: 'scale', title: 'Training Rhythm' },
  { pillar: 'scale', pillarLabel: 'Scale', n: 4, tier: 'scale', title: 'Premium Client Experience' },
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

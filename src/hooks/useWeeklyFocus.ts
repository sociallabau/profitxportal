import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from './useAuth';
import { useProfile } from './useProfile';

const TIER_ORDER = ['onramp', 'growth', 'scale'];

const ALL_MODULES = [
  // Build (11)
  { pillar: 'build', pillarLabel: 'Build', n: 1, tier: 'onramp', title: 'Design Your Retainer Offer' },
  { pillar: 'build', pillarLabel: 'Build', n: 2, tier: 'onramp', title: 'Build Your Delivery Roadmap' },
  { pillar: 'build', pillarLabel: 'Build', n: 3, tier: 'onramp', title: 'Price It Right' },
  { pillar: 'build', pillarLabel: 'Build', n: 4, tier: 'onramp', title: 'Client Onboarding Process' },
  { pillar: 'build', pillarLabel: 'Build', n: 5, tier: 'growth', title: 'Build Your P&L Sheet' },
  { pillar: 'build', pillarLabel: 'Build', n: 6, tier: 'growth', title: 'Know Your Margins' },
  { pillar: 'build', pillarLabel: 'Build', n: 7, tier: 'growth', title: 'Upsell Architecture' },
  { pillar: 'build', pillarLabel: 'Build', n: 8, tier: 'growth', title: 'When & How to Raise Your Rates' },
  { pillar: 'build', pillarLabel: 'Build', n: 9, tier: 'scale', title: 'SOP Library' },
  { pillar: 'build', pillarLabel: 'Build', n: 10, tier: 'scale', title: 'Full Funnel Paid Ads' },
  { pillar: 'build', pillarLabel: 'Build', n: 11, tier: 'scale', title: 'Business Structure & Profit Targets' },
  // Traffic (11)
  { pillar: 'traffic', pillarLabel: 'Traffic', n: 1, tier: 'onramp', title: 'Optimise Your Profile First' },
  { pillar: 'traffic', pillarLabel: 'Traffic', n: 2, tier: 'onramp', title: 'Simple Content: The 3 Starting Posts' },
  { pillar: 'traffic', pillarLabel: 'Traffic', n: 3, tier: 'onramp', title: 'Warm Outreach' },
  { pillar: 'traffic', pillarLabel: 'Traffic', n: 4, tier: 'onramp', title: 'The Stupidly Simple Ad' },
  { pillar: 'traffic', pillarLabel: 'Traffic', n: 5, tier: 'growth', title: 'The 5 Ps Content Framework' },
  { pillar: 'traffic', pillarLabel: 'Traffic', n: 6, tier: 'growth', title: 'Story Sequences' },
  { pillar: 'traffic', pillarLabel: 'Traffic', n: 7, tier: 'growth', title: 'Content Repurposing' },
  { pillar: 'traffic', pillarLabel: 'Traffic', n: 8, tier: 'growth', title: 'Scale Your Simple Ads' },
  { pillar: 'traffic', pillarLabel: 'Traffic', n: 9, tier: 'scale', title: 'The Full Content Rhythm' },
  { pillar: 'traffic', pillarLabel: 'Traffic', n: 10, tier: 'scale', title: 'Platform Expansion' },
  { pillar: 'traffic', pillarLabel: 'Traffic', n: 11, tier: 'scale', title: 'Referral Systems & Strategic Partnerships' },
  // Sales (10)
  { pillar: 'sales', pillarLabel: 'Sales', n: 1, tier: 'onramp', title: 'Build Your Proposal Doc' },
  { pillar: 'sales', pillarLabel: 'Sales', n: 2, tier: 'onramp', title: 'Discovery Call Framework' },
  { pillar: 'sales', pillarLabel: 'Sales', n: 3, tier: 'onramp', title: 'Lead Tracking Sheet' },
  { pillar: 'sales', pillarLabel: 'Sales', n: 4, tier: 'growth', title: 'Set Up Your Sales CRM' },
  { pillar: 'sales', pillarLabel: 'Sales', n: 5, tier: 'growth', title: 'DM Setting Scripts' },
  { pillar: 'sales', pillarLabel: 'Sales', n: 6, tier: 'growth', title: 'Case Study Creation' },
  { pillar: 'sales', pillarLabel: 'Sales', n: 7, tier: 'growth', title: 'Objection Handling' },
  { pillar: 'sales', pillarLabel: 'Sales', n: 8, tier: 'scale', title: 'Automate Your Follow-Up' },
  { pillar: 'sales', pillarLabel: 'Sales', n: 9, tier: 'scale', title: 'Cross-Sell to Existing Clients' },
  { pillar: 'sales', pillarLabel: 'Sales', n: 10, tier: 'scale', title: 'Train a Setter' },
  // Scale (10)
  { pillar: 'scale', pillarLabel: 'Scale', n: 1, tier: 'onramp', title: 'Your First Hire' },
  { pillar: 'scale', pillarLabel: 'Scale', n: 2, tier: 'onramp', title: 'Delegation Framework' },
  { pillar: 'scale', pillarLabel: 'Scale', n: 3, tier: 'onramp', title: 'Onboarding Your First Team Member' },
  { pillar: 'scale', pillarLabel: 'Scale', n: 4, tier: 'growth', title: 'Training Rhythm' },
  { pillar: 'scale', pillarLabel: 'Scale', n: 5, tier: 'growth', title: 'Quality Control System' },
  { pillar: 'scale', pillarLabel: 'Scale', n: 6, tier: 'growth', title: 'KPI Dashboard' },
  { pillar: 'scale', pillarLabel: 'Scale', n: 7, tier: 'scale', title: 'The Agency Model' },
  { pillar: 'scale', pillarLabel: 'Scale', n: 8, tier: 'scale', title: 'Incentive Structures' },
  { pillar: 'scale', pillarLabel: 'Scale', n: 9, tier: 'scale', title: 'The Premium Client Experience' },
  { pillar: 'scale', pillarLabel: 'Scale', n: 10, tier: 'scale', title: 'Referral Partner Network' },
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

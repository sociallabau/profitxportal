import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ExternalLink } from 'lucide-react';
import PageLayout from '@/components/PageLayout';
import { supabase } from '@/lib/supabase';
import { useRequireAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { cn } from '@/lib/utils';

const CIRCLE_PILLAR_URLS: Record<string, string> = {
  build:   'https://app.circle.so/c/YOUR-BUILD-SPACE',
  traffic: 'https://app.circle.so/c/YOUR-TRAFFIC-SPACE',
  sales:   'https://app.circle.so/c/YOUR-SALES-SPACE',
  scale:   'https://app.circle.so/c/YOUR-SCALE-SPACE',
};

const PILLARS = [
  {
    key: 'build',
    label: 'Build',
    subtitle: 'Retainer Offer',
    color: 'text-purple-400',
    bgColor: 'bg-purple-400/10',
    borderColor: 'border-purple-400/30',
    modules: [
      { n: 1, tier: 'onramp', title: 'Build Your Offer', desc: 'Define your retainer package and pricing' },
      { n: 2, tier: 'onramp', title: 'Get Client Results', desc: 'Deliver results that keep clients paying monthly' },
      { n: 3, tier: 'growth', title: 'Offer Optimisation', desc: 'Refine your offer based on client feedback and data' },
      { n: 4, tier: 'growth', title: 'Case Study System', desc: 'Turn client wins into a repeatable sales asset' },
      { n: 5, tier: 'scale', title: 'Premium Positioning', desc: 'Position yourself as the go-to expert in your niche' },
      { n: 6, tier: 'scale', title: 'Offer to Agency', desc: 'Transition from freelancer to agency owner' },
    ],
  },
  {
    key: 'traffic',
    label: 'Traffic',
    subtitle: 'Growth Engine',
    color: 'text-violet-400',
    bgColor: 'bg-violet-400/10',
    borderColor: 'border-violet-400/30',
    modules: [
      { n: 1, tier: 'onramp', title: 'Content Foundation', desc: 'Build your content strategy and posting system' },
      { n: 2, tier: 'onramp', title: 'First 1k Followers', desc: 'Grow your audience from scratch organically' },
      { n: 3, tier: 'growth', title: 'Ads Foundations', desc: 'Set up your first paid traffic campaigns' },
      { n: 4, tier: 'growth', title: 'Paid Traffic System', desc: 'Scale what works with a consistent ad spend' },
      { n: 5, tier: 'scale', title: 'Content → Leads Machine', desc: 'Build an automated organic funnel' },
      { n: 6, tier: 'scale', title: 'Full Funnel', desc: 'Combine organic + paid into a full growth engine' },
    ],
  },
  {
    key: 'sales',
    label: 'Sales',
    subtitle: 'Sales System',
    color: 'text-fuchsia-400',
    bgColor: 'bg-fuchsia-400/10',
    borderColor: 'border-fuchsia-400/30',
    modules: [
      { n: 1, tier: 'onramp', title: 'Discovery Call Framework', desc: 'Run a discovery call that qualifies and converts' },
      { n: 2, tier: 'onramp', title: 'Objection Handling', desc: 'Know exactly how to handle every objection' },
      { n: 3, tier: 'growth', title: 'Close Rate Optimisation', desc: 'Track and improve your sales conversion rate' },
      { n: 4, tier: 'growth', title: 'Sales CRM Setup', desc: 'Build a simple pipeline to never lose a lead' },
      { n: 5, tier: 'scale', title: 'Sales Script Mastery', desc: 'A repeatable script you can hand to a setter' },
      { n: 6, tier: 'scale', title: 'Hire a Setter', desc: 'Bring on a sales rep to remove yourself from sales' },
    ],
  },
  {
    key: 'scale',
    label: 'Scale',
    subtitle: 'Scale System',
    color: 'text-indigo-400',
    bgColor: 'bg-indigo-400/10',
    borderColor: 'border-indigo-400/30',
    modules: [
      { n: 1, tier: 'onramp', title: 'Remove Yourself from Delivery', desc: 'Document your process so others can do it' },
      { n: 2, tier: 'onramp', title: 'SOP Library', desc: 'Build a full library of SOPs for every task' },
      { n: 3, tier: 'growth', title: 'First Hire', desc: 'Hire and onboard your first video editor' },
      { n: 4, tier: 'growth', title: 'Team Systems', desc: 'Build management systems for a small team' },
      { n: 5, tier: 'scale', title: 'Agency Model', desc: 'Structure the business as a scalable agency' },
      { n: 6, tier: 'scale', title: 'Operator Handoff', desc: 'Hand operations to a COO/operator' },
    ],
  },
];

const TIER_ORDER = ['onramp', 'growth', 'scale'];

export default function Roadmap() {
  const { user } = useRequireAuth();
  const { data: profile } = useProfile();
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState('build');

  const clientTier = profile?.tier ?? 'onramp';
  const tierIndex = TIER_ORDER.indexOf(clientTier);
  const isUnlocked = (moduleTier: string) => TIER_ORDER.indexOf(moduleTier) <= tierIndex;

  const { data: scores } = useQuery({
    queryKey: ['roadmap-scores', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from('roadmap_scores')
        .select('*')
        .eq('user_id', user!.id);
      const map: Record<string, string> = {};
      data?.forEach((row: any) => { map[`${row.pillar}-${row.module_number}`] = row.score; });
      return map;
    },
  });

  const updateScore = useMutation({
    mutationFn: async ({ pillar, module_number, score }: { pillar: string; module_number: number; score: string }) => {
      const { error } = await supabase.from('roadmap_scores').upsert(
        { user_id: user!.id, pillar, module_number, score },
        { onConflict: 'user_id,pillar,module_number' }
      );
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['roadmap-scores'] }),
  });

  const pillar = PILLARS.find((p) => p.key === activeTab)!;

  return (
    <PageLayout>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl">Roadmap</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Your tier: <span className="text-primary font-semibold capitalize">{clientTier}</span>
          </p>
        </div>
        <a
          href={CIRCLE_PILLAR_URLS[activeTab]}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground font-semibold rounded-lg text-sm hover:bg-primary/90 transition-all shadow-md shadow-primary/20"
        >
          Open {pillar.label} in Circle <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>

      <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
        {PILLARS.map((p) => (
          <button
            key={p.key}
            onClick={() => setActiveTab(p.key)}
            className={cn(
              'flex flex-col items-start px-4 py-3 rounded-xl border text-left shrink-0 transition-all',
              activeTab === p.key
                ? `${p.bgColor} ${p.borderColor} ${p.color}`
                : 'bg-card border-border text-muted-foreground hover:text-foreground hover:bg-muted/50'
            )}
          >
            <span className="text-sm font-bold">{p.label}</span>
            <span className="text-xs opacity-70 mt-0.5">{p.subtitle}</span>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {pillar.modules.map((mod) => {
          const unlocked = isUnlocked(mod.tier);
          const score = scores?.[`${pillar.key}-${mod.n}`] ?? 'red';
          return (
            <div
              key={mod.n}
              className={cn(
                'bg-card border rounded-xl p-4 transition-all',
                unlocked ? 'border-border hover:border-primary/30' : 'border-border opacity-50'
              )}
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className={cn('text-xs font-bold px-2 py-0.5 rounded-full uppercase tracking-wider', pillar.bgColor, pillar.color)}>
                    {mod.tier}
                  </span>
                  <span className="text-xs text-muted-foreground">M{mod.n}</span>
                </div>
                {unlocked && (
                  <div className="flex gap-1">
                    {['red', 'amber', 'green'].map((s) => (
                      <button
                        key={s}
                        onClick={() => updateScore.mutate({ pillar: pillar.key, module_number: mod.n, score: s })}
                        className={cn(
                          'w-5 h-5 rounded-full border-2 transition-all',
                          score === s
                            ? s === 'red' ? 'bg-destructive border-destructive' : s === 'amber' ? 'bg-warning border-warning' : 'bg-success border-success'
                            : 'bg-transparent border-border hover:border-primary/40'
                        )}
                        title={s.charAt(0).toUpperCase() + s.slice(1)}
                      />
                    ))}
                  </div>
                )}
              </div>
              <h3 className={cn('text-sm font-bold mb-1', unlocked ? 'text-foreground' : 'text-muted-foreground')}>
                {mod.title}
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed mb-3">{mod.desc}</p>
              {unlocked ? (
                <a
                  href={CIRCLE_PILLAR_URLS[pillar.key]}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn('flex items-center gap-1.5 text-xs font-semibold transition-colors', pillar.color, 'hover:opacity-80')}
                >
                  Open module <ExternalLink className="w-3 h-3" />
                </a>
              ) : (
                <p className="text-xs text-muted-foreground italic">🔒 Unlocks at {mod.tier} tier</p>
              )}
            </div>
          );
        })}
      </div>
    </PageLayout>
  );
}

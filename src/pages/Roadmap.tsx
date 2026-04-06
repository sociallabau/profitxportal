import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Circle, Lock, ExternalLink } from 'lucide-react';
import PageLayout from '@/components/PageLayout';
import { supabase } from '@/lib/supabase';
import { useRequireAuth } from '@/hooks/useAuth';
import { usePageTracking } from '@/hooks/usePageTracking';

const PILLARS = [
  {
    id: 'build', name: 'BUILD', color: 'text-blue-400', borderColor: 'border-blue-400/20',
    modules: [
      { id: 'design-retainer-offer', name: 'Design Retainer Offer + Delivery Roadmap', desc: 'Package your offer, set pricing, and map out exactly what clients get.', tier: 'on-ramp', circleUrl: '' },
      { id: 'client-onboarding', name: 'Client Onboarding & Strategy Sessions', desc: 'Build a repeatable onboarding flow that sets expectations from day one.', tier: 'on-ramp', circleUrl: '' },
      { id: 'pl-margins', name: 'P&L and Margins', desc: 'Understand your numbers — what you keep after costs.', tier: 'growth', circleUrl: '' },
      { id: 'upsell-architecture', name: 'Upsell Architecture', desc: 'Create logical next steps so clients naturally spend more.', tier: 'growth', circleUrl: '' },
      { id: 'sop-library', name: 'SOP Library', desc: 'Document every process so your business runs without you.', tier: 'scale', circleUrl: '' },
    ],
  },
  {
    id: 'traffic', name: 'TRAFFIC', color: 'text-purple-400', borderColor: 'border-purple-400/20',
    modules: [
      { id: 'optimise-profile', name: 'Optimise Your Profile', desc: 'Turn your IG/LinkedIn into a lead generation machine.', tier: 'on-ramp', circleUrl: '' },
      { id: 'stupidly-simple-ad', name: 'Stupidly Simple Ad', desc: '$20/day for 5 days — the fastest way to get warm leads in.', tier: 'on-ramp', circleUrl: '' },
      { id: 'warm-outreach', name: 'Warm Outreach', desc: 'DM scripts and sequences to reactivate your existing network.', tier: 'on-ramp', circleUrl: '' },
      { id: '5ps-framework', name: '5 Ps Framework', desc: 'A content framework that positions you as the go-to expert.', tier: 'growth', circleUrl: '' },
      { id: 'full-funnel-paid-ads', name: 'Full Funnel Paid Ads', desc: 'Run ads that bring in qualified leads at scale.', tier: 'scale', circleUrl: '' },
    ],
  },
  {
    id: 'sales', name: 'SALES', color: 'text-green-400', borderColor: 'border-green-400/20',
    modules: [
      { id: 'discovery-call', name: 'Discovery Call Framework', desc: 'A repeatable process for turning cold leads into paying clients.', tier: 'on-ramp', circleUrl: '' },
      { id: 'follow-up-system', name: 'Follow-Up System', desc: 'Never lose a warm lead again with a structured follow-up sequence.', tier: 'on-ramp', circleUrl: '' },
      { id: 'proposals-closing', name: 'Proposals & Closing', desc: 'Send proposals that close — structure, pricing, and urgency.', tier: 'growth', circleUrl: '' },
      { id: 'objection-handling', name: 'Objection Handling', desc: 'Turn "I need to think about it" into a signed contract.', tier: 'growth', circleUrl: '' },
    ],
  },
  {
    id: 'scale', name: 'SCALE', color: 'text-orange-400', borderColor: 'border-orange-400/20',
    modules: [
      { id: 'hire-first-editor', name: 'Hire Your First Editor', desc: 'Remove yourself from production without losing quality.', tier: 'scale', circleUrl: '' },
      { id: 'retention-upsell', name: 'Retention & Upsell Framework', desc: 'Keep clients longer and increase their monthly spend.', tier: 'scale', circleUrl: '' },
      { id: 'financial-mastery', name: 'Financial Mastery', desc: 'Build a business that runs on clear financial systems.', tier: 'scale', circleUrl: '' },
    ],
  },
];

const TIER_LABELS = [
  { id: 'on-ramp', label: 'On-Ramp', color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/30', activeBg: 'bg-blue-500/20' },
  { id: 'growth', label: 'Growth', color: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-500/30', activeBg: 'bg-purple-500/20' },
  { id: 'scale', label: 'Scale', color: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/30', activeBg: 'bg-orange-500/20' },
];

function normalizeTier(tier: string): string {
  if (tier === 'on-ramp') return 'onramp';
  return tier;
}

function getTierUnlocked(clientTier: string): string[] {
  const normalized = normalizeTier(clientTier);
  const canonical = ['onramp', 'growth', 'scale'];
  return canonical.slice(0, canonical.indexOf(normalized) + 1);
}

function moduleMatchesTier(moduleTier: string, unlockedTiers: string[]): boolean {
  const normalized = normalizeTier(moduleTier);
  return unlockedTiers.includes(normalized);
}

// Get all on-ramp module IDs
const ON_RAMP_MODULE_IDS = PILLARS.flatMap(p => p.modules.filter(m => m.tier === 'on-ramp').map(m => m.id));

export default function Roadmap() {
  const { user } = useRequireAuth();
  usePageTracking('roadmap');
  const qc = useQueryClient();

  const { data: profile } = useQuery({
    queryKey: ['profile-tier', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('tier').eq('id', user!.id).single();
      return data;
    },
  });

  const clientTier = profile?.tier || 'onramp';
  const unlockedTiers = getTierUnlocked(clientTier);

  const { data: completions = [] } = useQuery({
    queryKey: ['module-completions', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from('checklist_progress').select('task_key, completed').eq('user_id', user!.id);
      return data ?? [];
    },
  });

  const completionMap: Record<string, boolean> = Object.fromEntries(completions.map((c: any) => [c.task_key, c.completed]));

  const toggleModule = useMutation({
    mutationFn: async ({ moduleId, current }: { moduleId: string; current: boolean }) => {
      const { error } = await supabase.from('checklist_progress').upsert(
        { user_id: user!.id, task_key: moduleId, completed: !current, updated_at: new Date().toISOString() },
        { onConflict: 'user_id,task_key' }
      );
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['module-completions'] }),
  });

  const allModules = PILLARS.flatMap(p => p.modules);
  const totalUnlocked = allModules.filter(m => moduleMatchesTier(m.tier, unlockedTiers)).length;
  const completedCount = allModules.filter(m => moduleMatchesTier(m.tier, unlockedTiers) && completionMap[m.id]).length;
  const progressPct = totalUnlocked > 0 ? Math.round((completedCount / totalUnlocked) * 100) : 0;

  // Per-tier progress
  const tierProgress = TIER_LABELS.map(t => {
    const tierModules = allModules.filter(m => normalizeTier(m.tier) === normalizeTier(t.id));
    const completed = tierModules.filter(m => completionMap[m.id]).length;
    const isUnlocked = unlockedTiers.includes(normalizeTier(t.id));
    const isActive = normalizeTier(clientTier) === normalizeTier(t.id);
    return { ...t, total: tierModules.length, completed, isUnlocked, isActive };
  });

  return (
    <PageLayout>
      <div className="mb-5">
        <h1 className="text-2xl font-bold">Roadmap</h1>
        <p className="text-sm text-muted-foreground">Work through each module and tick it off when complete.</p>
      </div>

      {/* Tier indicators */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        {tierProgress.map((t) => (
          <div
            key={t.id}
            className={`rounded-xl border p-3 text-center transition-all ${
              t.isActive
                ? `${t.activeBg} ${t.border} ring-1 ring-offset-1 ring-offset-background`
                : t.isUnlocked
                ? `${t.bg} ${t.border}`
                : 'bg-muted/20 border-border opacity-50'
            }`}
            
          >
            <p className={`text-xs font-bold uppercase tracking-wider ${t.isUnlocked ? t.color : 'text-muted-foreground'}`}>
              {t.label}
            </p>
            {t.isUnlocked ? (
              <p className="text-xs text-muted-foreground mt-1">
                {t.completed}/{t.total} done
              </p>
            ) : (
              <p className="text-xs text-muted-foreground mt-1 flex items-center justify-center gap-1">
                <Lock className="w-3 h-3" /> Locked
              </p>
            )}
            {t.isActive && (
              <span className={`inline-block mt-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold ${t.bg} ${t.color}`}>
                CURRENT
              </span>
            )}
          </div>
        ))}
      </div>

      {/* Overall progress */}
      <div className="bg-card border border-border rounded-xl p-4 mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-semibold text-foreground">Overall Progress</span>
          <span className="text-sm font-bold text-primary">{completedCount}/{totalUnlocked} modules</span>
        </div>
        <div className="w-full bg-muted rounded-full h-2">
          <div className="bg-primary rounded-full h-2 transition-all duration-500" style={{ width: `${progressPct}%` }} />
        </div>
        <p className="text-xs text-muted-foreground mt-1.5">{progressPct}% complete</p>
      </div>

      {/* Pillars */}
      <div className="space-y-8">
        {PILLARS.map((pillar) => (
          <div key={pillar.id}>
            <h2 className={`text-xs font-bold tracking-widest uppercase mb-3 ${pillar.color}`}>{pillar.name}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {pillar.modules.map((module) => {
                const isUnlocked = moduleMatchesTier(module.tier, unlockedTiers);
                const isComplete = !!completionMap[module.id];

                if (!isUnlocked) {
                  return (
                    <div key={module.id} className="flex items-start gap-3 p-4 bg-card border border-border/50 rounded-xl opacity-40">
                      <Lock className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-muted-foreground">{module.name}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{module.desc}</p>
                        <span className="inline-block mt-2 px-2 py-0.5 rounded-full bg-muted/50 text-xs text-muted-foreground capitalize">{module.tier}</span>
                      </div>
                    </div>
                  );
                }

                return (
                  <div
                    key={module.id}
                    className={`flex items-start gap-3 p-4 rounded-xl border text-left transition-all ${
                      isComplete ? 'bg-green-500/5 border-green-500/30' : 'bg-card border-border hover:bg-muted/20'
                    }`}
                  >
                    {/* Clickable checkbox area */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleModule.mutate({ moduleId: module.id, current: isComplete });
                      }}
                      className="shrink-0 mt-0.5 hover:scale-110 transition-transform"
                      aria-label={isComplete ? 'Mark incomplete' : 'Mark complete'}
                    >
                      {isComplete
                        ? <CheckCircle2 className="w-5 h-5 text-green-400" />
                        : <Circle className="w-5 h-5 text-muted-foreground/40 hover:text-primary/60" />
                      }
                    </button>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className={`text-sm font-semibold ${isComplete ? 'text-muted-foreground line-through' : 'text-foreground'}`}>
                          {module.name}
                        </p>
                        {module.circleUrl && (
                          <a
                            href={module.circleUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="shrink-0 p-1 rounded hover:bg-muted/50 transition"
                            title="Watch module video"
                          >
                            <ExternalLink className="w-3.5 h-3.5 text-primary" />
                          </a>
                        )}
                      </div>
                      <p className={`text-xs mt-0.5 ${isComplete ? 'text-muted-foreground/60' : 'text-muted-foreground'}`}>{module.desc}</p>
                      <span className={`inline-block mt-2 px-2 py-0.5 rounded-full text-xs capitalize ${
                        module.tier === 'on-ramp' ? 'bg-blue-500/10 text-blue-400'
                        : module.tier === 'growth' ? 'bg-purple-500/10 text-purple-400'
                        : 'bg-orange-500/10 text-orange-400'
                      }`}>{module.tier}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </PageLayout>
  );
}

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Lock, LayoutGrid, List, ExternalLink } from 'lucide-react';
import PageLayout from '@/components/PageLayout';
import { supabase } from '@/lib/supabase';
import { useRequireAuth } from '@/hooks/useAuth';

type Tier = 'onramp' | 'growth' | 'scale';
type ViewMode = 'modules' | 'table';

const TIER_ORDER: Record<Tier, number> = { onramp: 0, growth: 1, scale: 2 };

const ALL_MODULES = [
  { id: 'b1', pillar: 'BUILD',   tier: 'onramp' as Tier, name: 'Design Retainer Offer + Delivery Roadmap', description: 'Package your offer, set pricing, and map out exactly what clients get.', circleUrl: '' },
  { id: 'b2', pillar: 'BUILD',   tier: 'onramp' as Tier, name: 'Client Onboarding & Strategy Sessions',    description: 'Build a repeatable onboarding flow that sets expectations from day one.', circleUrl: '' },
  { id: 'b3', pillar: 'BUILD',   tier: 'growth' as Tier, name: 'P&L and Margins',                          description: 'Understand your numbers — what you keep after costs.', circleUrl: '' },
  { id: 'b4', pillar: 'BUILD',   tier: 'growth' as Tier, name: 'Upsell Architecture',                      description: 'Create logical next steps so clients naturally spend more.', circleUrl: '' },
  { id: 'b5', pillar: 'BUILD',   tier: 'scale'  as Tier, name: 'SOP Library',                              description: 'Document every process so your business runs without you.', circleUrl: '' },
  { id: 'b6', pillar: 'BUILD',   tier: 'scale'  as Tier, name: 'Full Funnel Paid Ads',                     description: 'Run ads that bring in qualified leads at scale.', circleUrl: '' },
  { id: 't1', pillar: 'TRAFFIC', tier: 'onramp' as Tier, name: 'Optimise Your Profile',                    description: 'Turn your IG/LinkedIn into a lead generation machine.', circleUrl: '' },
  { id: 't2', pillar: 'TRAFFIC', tier: 'onramp' as Tier, name: 'Stupidly Simple Ad',                       description: '$20/day for 5 days — the fastest way to get warm leads in.', circleUrl: '' },
  { id: 't3', pillar: 'TRAFFIC', tier: 'onramp' as Tier, name: 'Warm Outreach',                            description: 'DM scripts and sequences to reactivate your existing network.', circleUrl: '' },
  { id: 't4', pillar: 'TRAFFIC', tier: 'growth' as Tier, name: '5 Ps Framework',                           description: 'A content framework that positions you as the go-to expert.', circleUrl: '' },
  { id: 't5', pillar: 'TRAFFIC', tier: 'growth' as Tier, name: 'Story Sequences + Repurposing',             description: 'Multiply your content output without extra filming time.', circleUrl: '' },
  { id: 't6', pillar: 'TRAFFIC', tier: 'scale'  as Tier, name: 'Full Content Rhythm',                      description: 'A full weekly content system that runs consistently.', circleUrl: '' },
  { id: 's1', pillar: 'SALES',   tier: 'onramp' as Tier, name: 'Proposal Doc + Meeting Flow',              description: 'A proposal template and call structure that closes deals.', circleUrl: '' },
  { id: 's2', pillar: 'SALES',   tier: 'onramp' as Tier, name: 'DM Scripts',                               description: 'Word-for-word scripts for turning DMs into booked calls.', circleUrl: '' },
  { id: 's3', pillar: 'SALES',   tier: 'growth' as Tier, name: 'Lead Tracking + CRM',                      description: 'Track every lead so nothing slips through the cracks.', circleUrl: '' },
  { id: 's4', pillar: 'SALES',   tier: 'growth' as Tier, name: 'Case Studies & Results',                   description: 'Build proof assets that do your selling for you.', circleUrl: '' },
  { id: 'sc1', pillar: 'SCALE',  tier: 'scale'  as Tier, name: 'First Hire + Delegation Mindset',          description: 'Who to hire first and how to hand off without losing quality.', circleUrl: '' },
  { id: 'sc2', pillar: 'SCALE',  tier: 'scale'  as Tier, name: 'Watching the P&L',                         description: 'Weekly financial review habits that keep you profitable.', circleUrl: '' },
  { id: 'sc3', pillar: 'SCALE',  tier: 'scale'  as Tier, name: 'Training Rhythm',                          description: 'How to train your team so standards never slip.', circleUrl: '' },
  { id: 'sc4', pillar: 'SCALE',  tier: 'scale'  as Tier, name: 'Premium Client Experience',                description: 'The touches that turn clients into long-term advocates.', circleUrl: '' },
];

const PILLARS = ['BUILD', 'TRAFFIC', 'SALES', 'SCALE'];

const PILLAR_COLORS: Record<string, string> = {
  BUILD:   'text-pillar-build',
  TRAFFIC: 'text-pillar-traffic',
  SALES:   'text-pillar-sales',
  SCALE:   'text-pillar-scale',
};

const TIER_BADGE: Record<Tier, string> = {
  onramp: 'bg-sky-500/10 text-sky-400 border border-sky-500/20',
  growth: 'bg-amber-500/10 text-amber-400 border border-amber-500/20',
  scale:  'bg-violet-500/10 text-violet-400 border border-violet-500/20',
};

function statusDot(isLocked: boolean, isComplete: boolean) {
  if (isComplete) return <span title="Complete" className="text-base">🟢</span>;
  if (isLocked)   return <span title="Locked"   className="text-base">🔴</span>;
  return               <span title="Available" className="text-base">🟡</span>;
}

export default function Roadmap() {
  const { user, loading } = useRequireAuth();
  const qc = useQueryClient();
  const [view, setView] = useState<ViewMode>('modules');
  const [pillarFilter, setPillarFilter] = useState<string>('ALL');

  const { data: profile } = useQuery({
    queryKey: ['profile', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from('profiles')
        .select('tier, full_name')
        .eq('id', user!.id)
        .single();
      return data;
    },
  });

  const userTier: Tier = (profile?.tier as Tier) ?? 'onramp';

  const { data: progress = [] } = useQuery({
    queryKey: ['checklist-progress', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from('checklist_progress')
        .select('task_key, completed')
        .eq('user_id', user!.id);
      return data ?? [];
    },
  });

  const completedMap: Record<string, boolean> = Object.fromEntries(
    progress.map((p: any) => [p.task_key, p.completed])
  );

  const toggleComplete = useMutation({
    mutationFn: async ({ moduleId, completed }: { moduleId: string; completed: boolean }) => {
      const { error } = await supabase.from('checklist_progress').upsert(
        { user_id: user!.id, task_key: moduleId, completed, updated_at: new Date().toISOString() },
        { onConflict: 'user_id,task_key' }
      );
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['checklist-progress', user?.id] });
    },
  });

  if (loading) return null;

  const isLocked = (tier: Tier) => TIER_ORDER[tier] > TIER_ORDER[userTier];
  const isComplete = (id: string) => !!completedMap[id];

  const filteredModules = pillarFilter === 'ALL'
    ? ALL_MODULES
    : ALL_MODULES.filter((m) => m.pillar === pillarFilter);

  const modulesByPillar = PILLARS.reduce((acc, pillar) => {
    acc[pillar] = filteredModules.filter((m) => m.pillar === pillar);
    return acc;
  }, {} as Record<string, typeof ALL_MODULES>);

  const completedCount = ALL_MODULES.filter((m) => isComplete(m.id)).length;
  const availableCount = ALL_MODULES.filter((m) => !isLocked(m.tier)).length;

  return (
    <PageLayout>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground mb-1">Roadmap</h1>
          <p className="text-sm text-muted-foreground">
            {completedCount} of {availableCount} available modules completed
            {userTier !== 'scale' && (
              <span className="ml-2 text-xs text-muted-foreground/60">
                · Unlock more by progressing to the next tier
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-1 bg-secondary rounded-lg p-1">
          <button
            onClick={() => setView('modules')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              view === 'modules'
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            Modules
          </button>
          <button
            onClick={() => setView('table')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              view === 'table'
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <List className="w-3.5 h-3.5" />
            Checklist
          </button>
        </div>
      </div>

      <div className="flex gap-2 mb-6 flex-wrap">
        {['ALL', ...PILLARS].map((p) => (
          <button
            key={p}
            onClick={() => setPillarFilter(p)}
            className={`px-3 py-1 rounded-full text-xs font-semibold border transition-all ${
              pillarFilter === p
                ? 'bg-primary text-primary-foreground border-primary'
                : 'border-border text-muted-foreground hover:text-foreground'
            }`}
          >
            {p}
          </button>
        ))}
      </div>

      {view === 'modules' && (
        <div className="space-y-8">
          {PILLARS.filter((p) => pillarFilter === 'ALL' || p === pillarFilter).map((pillar) => {
            const mods = modulesByPillar[pillar];
            if (!mods?.length) return null;
            return (
              <div key={pillar}>
                <h2 className={`text-xs font-bold tracking-widest uppercase mb-3 ${PILLAR_COLORS[pillar]}`}>
                  {pillar}
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {mods.map((mod) => {
                    const locked = isLocked(mod.tier);
                    const complete = isComplete(mod.id);
                    return (
                      <div
                        key={mod.id}
                        className={`relative rounded-xl border p-4 transition-all ${
                          locked
                            ? 'border-border opacity-50 cursor-not-allowed'
                            : complete
                            ? 'border-success/30 bg-success/5'
                            : 'border-border hover:border-primary/30'
                        }`}
                      >
                        <div className="absolute top-3 right-3">
                          {statusDot(locked, complete)}
                        </div>
                        <div className="flex items-start gap-3 mb-2 pr-8">
                          {!locked && (
                            <input
                              type="checkbox"
                              checked={complete}
                              onChange={(e) =>
                                toggleComplete.mutate({ moduleId: mod.id, completed: e.target.checked })
                              }
                              className="mt-0.5 h-4 w-4 rounded border-border accent-primary flex-shrink-0"
                            />
                          )}
                          {locked && (
                            <Lock className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                          )}
                          <p className={`text-sm font-semibold leading-snug ${complete ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                            {mod.name}
                          </p>
                        </div>
                        <p className="text-xs text-muted-foreground leading-relaxed pl-7 mb-3">
                          {mod.description}
                        </p>
                        <div className="flex items-center justify-between pl-7">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TIER_BADGE[mod.tier]}`}>
                            {mod.tier}
                          </span>
                          {!locked && mod.circleUrl && (
                            <a
                              href={mod.circleUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 text-xs text-primary hover:underline"
                            >
                              Watch <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {view === 'table' && (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/30">
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground w-8"></th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Module</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground hidden sm:table-cell">Pillar</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground hidden sm:table-cell">Tier</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground">Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredModules.map((mod, i) => {
                const locked = isLocked(mod.tier);
                const complete = isComplete(mod.id);
                return (
                  <tr
                    key={mod.id}
                    className={`border-b border-border/50 transition-colors ${
                      locked ? 'opacity-40' : 'hover:bg-secondary/20'
                    } ${i === filteredModules.length - 1 ? 'border-b-0' : ''}`}
                  >
                    <td className="px-4 py-3">
                      {locked ? (
                        <Lock className="w-3.5 h-3.5 text-muted-foreground" />
                      ) : (
                        <input
                          type="checkbox"
                          checked={complete}
                          onChange={(e) =>
                            toggleComplete.mutate({ moduleId: mod.id, completed: e.target.checked })
                          }
                          className="h-4 w-4 rounded border-border accent-primary"
                        />
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className={`text-sm font-medium leading-snug ${complete ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                          {mod.name}
                        </span>
                        {!locked && mod.circleUrl && (
                          <a href={mod.circleUrl} target="_blank" rel="noopener noreferrer" className="text-primary flex-shrink-0">
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <span className={`text-xs font-bold ${PILLAR_COLORS[mod.pillar]}`}>
                        {mod.pillar}
                      </span>
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TIER_BADGE[mod.tier]}`}>
                        {mod.tier}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {statusDot(locked, complete)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </PageLayout>
  );
}

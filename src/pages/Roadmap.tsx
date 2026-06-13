import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Circle, Lock, ExternalLink, BookOpen, ChevronDown, ChevronRight } from 'lucide-react';

import { useNavigate } from 'react-router-dom';
import PageLayout from '@/components/PageLayout';
import { supabase } from '@/lib/supabase';
import { useRequireAuth } from '@/hooks/useAuth';
import { usePageTracking } from '@/hooks/usePageTracking';

const PILLARS = [
  {
    id: 'build', name: 'BUILD', color: 'text-blue-400', borderColor: 'border-blue-400/20',
    modules: [
      { id: 'design-retainer-offer', name: 'Design Retainer Offer', desc: 'Package your offer, set pricing, and map out exactly what clients get.', tier: 'on-ramp', circleUrl: '' },
      { id: 'delivery-roadmap', name: 'Delivery Roadmap', desc: 'Build a step-by-step operating system for delivering your retainer from sign to published post.', tier: 'on-ramp', circleUrl: '' },
      { id: 'client-onboarding', name: 'Client Onboarding & Strategy Sessions', desc: 'Build a repeatable onboarding flow that sets expectations from day one.', tier: 'on-ramp', circleUrl: '' },
      { id: 'pl-margins', name: 'P&L and Margins', desc: 'Understand your numbers — what you keep after costs.', tier: 'growth', circleUrl: '' },
      { id: 'upsell-architecture', name: 'Value Ladder', desc: 'Create logical next steps so clients naturally spend more.', tier: 'growth', circleUrl: '' },
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
      { id: 'proposal-doc', name: 'Proposal Doc', desc: 'Build a proposal doc that does the selling for you, sent before the meeting and used during it.', tier: 'on-ramp', circleUrl: '' },
      { id: 'sales-meeting-flow', name: 'Sales Meeting Flow', desc: 'Walk into every sales meeting with conviction, diagnose what the client needs, and close.', tier: 'on-ramp', circleUrl: '' },
      { id: 'your-offer-suite', name: 'Your Offer Suite', desc: 'Design a clear suite of offers — entry, core, and premium — so every prospect has a logical next step.', tier: 'growth', circleUrl: '' },
    ],
  },
  {
    id: 'scale', name: 'SCALE', color: 'text-orange-400', borderColor: 'border-orange-400/20',
    modules: [
      { id: 'hire-first-editor', name: 'Hire Your First Editor', desc: 'Remove yourself from production without losing quality.', tier: 'growth', circleUrl: '' },
      { id: 'lean-org-chart', name: 'Your Lean Organisation Chart', desc: 'Map the roles your business needs to run lean and scale without bloat.', tier: 'scale', circleUrl: '' },
      { id: 'client-retention', name: 'Client Retention', desc: 'Keep clients longer with proactive communication, results reporting, and renewals.', tier: 'scale', circleUrl: '' },
      { id: 'leadership-staff-management', name: 'Leadership & Staff Management', desc: 'Lead your team with clarity — set standards, run reviews, and build a culture that performs.', tier: 'scale', circleUrl: '' },
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
  const navigate = useNavigate();

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

  const safeCompletions = Array.isArray(completions) ? completions : [];
  const completionMap: Record<string, boolean> = Object.fromEntries(safeCompletions.map((c: any) => [c.task_key, c.completed]));

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

  const { data: modulePages = [] } = useQuery({
    queryKey: ['module-pages-list'],
    queryFn: async () => {
      const { data } = await supabase.from('module_pages').select('module_id');
      return data?.map((d: any) => d.module_id) ?? [];
    },
  });
  const hasPage = (id: string) => modulePages.includes(id);

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

      <LegacyModulesSection>
        <PillarRoadmap
          completionMap={completionMap}
          unlockedTiers={unlockedTiers}
          toggleModule={toggleModule}
          navigate={navigate}
          hasPage={hasPage}
        />
      </LegacyModulesSection>

      <ProfitXRoadmapSection />
    </PageLayout>
  );
}

function LegacyModulesSection({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mb-10">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between gap-3 p-4 bg-card border border-border rounded-xl hover:bg-muted/20 transition"
      >
        <div className="text-left">
          <p className="text-sm font-semibold text-foreground flex items-center gap-2">
            {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            Legacy Modules
          </p>
          <p className="text-xs text-muted-foreground mt-0.5 ml-6">
            Original curriculum — still available while new modules roll out.
          </p>
        </div>
      </button>
      {open && <div className="mt-4">{children}</div>}
    </div>
  );
}

const PROFITX_COLUMNS = [
  { key: 'O', label: 'OFFER' },
  { key: 'C', label: 'CLIENTS' },
  { key: 'D', label: 'DELIVERY' },
];

const PROFITX_MODULES: Record<string, string> = {
  O1: 'Market & Message', O2: 'Golden Retainer', O3: 'Tier Flow',
  O4: 'Revenue Architect', O5: 'Premium Positioning', O6: 'Financial Mastery',
  C1: 'Organic Flywheel', C2: 'Stupidly Simple Ad', C3: 'Proposal Packs',
  C4: 'Full Funnel Paid Ads', C5: 'Content Authority', C6: 'Client Retention System',
  D1: 'Delivery Roadmap', D2: 'Onboarding Blueprint', D3: 'Getting Help',
  D4: 'Build Your A-Team', D5: 'Airtight SOPs', D6: 'Leadership System',
};

function ProfitXRoadmapSection() {
  const stages = [
    { label: '$0–20k', rows: [1, 2, 3], cardClass: 'bg-[#7c5cff] border-[#7c5cff]', codeBg: 'bg-white/25' },
    { label: '$30–84k', rows: [4, 5, 6], cardClass: 'bg-[#1e1547] border-[#2a1f5c]', codeBg: 'bg-white/10' },
  ];


  return (
    <div className="mt-8">
      <div className="mb-6">
        <h2 className="text-2xl font-bold">
          ProfitX Roadmap<span className="text-primary">™</span>
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          18 modules · two stages · the path from $0 to $84k+ per month
        </p>
      </div>

      <div className="bg-card border border-border rounded-xl p-4 sm:p-6">
        {/* Column headers */}
        <div className="grid grid-cols-[60px_1fr_1fr_1fr] gap-3 mb-4 pb-3 border-b border-border">
          <div />
          {PROFITX_COLUMNS.map(c => (
            <div key={c.key} className="text-xs font-bold tracking-[0.2em] text-muted-foreground text-center">
              {c.label}
            </div>
          ))}
        </div>

        {stages.map((stage, sIdx) => (
          <div key={stage.label} className={`grid grid-cols-[60px_1fr_1fr_1fr] gap-3 ${sIdx > 0 ? 'mt-6 pt-6 border-t border-border' : ''}`}>
            <div className="text-sm font-bold text-primary flex items-center">{stage.label}</div>
            <div className="col-span-3 grid grid-cols-3 gap-3">
              {stage.rows.flatMap(row =>
                PROFITX_COLUMNS.map(col => {
                  const code = `${col.key}${row}`;
                  const name = PROFITX_MODULES[code];
                  return (
                    <div
                      key={code}
                      className={`relative rounded-xl border p-3 opacity-70 cursor-not-allowed ${stage.cardClass}`}
                    >
                      <div className="flex items-center gap-3">
                        <span className={`shrink-0 px-2 py-1 rounded-md text-xs font-bold text-white ${stage.codeBg}`}>
                          {code}
                        </span>
                        <span className="text-sm font-semibold text-white truncate">{name}</span>
                        <div className="ml-auto w-4 h-4 rounded border border-white/40 shrink-0" />
                      </div>
                      <span className="absolute -top-2 -right-2 px-2 py-0.5 rounded-full bg-background border border-border text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                        Coming Soon
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        ))}

      </div>
    </div>
  );
}


function PillarRoadmap({
  completionMap,
  unlockedTiers,
  toggleModule,
  navigate,
  hasPage,
}: {
  completionMap: Record<string, boolean>;
  unlockedTiers: string[];
  toggleModule: any;
  navigate: (path: string) => void;
  hasPage: (id: string) => boolean;
}) {
  const [activePillarId, setActivePillarId] = useState<string>(PILLARS[0].id);
  const activePillar = PILLARS.find(p => p.id === activePillarId)!;

  return (
    <>
      {/* Pillar tab toggle */}
      <div className="flex gap-2 flex-wrap mb-6 border-b border-border pb-3">
        {PILLARS.map(p => {
          const isActive = p.id === activePillarId;
          const completed = p.modules.filter(m => moduleMatchesTier(m.tier, unlockedTiers) && completionMap[m.id]).length;
          const total = p.modules.filter(m => moduleMatchesTier(m.tier, unlockedTiers)).length;
          return (
            <button
              key={p.id}
              onClick={() => setActivePillarId(p.id)}
              className={`px-4 py-2 rounded-lg text-sm font-bold tracking-wider uppercase transition-all ${
                isActive
                  ? `bg-card border border-border ${p.color}`
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {p.name}
              <span className="ml-2 text-xs font-medium text-muted-foreground normal-case tracking-normal">
                {completed}/{total}
              </span>
            </button>
          );
        })}
      </div>

      <div>
        <h2 className={`text-xs font-bold tracking-widest uppercase mb-3 ${activePillar.color}`}>{activePillar.name}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {activePillar.modules.map((module) => {
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
                  <div className="flex items-center gap-2 mt-2">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs capitalize ${
                      module.tier === 'on-ramp' ? 'bg-blue-500/10 text-blue-400'
                      : module.tier === 'growth' ? 'bg-purple-500/10 text-purple-400'
                      : 'bg-orange-500/10 text-orange-400'
                    }`}>{module.tier}</span>
                    {hasPage(module.id) && (
                      <button
                        onClick={(e) => { e.stopPropagation(); navigate(`/module/${module.id}`); }}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-primary/10 text-primary hover:bg-primary/20 transition"
                      >
                        <BookOpen className="w-3 h-3" /> View Module
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}

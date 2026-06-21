import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Circle, Lock, ExternalLink, BookOpen, ChevronDown, ChevronRight } from 'lucide-react';
import OnboardingNoticeModal from '@/components/OnboardingNoticeModal';

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

// Maps the client's account tier to the legacy module difficulty tiers they can access.
function getUnlockedModuleTiers(clientTier: string): string[] {
  if (clientTier === 'in_flow_starter' || clientTier === 'in_flow_scale') {
    return ['on-ramp', 'growth', 'scale'];
  }
  // 'onboarding' (and any legacy/unknown value) — On-Ramp legacy modules only.
  return ['on-ramp'];
}

function moduleMatchesTier(moduleTier: string, unlockedTiers: string[]): boolean {
  return unlockedTiers.includes(moduleTier);
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
      const { data } = await supabase.from('profiles').select('tier, onboarding_notice_seen').eq('id', user!.id).single();
      return data;
    },
  });

  const clientTier = profile?.tier || 'onboarding';
  const unlockedTiers = getUnlockedModuleTiers(clientTier);



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


  // ProfitX access driven by the new client tier system:
  // - 'in_flow_starter' unlocks Stage 1 (first 9 modules)
  // - 'in_flow_scale' unlocks both stages
  // - 'onboarding' = no ProfitX access (whole section is hidden below)
  const isInFlow = clientTier === 'in_flow_starter' || clientTier === 'in_flow_scale';
  const isFullScale = clientTier === 'in_flow_scale';
  const profitxStages = [
    {
      key: 'stage1' as const,
      label: '$0–20k / month',
      rows: [1, 2, 3],
      cardClass: 'bg-[hsl(var(--primary))] border-[hsl(var(--primary))]',
      codeBg: 'bg-white/20',
      unlocked: isInFlow,
    },
    {
      key: 'stage2' as const,
      label: '$30–84k / month',
      rows: [4, 5, 6],
      cardClass: 'bg-[hsl(var(--deep-purple))] border-[hsl(var(--deep-purple))]',
      codeBg: 'bg-white/15',
      unlocked: isFullScale,
    },
  ];


  const profitxModuleCodes = profitxStages.flatMap(s =>
    s.rows.flatMap(r => PROFITX_COLUMNS.map(c => ({ code: `${c.key}${r}`, stage: s })))
  );
  const unlockedProfitx = profitxModuleCodes.filter(m => m.stage.unlocked);
  const completedProfitx = unlockedProfitx.filter(m => completionMap[m.code]).length;
  const progressPct = unlockedProfitx.length > 0
    ? Math.round((completedProfitx / unlockedProfitx.length) * 100)
    : 0;

  return (
    <PageLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">
          ProfitX Roadmap<span className="text-primary">™</span>
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {isInFlow
            ? '18 modules · two stages · the path from $0 to $84k+ per month.'
            : 'Start with your On-Ramp modules below. The full roadmap unlocks once you graduate to In Flow.'}
        </p>
      </div>

      {isInFlow && (

        <>
          {/* Stage indicators */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
            {profitxStages.map(s => {
              const stageModules = s.rows.flatMap(r => PROFITX_COLUMNS.map(c => `${c.key}${r}`));
              const done = stageModules.filter(c => completionMap[c]).length;
              return (
                <div
                  key={s.key}
                  className={`rounded-xl border p-4 ${
                    s.unlocked
                      ? 'bg-card border-border'
                      : 'bg-muted/20 border-border opacity-60'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-bold text-foreground">{s.label}</p>
                    {s.unlocked ? (
                      <span className="text-xs text-muted-foreground">{done}/{stageModules.length} done</span>
                    ) : (
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Lock className="w-3 h-3" /> Locked
                      </span>
                    )}
                  </div>
                  {!s.unlocked && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Contact your coach to unlock this stage.
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          {/* Overall progress */}
          <div className="bg-card border border-border rounded-xl p-4 mb-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-foreground">Overall Progress</span>
              <span className="text-sm font-bold text-primary">{completedProfitx}/{unlockedProfitx.length} modules</span>
            </div>
            <div className="w-full bg-muted rounded-full h-2">
              <div className="bg-primary rounded-full h-2 transition-all duration-500" style={{ width: `${progressPct}%` }} />
            </div>
            <p className="text-xs text-muted-foreground mt-1.5">{progressPct}% complete</p>
          </div>

          <ProfitXRoadmapGrid
            stages={profitxStages}
            completionMap={completionMap}
            hasPage={hasPage}
            onOpen={(code) => navigate(`/module/${code}`)}
          />
        </>
      )}

      <LegacyModulesSection defaultOpen={!isInFlow}>
        <PillarRoadmap
          completionMap={completionMap}
          unlockedTiers={unlockedTiers}
          toggleModule={toggleModule}
          navigate={navigate}
          hasPage={hasPage}
        />
      </LegacyModulesSection>
    </PageLayout>
  );
}

function LegacyModulesSection({ children, defaultOpen = false }: { children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="mt-10">
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
  C1: 'Organic Content Flywheel', C2: 'Stupidly Simple Ad', C3: 'Proposal Packs',
  C4: 'Full Funnel Paid Ads', C5: 'Content Authority', C6: 'Client Retention System',
  D1: 'Delivery Roadmap', D2: 'Onboarding Blueprint', D3: 'Getting Help',
  D4: 'Build Your A-Team', D5: 'Airtight SOPs', D6: 'Leadership System',
};

type Stage = {
  key: string;
  label: string;
  rows: number[];
  cardClass: string;
  codeBg: string;
  unlocked: boolean;
};

function ProfitXRoadmapGrid({
  stages,
  completionMap,
  hasPage,
  onOpen,
}: {
  stages: Stage[];
  completionMap: Record<string, boolean>;
  hasPage: (id: string) => boolean;
  onOpen: (code: string) => void;
}) {
  return (
    <div className="bg-card border border-border rounded-xl p-4 sm:p-6">
      {/* Column headers — desktop only */}
      <div className="hidden sm:grid grid-cols-[60px_1fr_1fr_1fr] gap-3 mb-4 pb-3 border-b border-border">
        <div />
        {PROFITX_COLUMNS.map(c => (
          <div key={c.key} className="text-xs font-bold tracking-[0.2em] text-muted-foreground text-center">
            {c.label}
          </div>
        ))}
      </div>

      {stages.map((stage, sIdx) => (
        <div
          key={stage.key}
          className={`grid grid-cols-1 sm:grid-cols-[60px_1fr_1fr_1fr] gap-3 ${sIdx > 0 ? 'mt-6 pt-6 border-t border-border' : ''}`}
        >
          {/* Stage label */}
          <div className="text-sm font-bold text-primary flex items-center justify-center sm:justify-start py-1">
            {stage.label.split(' ')[0]}
          </div>

          {/* Module grid — 1 col mobile, 3 col desktop */}
          <div className="sm:col-span-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
            {stage.rows.flatMap(row =>
              PROFITX_COLUMNS.map(col => {
                const code = `${col.key}${row}`;
                const name = PROFITX_MODULES[code];
                const isComplete = !!completionMap[code];
                const isLocked = !stage.unlocked;
                const hasContent = hasPage(code);

                if (isLocked) {
                  return (
                    <div
                      key={code}
                      className={`relative rounded-xl border p-3 opacity-50 cursor-not-allowed ${stage.cardClass}`}
                    >
                      <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-3 text-center sm:text-left">
                        <span className={`shrink-0 px-2 py-1 rounded-md text-xs font-bold text-white ${stage.codeBg}`}>
                          {code}
                        </span>
                        <span className="text-xs font-medium text-white/90 sm:text-sm sm:font-semibold sm:truncate">{name}</span>
                        <Lock className="w-3.5 h-3.5 text-white/70 shrink-0 sm:ml-auto" />
                      </div>
                    </div>
                  );
                }

                return (
                  <button
                    key={code}
                    onClick={() => onOpen(code)}
                    className={`relative rounded-xl border p-3 text-center sm:text-left transition-transform hover:scale-[1.02] hover:shadow-lg ${stage.cardClass}`}
                  >
                    <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-3">
                      <span className={`shrink-0 px-2 py-1 rounded-md text-xs font-bold text-white ${stage.codeBg}`}>
                        {code}
                      </span>
                      <span className="text-xs font-medium text-white/90 sm:text-sm sm:font-semibold sm:truncate flex-1">{name}</span>
                      {isComplete ? (
                        <CheckCircle2 className="w-4 h-4 text-white shrink-0" />
                      ) : !hasContent ? (
                        <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-white/15 text-white/80 shrink-0">Soon</span>
                      ) : null}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      ))}
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

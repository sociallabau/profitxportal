import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Circle, Lock, ExternalLink, BookOpen, ChevronDown, ChevronRight, LayoutGrid, List } from 'lucide-react';
import OnboardingNoticeModal from '@/components/OnboardingNoticeModal';
import RevenueLadder from '@/components/RevenueLadder';
import RoadmapAudit from '@/components/RoadmapAudit';

import { useNavigate } from 'react-router-dom';
import PageLayout from '@/components/PageLayout';
import { supabase } from '@/lib/supabase';
import { useRequireAuth } from '@/hooks/useAuth';
import { usePageTracking } from '@/hooks/usePageTracking';
import type { UseMutationResult } from '@tanstack/react-query';
import { PROFITX_MODULES } from '@/data/modules';
import { GATES, MODULE_GATE, ROMAN, gateNumber, type GateNumber } from '@/lib/growthHub';
import { useMemberGrowthHub } from '@/hooks/useGrowthHub';

const PILLARS = [
  {
    id: 'build', name: 'BUILD', color: 'text-blue-600', borderColor: 'border-blue-400/20',
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
    id: 'traffic', name: 'TRAFFIC', color: 'text-primary', borderColor: 'border-purple-400/20',
    modules: [
      { id: 'optimise-profile', name: 'Optimise Your Profile', desc: 'Turn your IG/LinkedIn into a lead generation machine.', tier: 'on-ramp', circleUrl: '' },
      { id: 'stupidly-simple-ad', name: 'Profile Visit Ads', desc: '$50 profile-visit boost behind each post at Gate 1, then an always-on awareness campaign from Gate 2.', tier: 'on-ramp', circleUrl: '' },
      { id: 'warm-outreach', name: 'Warm Outreach', desc: 'DM scripts and sequences to reactivate your existing network.', tier: 'on-ramp', circleUrl: '' },
      { id: '5ps-framework', name: '5 Ps Framework', desc: 'A content framework that positions you as the go-to expert.', tier: 'growth', circleUrl: '' },
      { id: 'full-funnel-paid-ads', name: 'Full Funnel Paid Ads', desc: 'Run ads that bring in qualified leads at scale.', tier: 'scale', circleUrl: '' },
    ],
  },
  {
    id: 'sales', name: 'SALES', color: 'text-success', borderColor: 'border-green-400/20',
    modules: [
      { id: 'proposal-doc', name: 'Proposal Doc', desc: 'Build a proposal doc that does the selling for you, sent before the meeting and used during it.', tier: 'on-ramp', circleUrl: '' },
      { id: 'sales-meeting-flow', name: 'Sales Meeting Flow', desc: 'Walk into every sales meeting with conviction, diagnose what the client needs, and close.', tier: 'on-ramp', circleUrl: '' },
      { id: 'your-offer-suite', name: 'Your Offer Suite', desc: 'Design a clear suite of offers — entry, core, and premium — so every prospect has a logical next step.', tier: 'growth', circleUrl: '' },
    ],
  },
  {
    id: 'scale', name: 'SCALE', color: 'text-orange-600', borderColor: 'border-orange-400/20',
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
  { id: 'on-ramp', label: 'On-Ramp', color: 'text-blue-600', bg: 'bg-blue-500/10', border: 'border-blue-500/30', activeBg: 'bg-blue-500/20' },
  { id: 'growth', label: 'Growth', color: 'text-primary', bg: 'bg-purple-500/10', border: 'border-purple-500/30', activeBg: 'bg-purple-500/20' },
  { id: 'scale', label: 'Scale', color: 'text-orange-600', bg: 'bg-orange-500/10', border: 'border-orange-500/30', activeBg: 'bg-orange-500/20' },
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
  const [showNotice, setShowNotice] = useState(true);

  const { data: profile } = useQuery({
    queryKey: ['profile-tier', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('tier, onboarding_notice_seen, gate').eq('id', user!.id).single();
      return data;
    },
  });

  const clientTier = profile?.tier || 'onboarding';
  const unlockedTiers = getUnlockedModuleTiers(clientTier);

  const { data: latestMonthly } = useQuery({
    queryKey: ['latest-monthly-total', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from('monthly_totals')
        .select('total_revenue')
        .eq('user_id', user!.id)
        .order('month', { ascending: false })
        .limit(1);
      return data?.[0] ?? null;
    },
  });

  const { data: completions = [] } = useQuery({
    queryKey: ['module-completions', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from('checklist_progress').select('task_key, completed').eq('user_id', user!.id);
      return data ?? [];
    },
  });

  const safeCompletions = Array.isArray(completions) ? completions : [];
  const completionMap: Record<string, boolean> = Object.fromEntries(safeCompletions.map(c => [c.task_key, c.completed]));

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
      return data?.map(d => d.module_id) ?? [];
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


  const shouldShowNotice = clientTier === 'onboarding' && !profile?.onboarding_notice_seen && showNotice;
  const gate = gateNumber(profile?.gate);
  const { data: memberGrowthHub } = useMemberGrowthHub(user?.id);
  // Always opens on the grid; the list is a focused view of the member's current gate.
  const [view, setView] = useState<'grid' | 'list'>('grid');

  return (
    <PageLayout>
      {shouldShowNotice && (
        <OnboardingNoticeModal onDismiss={() => setShowNotice(false)} />
      )}

      <RevenueLadder currentRevenue={latestMonthly?.total_revenue} />

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

      <RoadmapAudit includeScale={isFullScale} onOpenModule={(code) => navigate(`/module/${code}`)} />

      <div className="flex items-center justify-between gap-3 mb-3">
        <h2 className="text-sm font-semibold">The modules</h2>
        <div className="inline-flex rounded-full bg-muted p-1 text-xs font-semibold" role="tablist" aria-label="Roadmap view">
          {([['grid', LayoutGrid, 'Grid'], ['list', List, 'By gate']] as const).map(([v, Icon, label]) => (
            <button key={v} role="tab" aria-selected={view === v} onClick={() => setView(v)}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 transition-colors ${view === v ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
              <Icon className="w-3.5 h-3.5" />{label}
            </button>
          ))}
        </div>
      </div>

      {view === 'grid' ? (
        <ProfitXRoadmapGrid
          stages={profitxStages}
          completionMap={completionMap}
          hasPage={hasPage}
          onOpen={(code) => navigate(`/module/${code}`)}
        />
      ) : (
        <GateModuleList gate={gate ?? 1} extra={memberGrowthHub?.settings.extra_modules ?? []} completionMap={completionMap} hasPage={hasPage} onOpen={(code) => navigate(`/module/${code}`)} />
      )}

      <LegacyModulesSection>
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

/** The original curriculum, always closed until the member opens it. */
function LegacyModulesSection({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);

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

/**
 * The modules grouped by the gate they open at. The member's gate is open;
 * cleared gates fold away and later gates stay locked, like the Growth Hub map.
 */
function GateModuleList({ gate, extra, completionMap, hasPage, onOpen }: {
  gate: GateNumber; extra: string[]; completionMap: Record<string, boolean>; hasPage: (id: string) => boolean; onOpen: (code: string) => void;
}) {
  const codes = (g: GateNumber) => Object.keys(MODULE_GATE).filter(code => MODULE_GATE[code] === g);
  const unlockedExtras = extra.filter(code => (MODULE_GATE[code] ?? 1) > gate);
  return (
    <div className="space-y-3">
      {GATES.map(g => {
        const state = g.gate < gate ? 'cleared' : g.gate === gate ? 'current' : 'locked';
        const list = state === 'current' ? [...codes(g.gate), ...unlockedExtras] : [];
        return (
          <div key={g.gate} className={`rounded-xl border p-4 sm:p-5 ${state === 'current' ? 'bg-card border-primary/40' : 'bg-card/60 border-border'}`}>
            <div className="flex items-center justify-between gap-3">
              <p className={`text-sm font-bold ${state === 'locked' ? 'text-muted-foreground' : ''}`}>
                <span className="text-primary">Gate {ROMAN[g.gate]}</span> · {g.name}
                <span className="text-xs font-medium text-muted-foreground ml-2">{g.headline}</span>
              </p>
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground inline-flex items-center gap-1 shrink-0">
                {state === 'locked' && <Lock className="w-3 h-3" />}
                {state === 'cleared' ? 'Cleared' : state === 'current' ? "You're here" : 'Locked'} · {codes(g.gate).join(' ')}
              </span>
            </div>
            {list.length > 0 && (
              <ul className="mt-3 space-y-2">
                {list.map(code => (
                  <li key={code}>
                    {hasPage(code) ? (
                      <button onClick={() => onOpen(code)} className="w-full flex items-center gap-3 rounded-lg border border-border px-3 py-2.5 text-left hover:border-primary/40 transition-colors">
                        <span className="shrink-0 rounded-md bg-primary text-primary-foreground px-2 py-0.5 text-xs font-bold">{code}</span>
                        <span className="text-sm font-semibold flex-1">{PROFITX_MODULES[code]}</span>
                        {MODULE_GATE[code] > gate && <span className="text-[10px] text-muted-foreground">Unlocked by Dan</span>}
                        {completionMap[code] ? <CheckCircle2 className="w-4 h-4 text-primary shrink-0" /> : <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />}
                      </button>
                    ) : (
                      <div className="flex items-center gap-3 rounded-lg border border-dashed border-border px-3 py-2.5">
                        <span className="shrink-0 rounded-md bg-muted text-muted-foreground px-2 py-0.5 text-xs font-bold">{code}</span>
                        <span className="text-sm font-semibold flex-1 text-muted-foreground">{PROFITX_MODULES[code]}</span>
                        <a href={ONBOARDING_COVERED_CODES.has(code) ? undefined : DAN_WHATSAPP_URL} target="_blank" rel="noopener noreferrer" className="text-[11px] text-foreground/70 hover:underline">
                          {ONBOARDING_COVERED_CODES.has(code) ? 'Covered in onboarding' : 'Book a call with Dan'}
                        </a>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}

const PROFITX_COLUMNS = [
  { key: 'O', label: 'OFFER' },
  { key: 'C', label: 'CLIENTS' },
  { key: 'D', label: 'DELIVERY' },
];

// Modules covered during onboarding — tagged instead of needing module content.
const ONBOARDING_COVERED_CODES = new Set(['O1', 'O2', 'O3', 'C3']);

// Opens a WhatsApp chat with Dan so members can book a call to cover the module.
const DAN_WHATSAPP_URL = 'https://wa.me/61429662984?text=' + encodeURIComponent("Hey Dan — can we book a call to cover this module?");

/** Which gate a module first opens at, matching the Growth Hub page. */
function GateBadge({ code }: { code: string }) {
  const gate = MODULE_GATE[code];
  if (!gate) return null;
  return <span className="shrink-0 rounded-full bg-white/25 px-1.5 py-0.5 text-[9px] font-bold tracking-wider text-white" title={`Opens at Gate ${gate}`}>G{ROMAN[gate]}</span>;
}

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

      {stages.map((stage, sIdx) => {
          const renderTile = (code: string, name: string) => {
          const isComplete = !!completionMap[code];
          const isLocked = !stage.unlocked;
          const hasContent = hasPage(code);

          if (isComplete && hasContent) {
            return (
              <button
                key={code}
                onClick={() => onOpen(code)}
                className={`relative rounded-xl border p-3 text-left transition-transform hover:scale-[1.02] hover:shadow-lg ${stage.cardClass}`}
              >
                <div className="flex flex-row items-center gap-2 sm:gap-3">
                  <span className={`shrink-0 px-2 py-1 rounded-md text-xs font-bold text-white ${stage.codeBg}`}>
                    {code}
                  </span>
                  <span className="text-xs font-medium text-white/90 sm:text-sm sm:font-semibold sm:truncate flex-1">{name}</span>
                  <GateBadge code={code} />
                  <CheckCircle2 className="w-4 h-4 text-white shrink-0" />
                </div>
              </button>
            );
          }

          if (ONBOARDING_COVERED_CODES.has(code)) {
            return (
              <div key={code} className="flex flex-col gap-1 min-w-0">
                <div className={`relative rounded-xl border p-3 text-left opacity-55 ${stage.cardClass}`}>
                  <div className="flex flex-row items-center gap-2 sm:gap-3">
                    <span className={`shrink-0 px-2 py-1 rounded-md text-xs font-bold text-white ${stage.codeBg}`}>
                      {code}
                    </span>
                    <span className="text-xs font-medium text-white/90 sm:text-sm sm:font-semibold sm:truncate flex-1">{name}</span>
                  <GateBadge code={code} />
                  </div>
                </div>
                <span className="text-[11px] leading-snug text-foreground/70 px-1">Covered in Onboarding</span>
              </div>
            );
          }

          if (isLocked) {
            return (
              <div
                key={code}
                className={`relative rounded-xl border p-3 opacity-50 cursor-not-allowed ${stage.cardClass}`}
              >
                <div className="flex flex-row items-center gap-2 sm:gap-3 text-left">
                  <span className={`shrink-0 px-2 py-1 rounded-md text-xs font-bold text-white ${stage.codeBg}`}>
                    {code}
                  </span>
                  <span className="text-xs font-medium text-white/90 sm:text-sm sm:font-semibold sm:truncate flex-1">{name}</span>
                  <GateBadge code={code} />
                  <Lock className="w-3.5 h-3.5 text-white/70 shrink-0" />
                </div>
              </div>
            );
          }

          if (!hasContent) {
            return (
              <div key={code} className="flex flex-col gap-1 min-w-0">
                <div className={`relative rounded-xl border p-3 text-left opacity-55 ${stage.cardClass}`}>
                  <div className="flex flex-row items-center gap-2 sm:gap-3">
                    <span className={`shrink-0 px-2 py-1 rounded-md text-xs font-bold text-white ${stage.codeBg}`}>
                      {code}
                    </span>
                    <span className="text-xs font-medium text-white/90 sm:text-sm sm:font-semibold sm:truncate flex-1">{name}</span>
                  <GateBadge code={code} />
                  </div>
                </div>
                <a
                  href={DAN_WHATSAPP_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11px] leading-snug text-foreground/70 hover:text-foreground hover:underline underline-offset-2 px-1"
                >
                  Book a call with Dan to cover
                </a>
              </div>
            );
          }

          return (
            <button
              key={code}
              onClick={() => onOpen(code)}
              className={`relative rounded-xl border p-3 text-left transition-transform hover:scale-[1.03] ring-2 ring-primary shadow-[0_0_18px_hsl(var(--primary)/0.6)] ${stage.cardClass}`}
            >
              <div className="flex flex-row items-center gap-2 sm:gap-3">
                <span className={`shrink-0 px-2 py-1 rounded-md text-xs font-bold text-white ${stage.codeBg}`}>
                  {code}
                </span>
                <span className="text-xs font-medium text-white/90 sm:text-sm sm:font-semibold sm:truncate flex-1">{name}</span>
                  <GateBadge code={code} />
              </div>
            </button>
          );
        };

        return (
          <div key={stage.key} className={sIdx > 0 ? 'mt-6 pt-6 border-t border-border' : ''}>
            {/* Stage label */}
            <div className="text-sm font-bold text-primary mb-3 sm:mb-0 sm:hidden">
              {stage.label}
            </div>

            {/* Mobile: grouped by category */}
            <div className="sm:hidden space-y-5">
              {PROFITX_COLUMNS.map(col => (
                <div key={col.key}>
                  <div className="text-xs font-bold tracking-[0.2em] text-muted-foreground mb-2">
                    {col.label}
                  </div>
                  <div className="grid grid-cols-1 gap-2">
                    {stage.rows.map(row => {
                      const code = `${col.key}${row}`;
                      return renderTile(code, PROFITX_MODULES[code]);
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop: row layout with stage label column */}
            <div className="hidden sm:grid grid-cols-[60px_1fr_1fr_1fr] gap-3">
              <div className="text-sm font-bold text-primary flex items-center py-1">
                {stage.label.split(' ')[0]}
              </div>
              <div className="col-span-3 grid grid-cols-3 gap-3">
                {stage.rows.flatMap(row =>
                  PROFITX_COLUMNS.map(col => {
                    const code = `${col.key}${row}`;
                    return renderTile(code, PROFITX_MODULES[code]);
                  })
                )}
              </div>
            </div>
          </div>
        );
      })}
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
  toggleModule: UseMutationResult<void, Error, { moduleId: string; current: boolean }>;
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
                    ? <CheckCircle2 className="w-5 h-5 text-success" />
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
                      module.tier === 'on-ramp' ? 'bg-blue-500/10 text-blue-600'
                      : module.tier === 'growth' ? 'bg-purple-500/10 text-primary'
                      : 'bg-orange-500/10 text-orange-600'
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

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

type Module = {
  id: string;
  name: string;
  tier: 'onramp' | 'growth' | 'scale';
  description: string;
  circleUrl: string;
};

type Pillar = {
  id: string;
  name: string;
  description: string;
  color: string;
  modules: Module[];
};

const PILLARS: Pillar[] = [
  {
    id: 'build',
    name: 'Build',
    description: 'The foundation of your retainer business — offer, delivery, finances, and systems.',
    color: '#AA44FF',
    modules: [
      { id: 'build-1', name: 'Design Your Retainer Offer + Delivery Roadmap', tier: 'onramp', description: "Build one clear, sellable retainer offer — what's included, what's not, what it costs. Then map out exactly how you deliver it week by week so clients know what's coming.", circleUrl: CIRCLE_PILLAR_URLS.build },
      { id: 'build-2', name: 'Client Onboarding & Strategy Sessions', tier: 'onramp', description: 'What happens the moment someone says yes. The onboarding call, strategy session structure, and how to set expectations that make clients stick around.', circleUrl: CIRCLE_PILLAR_URLS.build },
      { id: 'build-3', name: 'P&L and Margins', tier: 'growth', description: "Revenue vs cost per client, overheads, net profit per retainer. Know exactly what you're making after expenses — and what it costs you when you undercharge.", circleUrl: CIRCLE_PILLAR_URLS.build },
      { id: 'build-4', name: 'Upsell Architecture', tier: 'growth', description: 'Map your offer ladder. What else can you sell existing clients once trust is built? Ad management, events, photography, strategy days. Revenue per client grows without needing more clients.', circleUrl: CIRCLE_PILLAR_URLS.build },
      { id: 'build-5', name: 'SOP Library', tier: 'scale', description: 'Document everything before you delegate it. Editing brief, caption style, shoot checklist, client comms templates. Your SOP library is what lets someone else do your job.', circleUrl: CIRCLE_PILLAR_URLS.build },
      { id: 'build-6', name: 'Full Funnel Paid Ads', tier: 'scale', description: 'Graduate from the Simple Ad to a proper Meta funnel. Top of funnel (brand awareness), middle (case study retargeting), bottom (direct offer to warm audience). Full setup guide included.', circleUrl: CIRCLE_PILLAR_URLS.build },
    ],
  },
  {
    id: 'traffic',
    name: 'Traffic',
    description: 'Getting in front of the right people, consistently — organic, paid, and outreach.',
    color: '#6633ee',
    modules: [
      { id: 'traffic-1', name: 'Optimise Your Profile', tier: 'onramp', description: "Before ads, before outreach — your profile has to convert. Bio that says who you help and what result, highlights, pinned posts, link in bio. If your profile doesn't convert, everything else is wasted.", circleUrl: CIRCLE_PILLAR_URLS.traffic },
      { id: 'traffic-2', name: 'The Stupidly Simple Ad', tier: 'onramp', description: '$20/day for 5 days. One video, one static or carousel. Follow up by DM with everyone who engages. Prove the model before scaling. Full setup guide, targeting, and DM script included.', circleUrl: CIRCLE_PILLAR_URLS.traffic },
      { id: 'traffic-3', name: 'Warm Outreach', tier: 'onramp', description: "Message everyone you already know — past shoot clients, warm leads, people who've engaged with your content. Includes the past-client DM, warm reactivation script, and follow-up sequence.", circleUrl: CIRCLE_PILLAR_URLS.traffic },
      { id: 'traffic-4', name: 'The 5 Ps Content Framework', tier: 'growth', description: 'Problem → Plan → Proof → Philosophy → Proposition. Rotate through these to build trust and authority with your audience before you ever pitch. The system that turns followers into leads.', circleUrl: CIRCLE_PILLAR_URLS.traffic },
      { id: 'traffic-5', name: 'Story Sequences + Content Repurposing', tier: 'growth', description: "Build a story sequence that runs alongside your feed — this is where conversations actually happen. Plus: how to get more from every shoot. One job = multiple pieces of content.", circleUrl: CIRCLE_PILLAR_URLS.traffic },
      { id: 'traffic-6', name: 'Full Content Rhythm', tier: 'scale', description: '4 posts a week. 3 weeks of trust-building using the 5 Ps, 1 push week with direct offer. Planned a month ahead, batched in a day, consistent every week without scrambling.', circleUrl: CIRCLE_PILLAR_URLS.traffic },
    ],
  },
  {
    id: 'sales',
    name: 'Sales',
    description: 'Converting conversations into signed retainers — without being salesy.',
    color: '#9933dd',
    modules: [
      { id: 'sales-1', name: 'Proposal Doc + Meeting Flow', tier: 'onramp', description: "A proposal that converts — problem, solution, proof, clear next step. Plus the discovery call structure: what to ask, how to uncover pain, when to bring in proof, and how to close without pressure.", circleUrl: CIRCLE_PILLAR_URLS.sales },
      { id: 'sales-2', name: 'DM Scripts', tier: 'onramp', description: 'The full outreach sequence for DMs — opener, problem question, curiosity hook, booking ask. Includes voice note guidance, tonality principles, and what to say at each stage of the conversation.', circleUrl: CIRCLE_PILLAR_URLS.sales },
      { id: 'sales-3', name: 'Lead Tracking + CRM', tier: 'growth', description: "Start with a simple spreadsheet — every lead, their source, stage, and last follow-up. Then graduate to a CRM. Most deals are lost because of zero follow-up. This fixes that permanently.", circleUrl: CIRCLE_PILLAR_URLS.sales },
      { id: 'sales-4', name: 'Case Studies & Results', tier: 'growth', description: "Turn every client result into a sales asset. One-page case study format: situation before, what you did, the result. These replace persuasion — you show, not tell. Includes objection handling scripts.", circleUrl: CIRCLE_PILLAR_URLS.sales },
    ],
  },
  {
    id: 'scale',
    name: 'Scale',
    description: "Building a business that doesn't fully depend on you — team, systems, and leverage.",
    color: '#7722cc',
    modules: [
      { id: 'scale-1', name: 'First Hire + Delegation Mindset', tier: 'scale', description: "Editor, VA, or setter — who first and why the order matters. The mindset shift from doing everything to directing everything. What to delegate first and how to stop being the bottleneck.", circleUrl: CIRCLE_PILLAR_URLS.scale },
      { id: 'scale-2', name: 'Watching the P&L', tier: 'scale', description: "When you have a team, the numbers change. How to read your P&L with payroll in the mix, where margins get squeezed as you grow, and what levers to pull to protect profit while scaling.", circleUrl: CIRCLE_PILLAR_URLS.scale },
      { id: 'scale-3', name: 'Training Rhythm', tier: 'scale', description: "How to manage without micromanaging. Weekly check-ins, EOD reports, feedback loops, and KPIs for each role. The system that keeps your team performing without you being in everything.", circleUrl: CIRCLE_PILLAR_URLS.scale },
      { id: 'scale-4', name: 'Premium Client Experience', tier: 'scale', description: "At scale, your competitive advantage is experience as much as output. Monthly reporting, quarterly strategy reviews, proactive communication, and the client portal that makes them stay for years.", circleUrl: CIRCLE_PILLAR_URLS.scale },
    ],
  },
];

const TIER_ORDER = ['onramp', 'growth', 'scale'];

// Helper to extract module number from id like "build-3" → 3
function moduleNumber(id: string): number {
  return parseInt(id.split('-')[1], 10);
}

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

  const pillar = PILLARS.find((p) => p.id === activeTab)!;

  // Pillar tab colors as tailwind-compatible inline styles
  const pillarStyle = (p: Pillar, active: boolean) => active
    ? { backgroundColor: `${p.color}15`, borderColor: `${p.color}50`, color: p.color }
    : {};

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
          Open {pillar.name} in Circle <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>

      <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
        {PILLARS.map((p) => (
          <button
            key={p.id}
            onClick={() => setActiveTab(p.id)}
            style={pillarStyle(p, activeTab === p.id)}
            className={cn(
              'flex flex-col items-start px-4 py-3 rounded-xl border text-left shrink-0 transition-all',
              activeTab === p.id
                ? 'border-current'
                : 'bg-card border-border text-muted-foreground hover:text-foreground hover:bg-muted/50'
            )}
          >
            <span className="text-sm font-bold">{p.name}</span>
            <span className="text-xs opacity-70 mt-0.5 line-clamp-1 max-w-[160px]">{p.description}</span>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {pillar.modules.map((mod) => {
          const unlocked = isUnlocked(mod.tier);
          const n = moduleNumber(mod.id);
          const score = scores?.[`${pillar.id}-${n}`] ?? 'red';
          return (
            <div
              key={mod.id}
              className={cn(
                'bg-card border rounded-xl p-4 transition-all',
                unlocked ? 'border-border hover:border-primary/30' : 'border-border opacity-50'
              )}
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span
                    className="text-xs font-bold px-2 py-0.5 rounded-full uppercase tracking-wider"
                    style={{ backgroundColor: `${pillar.color}15`, color: pillar.color }}
                  >
                    {mod.tier}
                  </span>
                  <span className="text-xs text-muted-foreground">M{n}</span>
                </div>
                {unlocked && (
                  <div className="flex gap-1">
                    {['red', 'amber', 'green'].map((s) => (
                      <button
                        key={s}
                        onClick={() => updateScore.mutate({ pillar: pillar.id, module_number: n, score: s })}
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
                {mod.name}
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed mb-3">{mod.description}</p>
              {unlocked ? (
                <a
                  href={mod.circleUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-xs font-semibold transition-colors hover:opacity-80"
                  style={{ color: pillar.color }}
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

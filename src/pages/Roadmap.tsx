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
      { id: 'build-1', name: 'Design Your Retainer Offer', tier: 'onramp', description: "Build one clear, sellable offer. What's included, what's not, how it's packaged. One offer — not a menu.", circleUrl: CIRCLE_PILLAR_URLS.build },
      { id: 'build-2', name: 'Build Your Delivery Roadmap', tier: 'onramp', description: 'Step-by-step of how you deliver once someone signs. Shoot schedule, editing turnaround, approval process, posting. Makes it repeatable from day one.', circleUrl: CIRCLE_PILLAR_URLS.build },
      { id: 'build-3', name: 'Price It Right', tier: 'onramp', description: 'How to arrive at your retainer price. Cost of delivery, target margin, market positioning, and how to present the price without flinching.', circleUrl: CIRCLE_PILLAR_URLS.build },
      { id: 'build-4', name: 'Client Onboarding Process', tier: 'onramp', description: 'What happens the moment someone says yes. Welcome doc, onboarding call structure, first shoot brief. Make your first 30 days feel premium.', circleUrl: CIRCLE_PILLAR_URLS.build },
      { id: 'build-5', name: 'Build Your P&L Sheet', tier: 'growth', description: "Revenue vs cost per client, overheads, net profit. Understand your numbers so you know when you're actually making money vs staying busy.", circleUrl: CIRCLE_PILLAR_URLS.build },
      { id: 'build-6', name: 'Know Your Margins', tier: 'growth', description: 'What does it cost to deliver each retainer? At what point do you need to raise rates? The number most videographers never look at.', circleUrl: CIRCLE_PILLAR_URLS.build },
      { id: 'build-7', name: 'Upsell Architecture', tier: 'growth', description: 'What else can you offer existing clients once trust is built? Map your offer ladder so revenue per client grows without needing more clients.', circleUrl: CIRCLE_PILLAR_URLS.build },
      { id: 'build-8', name: 'When & How to Raise Your Rates', tier: 'growth', description: "The signals that tell you it's time, how to communicate it to existing clients, and how to position higher pricing to new ones.", circleUrl: CIRCLE_PILLAR_URLS.build },
      { id: 'build-9', name: 'SOP Library', tier: 'scale', description: 'Document everything before you delegate it. Editing brief, caption style, shoot checklist, client comms templates. What lets someone else do your job.', circleUrl: CIRCLE_PILLAR_URLS.build },
      { id: 'build-10', name: 'Full Funnel Paid Ads', tier: 'scale', description: 'Proper Meta funnel: top of funnel awareness, middle of funnel case study retargeting, bottom of funnel direct offer to warm audience.', circleUrl: CIRCLE_PILLAR_URLS.build },
      { id: 'build-11', name: 'Business Structure & Profit Targets', tier: 'scale', description: 'Are you set up properly? Company structure, tax efficiency basics, and revenue targets that work backwards from your life goals.', circleUrl: CIRCLE_PILLAR_URLS.build },
    ],
  },
  {
    id: 'traffic',
    name: 'Traffic',
    description: 'Getting in front of the right people, consistently — organic, paid, and outreach.',
    color: '#6633ee',
    modules: [
      { id: 'traffic-1', name: 'Optimise Your Profile First', tier: 'onramp', description: "Before ads, before outreach — your profile has to convert. Bio, link in bio, highlights, pinned posts. If your profile doesn't convert, everything else is wasted.", circleUrl: CIRCLE_PILLAR_URLS.traffic },
      { id: 'traffic-2', name: 'Simple Content: The 3 Starting Posts', tier: 'onramp', description: 'Behind-the-scenes of a shoot, a client collab post, and a portfolio/results post. Three content types you can create from existing work right now.', circleUrl: CIRCLE_PILLAR_URLS.traffic },
      { id: 'traffic-3', name: 'Warm Outreach', tier: 'onramp', description: 'Message everyone you already know. Past clients, warm leads, engaged followers. Includes the past-client DM, reactivation script, and follow-up process.', circleUrl: CIRCLE_PILLAR_URLS.traffic },
      { id: 'traffic-4', name: 'The Stupidly Simple Ad', tier: 'onramp', description: '$20/day for 5 days. One video, one static/carousel. The follow-up DM to everyone who engages. Prove the model before scaling.', circleUrl: CIRCLE_PILLAR_URLS.traffic },
      { id: 'traffic-5', name: 'The 5 Ps Content Framework', tier: 'growth', description: 'Problem → Plan → Proof → Philosophy → Proposition. Rotate through these to build trust and authority before you ever pitch.', circleUrl: CIRCLE_PILLAR_URLS.traffic },
      { id: 'traffic-6', name: 'Story Sequences', tier: 'growth', description: 'Why stories convert better than feed posts. Interactive polls, question boxes, direct CTAs. Build a story sequence that runs alongside your feed — where conversations actually happen.', circleUrl: CIRCLE_PILLAR_URLS.traffic },
      { id: 'traffic-7', name: 'Content Repurposing', tier: 'growth', description: 'One shoot = multiple pieces of content. Extract BTS clips, quotes, results, and portfolio moments from every client job. Stop creating from scratch every week.', circleUrl: CIRCLE_PILLAR_URLS.traffic },
      { id: 'traffic-8', name: 'Scale Your Simple Ads', tier: 'growth', description: 'Once the $20/day ad proves what works — increase budget and extend. Covers what to look for before scaling and how to read basic ad metrics.', circleUrl: CIRCLE_PILLAR_URLS.traffic },
      { id: 'traffic-9', name: 'The Full Content Rhythm', tier: 'scale', description: '4 posts a week. 3 weeks trust-building (Problem, Plan, Proof, Philosophy), 1 push week (direct offer). Planned a month ahead, batched, consistent.', circleUrl: CIRCLE_PILLAR_URLS.traffic },
      { id: 'traffic-10', name: 'Platform Expansion', tier: 'scale', description: 'Once Instagram is dialled in, extend to LinkedIn (higher-value B2B) or TikTok. Repurpose existing content rather than creating from scratch per platform.', circleUrl: CIRCLE_PILLAR_URLS.traffic },
      { id: 'traffic-11', name: 'Referral Systems & Strategic Partnerships', tier: 'scale', description: 'Build a referral network: agencies, web designers, marketers serving your same client. Inbound from trusted sources converts at 3–5x the rate of cold outreach.', circleUrl: CIRCLE_PILLAR_URLS.traffic },
    ],
  },
  {
    id: 'sales',
    name: 'Sales',
    description: 'Converting conversations into signed retainers — without being salesy.',
    color: '#9933dd',
    modules: [
      { id: 'sales-1', name: 'Build Your Proposal Doc', tier: 'onramp', description: 'A proposal that actually converts. Problem, solution, proof, clear next step. Not a price list — a document that makes saying yes easy.', circleUrl: CIRCLE_PILLAR_URLS.sales },
      { id: 'sales-2', name: 'Discovery Call Framework', tier: 'onramp', description: 'How to run a call that sells without feeling salesy. The questions to ask, how to uncover pain, when to bring in proof, and how to close for a next step.', circleUrl: CIRCLE_PILLAR_URLS.sales },
      { id: 'sales-3', name: 'Lead Tracking Sheet', tier: 'onramp', description: 'A simple spreadsheet to track every lead: source, stage, last follow-up. Most deals are lost because of zero follow-up. This fixes that.', circleUrl: CIRCLE_PILLAR_URLS.sales },
      { id: 'sales-4', name: 'Set Up Your Sales CRM', tier: 'growth', description: 'Graduate from the spreadsheet. Pipeline view, lead stages, follow-up reminders. Know exactly where every potential client is at any time.', circleUrl: CIRCLE_PILLAR_URLS.sales },
      { id: 'sales-5', name: 'DM Setting Scripts', tier: 'growth', description: 'The full outreach sequence — adapted for videography. Opener, problem question, curiosity hook, booking ask. Voice notes, tonality, and what to say at each stage.', circleUrl: CIRCLE_PILLAR_URLS.sales },
      { id: 'sales-6', name: 'Case Study Creation', tier: 'growth', description: 'Turn every client result into a sales asset. One-page case study: situation before, what you did, the result. These replace persuasion — you show, not tell.', circleUrl: CIRCLE_PILLAR_URLS.sales },
      { id: 'sales-7', name: 'Objection Handling', tier: 'growth', description: "The 4 layers: fear, time, money, belief. Scripts for \"let me think about it,\" \"I can't afford it,\" and \"I'm not sure video will work for my business.\"", circleUrl: CIRCLE_PILLAR_URLS.sales },
      { id: 'sales-8', name: 'Automate Your Follow-Up', tier: 'scale', description: 'Calendly, automated reminder emails, CRM sequences for leads that go cold. No lead falls through the cracks without a system touching them.', circleUrl: CIRCLE_PILLAR_URLS.sales },
      { id: 'sales-9', name: 'Cross-Sell to Existing Clients', tier: 'scale', description: 'Your existing clients are your best source of additional revenue. How to identify upsell opportunities and introduce new services without being pushy.', circleUrl: CIRCLE_PILLAR_URLS.sales },
      { id: 'sales-10', name: 'Train a Setter', tier: 'scale', description: "If you're at capacity with sales conversations, bring someone in to do initial outreach and booking. Who to hire, how to train them, what to pay, how to manage.", circleUrl: CIRCLE_PILLAR_URLS.sales },
    ],
  },
  {
    id: 'scale',
    name: 'Scale',
    description: "Building a business that doesn't fully depend on you — team, systems, and advanced growth.",
    color: '#7722cc',
    modules: [
      { id: 'scale-1', name: 'Your First Hire', tier: 'onramp', description: 'Editor, VA, or setter — who first and why. What to delegate first, where to find good people, and what to pay. The order matters.', circleUrl: CIRCLE_PILLAR_URLS.scale },
      { id: 'scale-2', name: 'Delegation Framework', tier: 'onramp', description: "Audit your week and categorise every task: Do, Delegate, Defer, Delete. Anything that isn't client relationships or sales strategy is a delegation candidate.", circleUrl: CIRCLE_PILLAR_URLS.scale },
      { id: 'scale-3', name: 'Onboarding Your First Team Member', tier: 'onramp', description: "How to onboard a hire without it taking more time than doing it yourself. Loom walkthroughs, SOPs, structured first 2 weeks. Independent within 30 days.", circleUrl: CIRCLE_PILLAR_URLS.scale },
      { id: 'scale-4', name: 'Training Rhythm', tier: 'growth', description: 'Weekly check-ins, EOD reports, feedback loops. How to manage without micromanaging. What KPIs to track for each role and how to give useful feedback.', circleUrl: CIRCLE_PILLAR_URLS.scale },
      { id: 'scale-5', name: 'Quality Control System', tier: 'growth', description: 'Review checkpoints, client-facing approval steps, revision limits. The systems that protect your reputation as you grow and others do the work.', circleUrl: CIRCLE_PILLAR_URLS.scale },
      { id: 'scale-6', name: 'KPI Dashboard', tier: 'growth', description: 'Track what actually matters: MRR, retention rate, leads in, calls booked, close rate, content consistency, team output. Business health in 60 seconds.', circleUrl: CIRCLE_PILLAR_URLS.scale },
      { id: 'scale-7', name: 'The Agency Model', tier: 'scale', description: 'Transitioning from solo operator to team-based delivery. How your role changes, how to restructure your offer for a team, and how to maintain margins when payroll goes up.', circleUrl: CIRCLE_PILLAR_URLS.scale },
      { id: 'scale-8', name: 'Incentive Structures', tier: 'scale', description: "How to retain great team members. Performance bonuses, profit sharing basics, progression pathways. People who feel like they're building something stay.", circleUrl: CIRCLE_PILLAR_URLS.scale },
      { id: 'scale-9', name: 'The Premium Client Experience', tier: 'scale', description: 'At scale, your advantage is experience as much as output. Client portal, monthly reporting, quarterly strategy reviews. What makes clients stay for years, not months.', circleUrl: CIRCLE_PILLAR_URLS.scale },
      { id: 'scale-10', name: 'Referral Partner Network', tier: 'scale', description: 'Formal partnerships with agencies and consultants serving your same client. A referral agreement, a brief they can use to describe you, and a system for staying front of mind.', circleUrl: CIRCLE_PILLAR_URLS.scale },
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

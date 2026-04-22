import { useState } from 'react';
import { Check, Copy, ChevronDown, ChevronUp, Zap, Lock, ExternalLink } from 'lucide-react';
import { useCashMenu } from '@/hooks/useCashMenu';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import PageLayout from '@/components/PageLayout';
import { usePageTracking } from '@/hooks/usePageTracking';
import { ModuleContentDialog } from '@/components/ModuleContentView';

const ACTIONS = [
  {
    key: 'past_clients',
    emoji: '📬',
    label: 'Message Every Past Client',
    subtitle: "Text or email every client you've done a one-off shoot for. Notify them of the new system you've built — positioned around making them an authority and helping them attract new business. If they want more info, you're happy to give them a buzz or send the info doc through.",
    effort: '30 min – 1 hr',
    expectedResult: '1–3 replies for info doc',
    scripts: [
      {
        channel: 'Text (SMS)',
        body: `Hey [Name], it's [Your Name]. Quick one — I've built a new system for businesses like yours, designed to position you as the authority in your space and bring in real new business off the back of it.

Thought of you straight away. Happy to give you a quick buzz or flick the info doc through if you want to take a look?`,
      },
      {
        channel: 'Email',
        body: `Subject: New thing I've built — thought of you

Hey [Name],

Hope you're well. I've built out a new system off the back of the work I've been doing — it's designed to position you as the authority in your space and actually bring in new business, not just content for the sake of it.

Thought of you straight away. Happy to jump on a quick call or send the info doc through if you'd like a look.

Let me know,
[Your Name]`,
      },
    ],
    tips: [
      "Keep it casual — you already have the relationship, don't pitch like a stranger.",
      'Send to every past one-off client. Even 1–2 info doc replies turns into real conversations.',
    ],
  },
  {
    key: 'warm_reactivation',
    emoji: '🔥',
    label: 'Warm Reactivation',
    subtitle: 'Reach out to every lead who showed interest in the last 6 months but never converted.',
    effort: '45 mins',
    expectedResult: '1–2 replies for info doc',
    scripts: [
      {
        channel: 'Text / DM (attach a short-form video that suits them)',
        body: `Hey [Name], hope you're well. Saw this video the other day — [attach video] — and thought something like this would be sick for you to do. Reckon it'd do really well.

I've also built out a new program off the back of the work I've been doing — designed to position you as the authority in your space and bring in real new business. If you want some info on it, let me know and I'll send the doc through.`,
      },
    ],
    tips: [
      'Pick a video that genuinely fits their business — the personalisation is the whole point.',
      'Pull out your old DMs and make a list before you start. Aim for 15–20 reactivations.',
    ],
    followUp: {
      title: 'Follow-up procedure',
      steps: [
        "If no reply after 2 days — call them. A quick phone call cuts through every time and shows you actually care, not just blasting messages.",
        "Keep the call casual: reference the video you sent, ask how things are going, then offer to send the info doc through.",
      ],
    },
  },
  {
    key: 'push_week',
    emoji: '📣',
    label: 'Push Week on Socials',
    subtitle: "Only run this if you've been consistent with content for 4+ weeks (2–3 posts a week, mix of awareness and trust content). We need eyeballs on the page before we try to harvest them.",
    effort: '5 days of posting',
    expectedResult: '1–2 inbound DMs or messages',
    warning: "Only run this if you've been posting consistently. A push week with a dead feed won't work.",
    scripts: [
      {
        channel: 'Day 1 — The Problem Post',
        body: `Most [niche] businesses don't know how to use social media to actually generate revenue.

The problem isn't that they aren't being seen. The problem is there's no real strategy behind their content, socials, or ads — nothing that ties back to driving real business results.

Posting random content and boosting the odd post isn't a strategy. It's noise.

[CTA: If this is hitting a nerve, drop me a DM — happy to show you what an actual system looks like.]`,
      },
      {
        channel: 'Day 2 — Client Result / Proof',
        body: `[Client name] came to me with basically no digital presence — no content strategy, no social system, just posting randomly when they remembered.

The problem wasn't effort. It was that they had no system tying content, socials and ads back to actual business results.

We installed [your unique mechanism / system name] and now they've got a proper digital strategy running — consistent content, a funnel that works, and real enquiries coming in weekly.

If you want the info on how we did it — DM me "[KEYWORD]" and I'll send it through.`,
      },
      {
        channel: 'Day 3 — The Education Post',
        body: `Most [niche] businesses don't know how to turn social media into actual revenue.

And honestly — they shouldn't have to. You don't need to learn how to do it yourself. You need someone who already has the answer and can install it for you.

That's the whole point of bringing someone in. You stay in your lane running the business. We handle the system that brings the new business in.

[CTA: DM me "[KEYWORD]" if you want to see how we do it.]`,
      },
      {
        channel: 'Day 4 — Behind the Scenes / Authority',
        body: `Here's what a shoot day looks like with one of my retainer clients.

[Video/photo of shoot setup, editing, or on-location content creation]

They get [X] videos per month, [X] posts per week, and we run a simple ad on top to amplify what's already working organically.

This is a system. Not random content. A system.

[CTA: One spot left this month. DM me if you want in.]`,
      },
      {
        channel: 'Day 5 — The Direct Offer Post (drop the hammer)',
        body: `Alright — being straight with you.

I've got [X] spots left this month for businesses who want the unique system we've built installed for them.

You get: monthly filming, short-form editing, a proper social strategy, and a simple paid ad running alongside it. All built around driving real enquiries, not just views.

If you're a [niche] business that's actually serious about making content work — DM me or drop a comment and we'll have a chat.

→ Pair this post with a direct piece-to-camera video.
→ Roll out a story sequence the same day — use the framework in the Story Sequence button below.
→ This is the day you drop the hammer after a week of warming the room up.`,
      },
    ],
    tips: [
      "Post once per day for 5 days. Don't overthink it — use these scripts as a direct starting point.",
      'Stories matter. Post a "behind the scenes" or a question box on stories each day too.',
      'The goal of push week is inbound DMs, not likes. Track every conversation that comes in.',
    ],
  },
  {
    key: 'simple_ad',
    emoji: '💸',
    label: 'The Stupidly Simple Ad',
    subtitle: 'A simple paid ad system to put your offer in front of warm strangers and start conversations.',
    effort: '1 hour to set up, 5 days to run',
    expectedResult: '2–5 warm engagements, 1–3 conversations',
    opensModule: 'stupidly-simple-ad',
    scripts: [],
    tips: [],
  },
];

export default function CashMenu() {
  const { completed, markDone } = useCashMenu();
  usePageTracking('cash-menu');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [moduleModal, setModuleModal] = useState<string | null>(null);

  const { data: profile } = useQuery({
    queryKey: ['profile-tier'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const { data } = await supabase
        .from('profiles')
        .select('tier')
        .eq('id', user!.id)
        .single();
      return data;
    },
  });

  const isUnlocked = profile?.tier && profile.tier !== 'onramp';

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const toggle = (key: string) => setExpanded(exp => exp === key ? null : key);

  if (!isUnlocked) {
    return (
      <PageLayout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center px-4">
          <Lock className="w-10 h-10 text-primary" />
          <h1 className="text-2xl font-bold italic text-foreground">Cash Menu</h1>
          <p className="text-muted-foreground max-w-sm">
            The Cash Menu unlocks once you've completed your Onramp. Finish your first roadmap pillar to get access.
          </p>
        </div>
      </PageLayout>
    );
  }

  const completedCount = completed.length;

  return (
    <PageLayout>
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Header */}
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-primary" />
            <span className="text-xs font-medium text-primary uppercase tracking-wider">Cash Menu</span>
          </div>
          <h1 className="text-3xl font-bold italic text-foreground">Put Cash in the Bank</h1>
          <p className="text-muted-foreground text-sm">
            4 proven moves to book calls and sign retainers fast — right after you complete your Onramp.
            Each one has a copy-paste script ready to go.
          </p>
        </div>

        {/* Progress */}
        <div className="bg-card border border-border rounded-xl p-4 flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Moves completed</p>
            <p className="text-2xl font-bold text-foreground">{completedCount} <span className="text-muted-foreground text-base font-normal">/ 4</span></p>
          </div>
          <div className="flex gap-2">
            {ACTIONS.map(a => (
              <div
                key={a.key}
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm
                  ${completed.includes(a.key)
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground'
                  }`}
              >
                {completed.includes(a.key) ? <Check className="w-4 h-4" /> : a.emoji}
              </div>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="space-y-3">
          {ACTIONS.map((action) => {
            const isDone = completed.includes(action.key);
            const isOpen = expanded === action.key;

            return (
              <div
                key={action.key}
                className={`border rounded-xl overflow-hidden transition-all
                  ${isDone ? 'border-primary/40 bg-primary/5' : 'border-border bg-card'}`}
              >
                <button
                  onClick={() => {
                    if ((action as any).opensModule) {
                      setModuleModal((action as any).opensModule);
                    } else {
                      toggle(action.key);
                    }
                  }}
                  className="w-full flex items-start justify-between p-5 text-left gap-4"
                >
                  <div className="flex items-start gap-3">
                    <span className="text-2xl mt-0.5">{action.emoji}</span>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className={`font-bold italic text-lg ${isDone ? 'text-primary' : 'text-foreground'}`}>
                          {action.label}
                        </h3>
                        {isDone && (
                          <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full">Done</span>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mt-0.5">{action.subtitle}</p>
                      <div className="flex gap-4 mt-2">
                        <span className="text-xs text-muted-foreground">⏱ {action.effort}</span>
                        <span className="text-xs text-primary">🎯 {action.expectedResult}</span>
                      </div>
                    </div>
                  </div>
                  {(action as any).opensModule ? (
                    <ExternalLink className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-1" />
                  ) : isOpen ? (
                    <ChevronUp className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-1" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-1" />
                  )}
                </button>

                {isOpen && !(action as any).opensModule && (
                  <div className="border-t border-border p-5 space-y-6">
                    {action.warning && (
                      <div className="bg-warning/10 border border-warning/30 rounded-lg p-3 text-sm text-warning">
                        ⚠️ {action.warning}
                      </div>
                    )}

                    <div className="space-y-4">
                      <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Scripts</h4>
                      <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 text-xs text-muted-foreground italic">
                        Heads up — these are just base scripts. Make sure you rewrite them so they're personal to who you're sending it to, your relationship with them, and your own tone of voice.
                      </div>
                      {action.scripts.map((script, i) => (
                        <div key={i} className="bg-background rounded-lg overflow-hidden border border-border">
                          <div className="flex items-center justify-between px-4 py-2 border-b border-border">
                            <span className="text-xs font-medium text-primary">{script.channel}</span>
                            <button
                              onClick={() => handleCopy(script.body, `${action.key}-${i}`)}
                              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                            >
                              {copied === `${action.key}-${i}` ? (
                                <><Check className="w-3 h-3 text-emerald-400" /><span className="text-emerald-400">Copied!</span></>
                              ) : (
                                <><Copy className="w-3 h-3" />Copy</>
                              )}
                            </button>
                          </div>
                          <pre className="p-4 text-sm text-muted-foreground whitespace-pre-wrap font-sans leading-relaxed">
                            {script.body}
                          </pre>
                        </div>
                      ))}
                    </div>

                    {action.key === 'push_week' && (
                      <a
                        href="https://messy-arrow-f59.notion.site/Story-Sequence-Strategy-4f4bdcf32ce48226812f81073b03de51"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2.5 rounded-lg text-sm font-medium transition-colors"
                      >
                        📖 Open Story Sequence Framework
                      </a>
                    )}

                    {(action as any).roadmapLink && (
                      <a
                        href={`/module/${(action as any).roadmapLink.pillar}/${(action as any).roadmapLink.moduleId}`}
                        className="inline-flex items-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2.5 rounded-lg text-sm font-medium transition-colors"
                      >
                        🗺️ Open {(action as any).roadmapLink.label} Module
                      </a>
                    )}

                    <div className="space-y-2">
                      <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Tips</h4>
                      <ul className="space-y-1.5">
                        {action.tips.map((tip, i) => (
                          <li key={i} className="flex gap-2 text-sm text-muted-foreground">
                            <span className="text-primary flex-shrink-0">→</span>
                            <span>{tip}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {(action as any).followUp && (
                      <div className="space-y-2 bg-background/50 border border-border rounded-lg p-4">
                        <h4 className="text-xs font-medium text-primary uppercase tracking-wider">📞 {(action as any).followUp.title}</h4>
                        <ul className="space-y-1.5">
                          {(action as any).followUp.steps.map((step: string, i: number) => (
                            <li key={i} className="flex gap-2 text-sm text-muted-foreground">
                              <span className="text-primary flex-shrink-0">{i + 1}.</span>
                              <span>{step}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <button
                      onClick={() => markDone(action.key)}
                      disabled={isDone}
                      className={`w-full py-3 rounded-lg font-semibold text-sm transition-all
                        ${isDone
                          ? 'bg-primary/20 text-primary cursor-default'
                          : 'bg-primary hover:bg-primary/90 text-primary-foreground cursor-pointer'
                        }`}
                    >
                      {isDone ? '✓ Marked as done' : 'Mark as done'}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {completedCount === 4 && (
          <div className="bg-gradient-to-r from-primary/20 to-primary/10 border border-primary/30 rounded-xl p-6 text-center space-y-2">
            <p className="text-2xl">🎉</p>
            <h3 className="text-foreground font-bold italic text-xl">You've run all 4 moves.</h3>
            <p className="text-muted-foreground text-sm">Now it's about consistency. Head back to your Roadmap and keep pushing your scores green.</p>
          </div>
        )}
      </div>
    </PageLayout>
  );
}

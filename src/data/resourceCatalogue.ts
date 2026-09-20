/**
 * What Dan can point a client at: the recorded sessions in the Vault and the
 * modules on the Roadmap.
 *
 * Sent with each Ask Dan question so answers can end with "watch X in the
 * Vault" rather than leaving the client to go hunting.
 *
 * Kept in step with Vault.tsx and Roadmap.tsx by hand — add new entries here
 * when you add them there.
 */

export type VaultResource = {
  title: string;
  category: string;
  date?: string | null;
};

export type RoadmapResource = {
  id: string;
  name: string;
  desc: string;
  tier: string;
};

export const VAULT_RESOURCES: VaultResource[] = [
  {
    "title": "Momentum Call - Setting Up Lead Generation Ads, Ad Creatives etc...",
    "category": "Momentum Call",
    "date": "Sep 15"
  },
  {
    "title": "Momentum Call",
    "category": "Momentum Call",
    "date": "Aug 31"
  },
  {
    "title": "Momentum Call - Editing Team Building",
    "category": "Momentum Call",
    "date": null
  },
  {
    "title": "Momentum Call - Agreements, Paid Ads, Hiring Editors",
    "category": "Momentum Call",
    "date": null
  },
  {
    "title": "Momentum Call - Paid Ads Help",
    "category": "Momentum Call",
    "date": null
  },
  {
    "title": "Hot Seat \u2014 Elijah Arnold (Director @ Social Lab)",
    "category": "Hot Seat",
    "date": "Jul 8"
  },
  {
    "title": "Momentum Call \u2014 Team Building, Hiring, Accountability & Expectations",
    "category": "Momentum Call",
    "date": null
  },
  {
    "title": "Momentum Call \u2014 Paid Ads, Ad Creatives & Metrics",
    "category": "Momentum Call",
    "date": "Jun 23"
  },
  {
    "title": "Q&A \u2014 June 10th",
    "category": "Q&A",
    "date": "Jun 10"
  },
  {
    "title": "Workshop \u2014 Pay To Play\u2122",
    "category": "Workshop",
    "date": "Jul 22"
  },
  {
    "title": "Workshop \u2014 Paid Ad Powerup\u2122",
    "category": "Workshop",
    "date": "Aug 5"
  },
  {
    "title": "Workshop \u2014 Organic Content Snowball\u2122",
    "category": "Workshop",
    "date": "Aug 19"
  },
  {
    "title": "Workshop \u2014 Delivery Magic\u2122",
    "category": "Workshop",
    "date": "Sep 16"
  },
  {
    "title": "Workshop \u2014 Spring Planning\u2122 + Editing Flow",
    "category": "Workshop",
    "date": "Sep 2"
  },
  {
    "title": "Workshop \u2014 Smooth Operator\u2122",
    "category": "Workshop",
    "date": null
  },
  {
    "title": "Workshop \u2014 Profit By Design\u2122",
    "category": "Workshop",
    "date": "May 27"
  },
  {
    "title": "Q&A \u2014 May 13th",
    "category": "Q&A",
    "date": "May 13"
  },
  {
    "title": "Lesson \u2014 Paid Advertising (Meta Ads)",
    "category": "Lesson",
    "date": null
  },
  {
    "title": "Q&A \u2014 April 14th",
    "category": "Q&A",
    "date": "Apr 14"
  },
  {
    "title": "Lesson \u2014 Organic Content Flow",
    "category": "Lesson",
    "date": null
  },
  {
    "title": "Q&A \u2014 March 18th",
    "category": "Q&A",
    "date": "Mar 18"
  }
];

export const ROADMAP_RESOURCES: RoadmapResource[] = [
  {
    "id": "design-retainer-offer",
    "name": "Design Retainer Offer",
    "desc": "Package your offer, set pricing, and map out exactly what clients get.",
    "tier": "on-ramp"
  },
  {
    "id": "delivery-roadmap",
    "name": "Delivery Roadmap",
    "desc": "Build a step-by-step operating system for delivering your retainer from sign to published post.",
    "tier": "on-ramp"
  },
  {
    "id": "client-onboarding",
    "name": "Client Onboarding & Strategy Sessions",
    "desc": "Build a repeatable onboarding flow that sets expectations from day one.",
    "tier": "on-ramp"
  },
  {
    "id": "pl-margins",
    "name": "P&L and Margins",
    "desc": "Understand your numbers \u2014 what you keep after costs.",
    "tier": "growth"
  },
  {
    "id": "upsell-architecture",
    "name": "Value Ladder",
    "desc": "Create logical next steps so clients naturally spend more.",
    "tier": "growth"
  },
  {
    "id": "sop-library",
    "name": "SOP Library",
    "desc": "Document every process so your business runs without you.",
    "tier": "scale"
  },
  {
    "id": "optimise-profile",
    "name": "Optimise Your Profile",
    "desc": "Turn your IG/LinkedIn into a lead generation machine.",
    "tier": "on-ramp"
  },
  {
    "id": "stupidly-simple-ad",
    "name": "Stupidly Simple Ad",
    "desc": "$20/day for 5 days \u2014 the fastest way to get warm leads in.",
    "tier": "on-ramp"
  },
  {
    "id": "warm-outreach",
    "name": "Warm Outreach",
    "desc": "DM scripts and sequences to reactivate your existing network.",
    "tier": "on-ramp"
  },
  {
    "id": "5ps-framework",
    "name": "5 Ps Framework",
    "desc": "A content framework that positions you as the go-to expert.",
    "tier": "growth"
  },
  {
    "id": "full-funnel-paid-ads",
    "name": "Full Funnel Paid Ads",
    "desc": "Run ads that bring in qualified leads at scale.",
    "tier": "scale"
  },
  {
    "id": "proposal-doc",
    "name": "Proposal Doc",
    "desc": "Build a proposal doc that does the selling for you, sent before the meeting and used during it.",
    "tier": "on-ramp"
  },
  {
    "id": "sales-meeting-flow",
    "name": "Sales Meeting Flow",
    "desc": "Walk into every sales meeting with conviction, diagnose what the client needs, and close.",
    "tier": "on-ramp"
  },
  {
    "id": "your-offer-suite",
    "name": "Your Offer Suite",
    "desc": "Design a clear suite of offers \u2014 entry, core, and premium \u2014 so every prospect has a logical next step.",
    "tier": "growth"
  },
  {
    "id": "hire-first-editor",
    "name": "Hire Your First Editor",
    "desc": "Remove yourself from production without losing quality.",
    "tier": "growth"
  },
  {
    "id": "lean-org-chart",
    "name": "Your Lean Organisation Chart",
    "desc": "Map the roles your business needs to run lean and scale without bloat.",
    "tier": "scale"
  },
  {
    "id": "client-retention",
    "name": "Client Retention",
    "desc": "Keep clients longer with proactive communication, results reporting, and renewals.",
    "tier": "scale"
  },
  {
    "id": "leadership-staff-management",
    "name": "Leadership & Staff Management",
    "desc": "Lead your team with clarity \u2014 set standards, run reviews, and build a culture that performs.",
    "tier": "scale"
  },
  {
    "id": "financial-mastery",
    "name": "Financial Mastery",
    "desc": "Build a business that runs on clear financial systems.",
    "tier": "scale"
  }
];

/** A compact list for the model to choose from. */
export function resourceCatalogue(): string {
  const vault = VAULT_RESOURCES.map(
    r => `Vault · ${r.category} · ${r.title}${r.date ? ` (${r.date})` : ''}`,
  );
  const roadmap = ROADMAP_RESOURCES.map(
    r => `Roadmap · ${r.tier} · ${r.name} — ${r.desc}`,
  );
  return [...vault, ...roadmap].join('\n');
}

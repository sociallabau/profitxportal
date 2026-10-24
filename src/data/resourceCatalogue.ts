import { VAULT_ITEMS, driveId, fathomToken, notionPage } from './vault';

/**
 * What Dan can point a member at: the recorded sessions in the Vault and the
 * modules on the Roadmap.
 *
 * Sent with each Ask Dan question so answers can end with a link to the
 * session that covers it, rather than leaving the member to go hunting.
 *
 * Vault entries come from src/data/vault.ts. Roadmap entries are kept in step
 * with Roadmap.tsx by hand.
 */

export type RoadmapResource = {
  id: string;
  name: string;
  desc: string;
  tier: string;
};

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
    "name": "Profile Visit Ads",
    "desc": "$50 profile-visit boost behind each post at Gate 1, then an always-on awareness campaign from Gate 2.",
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

const vaultLine = (r: { category: string; title: string; date?: string | null }) =>
  `Vault · ${r.category} · ${r.title}${r.date ? ` (${r.date})` : ''}`;

/** A compact list for the model to choose from. */
export function resourceCatalogue(): string {
  const vault = VAULT_ITEMS.map(vaultLine);
  const roadmap = ROADMAP_RESOURCES.map(
    r => `Roadmap · ${r.tier} · ${r.name} — ${r.desc}`,
  );
  return [...vault, ...roadmap].join('\n');
}

/**
 * Drive id -> catalogue line for every file behind a Vault entry (recording,
 * notes/transcript doc, workbook), so Dan AI can tie any of them back to the session.
 */
export function vaultSources(): Record<string, string> {
  return Object.fromEntries(VAULT_ITEMS.flatMap(r =>
    [
      ...[r.url, r.transcriptUrl, r.workbookUrl].map(driveId),
      fathomToken(r.url),
      ...[r.workbookUrl].map(u => { const n = notionPage(u); return n ? `notion-${n.id}` : null; }),
    ].filter((id): id is string => !!id).map(id => [id, vaultLine(r)])));
}

/** Where a resource line Dan AI picked should take the member. */
export function resourceLink(line: string): { title: string; href: string | null; external: boolean; extras: { label: string; url: string }[] } {
  const item = VAULT_ITEMS.find(r => vaultLine(r) === line);
  if (item) {
    const extras = [
      ...(item.workbookUrl ? [{ label: item.workbookLabel ?? 'Workbook', url: item.workbookUrl }] : []),
      ...(item.templates ?? []),
    ];
    return { title: item.title, href: item.url ?? '/vault', external: !!item.url, extras };
  }
  const module = ROADMAP_RESOURCES.find(r => line.startsWith(`Roadmap · ${r.tier} · ${r.name} — `));
  if (module) return { title: module.name, href: '/roadmap', external: false, extras: [] };
  return { title: line.split(' · ').pop() ?? line, href: null, external: false, extras: [] };
}

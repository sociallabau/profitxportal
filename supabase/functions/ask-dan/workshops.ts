/**
 * What each Vault recording fixes, written from Dan's Drive notes for the
 * sessions. Dan AI uses it to prescribe the workshop for a member's real
 * problem, not just the one whose transcript happened to match the wording.
 * Keys match a piece of the Vault title; plain Q&As and general Momentum
 * Calls are left out because they cover everything and fix nothing in particular.
 */

export type WorkshopGuide = { key: string; fixes: string; keywords: string[] };

export const WORKSHOP_GUIDE: WorkshopGuide[] = [
  { key: "Ad Metrics & Tracking 101", fixes: "not knowing if ads work: tracking every lead, cost per lead, cost per booked call and cost per client, CTR, the lead tracker template, monthly ad check day",
    keywords: ["metric", "tracking", "track", "cost per lead", "cost per client", "ctr", "lead tracker", "numbers", "report", "cpl", "attribution", "know if", "working"] },
  { key: "Pay To Play", fixes: "starting ads for themselves and for clients: profile-visit boosts, awareness, lead gen setup, ad spend on top of the fee through the client's ad account, reporting ads to clients",
    keywords: ["ads", "ad spend", "boost", "awareness", "lead gen", "profile visit", "client ads", "meta", "budget", "start ads", "facebook", "instagram ads"] },
  { key: "Paid Ad Powerup", fixes: "ads running but underperforming: creatives built for the audience, 3–5 variations in the same campaign, ad scripts, scaling only when cost per client is under half the first month's fee, lead magnets",
    keywords: ["creative", "ctr", "scale", "scaling", "script", "variation", "lead magnet", "not working", "expensive leads", "kill", "underperform", "hook"] },
  { key: "Organic Content Snowball", fixes: "inconsistent or low-performing posting on their own account: BTS and case-study content, hooks, a posting rhythm that starts conversations",
    keywords: ["post", "content", "hook", "bts", "behind the scenes", "organic", "consistent", "reel", "followers", "views", "own account", "engagement", "what to post"] },
  { key: "The System", fixes: "leads slipping through: one system for every lead and conversation, speed to lead (call within 15–30 mins), follow-ups, the Hot List, booking calls",
    keywords: ["follow up", "follow-up", "speed to lead", "hot list", "crm", "pipeline", "leads", "no calls", "booking", "system", "conversations", "dm", "ghost"] },
  { key: "Delivery Magic", fixes: "clients churning or delivery feeling chaotic: the first 90 days, proactive check-ins, a client hub for approvals, reporting at 3/6/12 months",
    keywords: ["churn", "retention", "lost a client", "clients leaving", "delivery", "approval", "client hub", "notion", "report", "communication", "unresponsive", "keep clients"] },
  { key: "Smooth Operator", fixes: "an amateur-feeling client experience: premium onboarding, agreements, strategy sessions and 3-month strategy reviews",
    keywords: ["onboarding", "agreement", "contract", "strategy session", "review", "professional", "welcome", "expectations", "scope"] },
  { key: "Spring Planning", fixes: "no content plan and slow editing: planning shoots and content ahead, batching, an editing flow that hits turnaround",
    keywords: ["plan", "planning", "calendar", "editing", "edit", "turnaround", "batch", "workflow", "shoot day", "behind"] },
  { key: "Profit By Design", fixes: "busy but not profitable: pricing and tiers, margins, owner pay, raising prices on new clients first",
    keywords: ["price", "pricing", "margin", "profit", "package", "tier", "underpriced", "expenses", "raise", "charge", "discount", "cash flow", "pay myself"] },
  { key: "Lesson — Paid Advertising", fixes: "Meta Ads Manager basics: setting up campaigns, audiences and the account from scratch",
    keywords: ["ads manager", "set up", "setup", "pixel", "business manager", "first campaign", "audience", "how do i run"] },
  { key: "Lesson — Organic Content Flow", fixes: "the basics of an organic traffic engine: what to post and how often to get seen",
    keywords: ["organic", "traffic", "content flow", "how often", "what to post"] },
  { key: "Setting Up Lead Generation Ads", fixes: "building a lead gen campaign: forms, qualifying questions, ad creatives",
    keywords: ["lead gen", "lead form", "instant form", "qualifying", "lead campaign", "landing page"] },
  { key: "Editing Team Building", fixes: "doing all the editing themselves: finding, testing and managing editors",
    keywords: ["editor", "hire", "hiring", "outsource", "delegate", "team", "overwhelm", "capacity", "too busy"] },
  { key: "Team Building, Hiring, Accountability", fixes: "a team that needs managing: hiring, expectations and accountability",
    keywords: ["team", "staff", "hire", "accountability", "expectations", "manage", "employee"] },
  { key: "Agreements, Paid Ads, Hiring Editors", fixes: "client agreements plus first editor hires",
    keywords: ["agreement", "contract", "editor", "hire"] },
  { key: "Colby Shaw", fixes: "a real example of scaling lead gen: $3k over 19 days for 70 leads and 12 clients, quarterly packages, landing pages",
    keywords: ["scale", "lead gen", "quarterly", "landing page", "case study", "example"] },
  { key: "Elijah Arnold", fixes: "running an agency team: director-level operations and delegation",
    keywords: ["agency", "director", "operations", "delegate", "team"] },
];

const norm = (s: string) => s.toLowerCase().replace(/[™®]/g, "");

/** The guide entry for a catalogue line, or null. */
export const guideFor = (line: string) => WORKSHOP_GUIDE.find(g => norm(line).includes(norm(g.key))) ?? null;

/** "line → what it fixes", for the catalogue lines that have a guide. */
export function workshopGuideText(catalogueLines: string[]): string {
  return catalogueLines.filter(l => l.startsWith("Vault · ")).flatMap(l => {
    const g = guideFor(l);
    return g ? [`- ${l} → fixes ${g.fixes}`] : [];
  }).join("\n");
}

/** The Vault recording whose guide best matches the problem text, or null if nothing clearly fits. */
export function prescribe(problem: string, catalogueLines: string[]): string | null {
  const text = ` ${norm(problem)} `;
  let best: { line: string; score: number } | null = null;
  for (const line of catalogueLines) {
    if (!line.startsWith("Vault · ")) continue;
    const g = guideFor(line);
    if (!g) continue;
    const hits = g.keywords.filter(k => text.includes(norm(k))).length;
    const score = hits * (/^Vault · (Workshop|Lesson) ·/.test(line) ? 1.25 : 1);
    if (hits >= 2 && (!best || score > best.score)) best = { line, score };
  }
  return best?.line ?? null;
}

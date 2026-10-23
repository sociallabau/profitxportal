export type Rating = 'red' | 'amber' | 'green';
export type Pillar = 'offer' | 'clients' | 'delivery';

export interface AuditQuestion { code: string; pillar: Pillar; stage: 'launchpad' | 'scale'; text: string }

export const AUDIT_QUESTIONS: AuditQuestion[] = [
  { code: 'O1', pillar: 'offer', stage: 'launchpad', text: 'I know exactly who I serve and my message speaks directly to them — clients get it immediately.' },
  { code: 'O2', pillar: 'offer', stage: 'launchpad', text: "I have a retainer offer I'm proud of — it's clear, valuable, and easy to explain in one sentence." },
  { code: 'O3', pillar: 'offer', stage: 'launchpad', text: 'I have three clear tiers and I know exactly what each one includes, costs, and who it’s for.' },
  { code: 'C1', pillar: 'clients', stage: 'launchpad', text: 'I post consistently and my outreach runs weekly — warm leads come in without me chasing cold contacts.' },
  { code: 'C2', pillar: 'clients', stage: 'launchpad', text: 'I have a simple ad running that gets my offer in front of the right people for under $20/day.' },
  { code: 'C3', pillar: 'clients', stage: 'launchpad', text: 'My proposal is ready to send the moment an enquiry lands — professional, up to date, and decision-ready.' },
  { code: 'D1', pillar: 'delivery', stage: 'launchpad', text: 'Every client job runs the same way — from signed contract to published post, the process is mapped and repeatable.' },
  { code: 'D2', pillar: 'delivery', stage: 'launchpad', text: "A new client's first 30 days are smooth and streamlined — onboarding, strategy, and first shoot all happen without chaos." },
  { code: 'D3', pillar: 'delivery', stage: 'launchpad', text: "I have at least one person helping me deliver — I've won back half my time without dropping quality." },
  { code: 'O4', pillar: 'offer', stage: 'scale', text: 'I know my revenue target and exactly how many clients at each tier I need to hit it — my capacity model is mapped.' },
  { code: 'O5', pillar: 'offer', stage: 'scale', text: 'My prices reflect my value — I charge premium rates and clients accept why without hesitation.' },
  { code: 'O6', pillar: 'offer', stage: 'scale', text: 'I know my numbers — P&L, margin per client, and profit after costs — and I make decisions based on them.' },
  { code: 'C4', pillar: 'clients', stage: 'scale', text: 'My paid ads bring in qualified leads profitably and consistently — the funnel runs without me managing it daily.' },
  { code: 'C5', pillar: 'clients', stage: 'scale', text: 'My organic content machine runs weekly and positions me as the obvious choice in my space.' },
  { code: 'C6', pillar: 'clients', stage: 'scale', text: 'My clients stay — I have a proactive retention system that keeps relationships strong and renewals predictable.' },
  { code: 'D4', pillar: 'delivery', stage: 'scale', text: 'I have a capable A-team across shooting, editing, and socials — the business delivers without me on every job.' },
  { code: 'D5', pillar: 'delivery', stage: 'scale', text: 'Every role in my business has a documented SOP — new team members can be trained to standard without me.' },
  { code: 'D6', pillar: 'delivery', stage: 'scale', text: "My team has clear KPIs, a structured onboarding roadmap, and regular reviews — I lead them, I don't babysit them." },
];

export type IssueType = 'supply' | 'demand' | 'balanced';

export interface AuditResult {
  supplyReds: number;
  demandReds: number;
  issue: IssueType;
  focus: string[]; // module codes, priority order
}

const SCORE: Record<Rating, number> = { red: 0, amber: 1, green: 2 };

/** Offer + Clients reds = supply issue; Delivery reds = demand issue. */
export function classifyAudit(answers: Record<string, Rating>): AuditResult {
  let supplyReds = 0, demandReds = 0;
  for (const q of AUDIT_QUESTIONS) {
    if (answers[q.code] !== 'red') continue;
    if (q.pillar === 'delivery') demandReds++; else supplyReds++;
  }
  const issue: IssueType = supplyReds > demandReds ? 'supply' : demandReds > supplyReds ? 'demand' : supplyReds === 0 ? 'balanced' : 'supply';
  const focus = AUDIT_QUESTIONS
    .map((q, i) => ({ q, i, s: SCORE[answers[q.code] ?? 'green'] }))
    .filter(x => x.s < 2)
    .sort((a, b) => {
      if (a.s !== b.s) return a.s - b.s;
      const aw = issue === 'demand' ? a.q.pillar === 'delivery' : a.q.pillar !== 'delivery';
      const bw = issue === 'demand' ? b.q.pillar === 'delivery' : b.q.pillar !== 'delivery';
      if (aw !== bw) return aw ? -1 : 1;
      return a.i - b.i;
    })
    .slice(0, 3)
    .map(x => x.q.code);
  return { supplyReds, demandReds, issue, focus };
}

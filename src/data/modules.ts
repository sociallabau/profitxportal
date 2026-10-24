// The 18 ProfitX roadmap modules. One list, used by the Roadmap grid, the
// Growth Hub trainings and the build list chips, so names can't drift apart.
export const PROFITX_MODULES: Record<string, string> = {
  O1: 'Market & Message', O2: 'Golden Retainer', O3: 'Tier Flow',
  O4: 'Revenue Architect', O5: 'Premium Positioning', O6: 'Financial Mastery',
  C1: 'Organic Content Flywheel', C2: 'Profile Visit Ads', C3: 'Proposal Packs',
  C4: 'Full Funnel Paid Ads', C5: 'Content Authority', C6: 'Client Retention System',
  D1: 'Delivery Roadmap', D2: 'Onboarding Blueprint', D3: 'Getting Help',
  D4: 'Build Your A-Team', D5: 'Airtight SOPs', D6: 'Leadership System',
};

export const moduleName = (code: string) => PROFITX_MODULES[code] ?? code;

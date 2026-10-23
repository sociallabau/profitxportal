export type ContextAnswers = Record<string, string | string[]>;
export type ContextField = { key: string; label: string; placeholder: string; type?: 'number' | 'month' | 'url' | 'textarea' | 'select' | 'multi' | 'radio'; options?: string[]; optional?: boolean };
export const contextSections: { key: string; title: string; fields: ContextField[] }[] = [
  { key: 'about', title: 'About you', fields: [
    { key: 'business_name', label: 'Business name', placeholder: 'Your video or content agency name' },
    { key: 'your_role', label: 'Your role', placeholder: 'Founder, filmmaker and creative director' },
    { key: 'location', label: 'Location', placeholder: 'Brisbane, Australia' },
    { key: 'years_in_business', label: 'Years in business', placeholder: '3', type: 'number' },
    { key: 'team', label: 'Team', placeholder: 'Solo + 1 freelance editor' },
    { key: 'website', label: 'Website', placeholder: 'https://youragency.com', type: 'url' },
    { key: 'instagram_handle', label: 'Instagram handle', placeholder: '@youragency' },
    { key: 'offers_detail', label: 'What each offer includes', placeholder: 'Starter: 4 reels/month. Growth: 8 reels + a shoot day. Premium: full content management.', type: 'textarea' },
  ] },
  { key: 'numbers', title: 'The numbers', fields: [
    { key: 'best_month_amount', label: 'Best month ($)', placeholder: '15000', type: 'number' },
    { key: 'best_month_date', label: 'Best month', placeholder: '', type: 'month' },
    { key: 'percent_recurring', label: 'Recurring revenue (%)', placeholder: '70', type: 'number' },
    { key: 'main_lead_source', label: 'Main lead source', placeholder: 'Choose a source', type: 'select', options: ['Referrals', 'Instagram organic', 'Meta ads', 'Outreach', 'Other'] },
    { key: 'lead_source_other', label: 'Other lead source', placeholder: 'Local networking with real estate agents', optional: true },
    { key: 'average_retainer_length', label: 'Average retainer length', placeholder: '6 months' },
  ] },
  { key: 'customer', title: 'Your customer', fields: [
    { key: 'niche', label: 'Niche', placeholder: 'Real estate agents in Brisbane' },
    { key: 'customer_problem', label: 'What customers are stuck on before you', placeholder: 'They have great listings but no consistent video content to attract sellers.', type: 'textarea' },
    { key: 'your_angle', label: 'Why they choose you', placeholder: 'We handle everything from shoot to posting, so agents can focus on selling.', type: 'textarea' },
    { key: 'dream_client', label: 'Dream client', placeholder: 'An established agency with 5 agents that wants weekly content.', type: 'textarea' },
  ] },
  { key: 'content', title: 'Content & audience', fields: [
    { key: 'platforms', label: 'Platforms', placeholder: '', type: 'multi', options: ['Instagram', 'TikTok', 'YouTube', 'LinkedIn', 'Facebook'] },
    { key: 'followers', label: 'Followers', placeholder: 'Instagram: 2,500. LinkedIn: 800.' },
    { key: 'posting_cadence', label: 'Posting cadence', placeholder: '3 reels a week' },
    { key: 'whats_working', label: "What's working", placeholder: 'Behind-the-scenes shoot reels bring enquiries from local businesses.', type: 'textarea' },
    { key: 'long_vs_short', label: 'Long vs short content', placeholder: 'Mostly short reels; testing monthly YouTube breakdowns.', type: 'textarea' },
  ] },
  { key: 'story', title: 'How you got here', fields: [
    { key: 'origin_story', label: 'Origin story', placeholder: 'Started filming weddings, then moved into monthly business content.', type: 'textarea' },
    { key: 'what_youve_tried', label: "What you've tried", placeholder: 'Cold DMs, referral incentives and a small Meta ads campaign.', type: 'textarea' },
    { key: 'turning_points', label: 'Turning points', placeholder: 'Signing my first three retainers let me bring on an editor.', type: 'textarea' },
  ] },
  { key: 'now', title: 'Right now', fields: [
    { key: 'biggest_blocker', label: 'Biggest blocker', placeholder: 'Editing every project myself leaves no time for sales.', type: 'textarea' },
    { key: 'what_you_want_help_with', label: 'What you want help with', placeholder: 'Hiring an editor and building a repeatable retainer offer.', type: 'textarea' },
    { key: 'next_90_days_focus', label: 'Next 90 days focus', placeholder: 'Sign 3 retainers, delegate editing and run our first ad campaign.', type: 'textarea' },
  ] },
  { key: 'support', title: 'How you like to be supported', fields: [
    { key: 'check_in_cadence', label: 'Check-in cadence', placeholder: 'Choose a cadence', type: 'radio', options: ['Weekly', 'Fortnightly', 'Monthly', 'Only when I reach out'] },
    { key: 'preferred_channel', label: 'Preferred channel', placeholder: 'Choose a channel', type: 'select', options: ['WhatsApp', 'Email', 'Portal'] },
    { key: 'anything_else', label: 'Anything going on we should know about?', placeholder: 'Any personal circumstances you want Dan and Emily to know about.', type: 'textarea', optional: true },
  ] },
];
export function isFilled(value: unknown): boolean {
  return Array.isArray(value) ? value.length > 0 : value != null && String(value).trim().length > 0;
}
export function contextCompleteness(answers: ContextAnswers) {
  const required = contextSections.flatMap(s => s.fields.filter(f => !f.optional));
  const filled = required.filter(f => isFilled(answers[f.key])).length;
  const sections = contextSections.filter(s => s.fields.filter(f => !f.optional).every(f => isFilled(answers[f.key]))).length;
  return { percentage: Math.round(filled / required.length * 100), sections, filled, total: required.length };
}
export function sectionAge(timestamp: unknown, now = Date.now()) {
  const time = typeof timestamp === 'string' ? Date.parse(timestamp) : NaN;
  const days = Number.isFinite(time) ? Math.max(0, Math.floor((now - time) / 86400000)) : null;
  return { days, needsRefresh: days !== null && days > 90 };
}
export type ContextTotals = { month?: string | null; mrr_manual?: number | null; mrr?: number | null; active_retainers?: number | null };
export type ContextGoal = { starting_mrr?: number | null; target_mrr?: number | null; target_date?: string | null; retainer_tier_1?: number | null; retainer_tier_2?: number | null; retainer_tier_3?: number | null };
export function buildContextMarkdown(answers: ContextAnswers, latestTotals?: ContextTotals | null, goal?: ContextGoal | null): string {
  return contextSections.map(section => {
    const lines = section.fields.filter(f => f.key !== 'anything_else' && isFilled(answers[f.key])).map(f => `- **${f.label}:** ${Array.isArray(answers[f.key]) ? (answers[f.key] as string[]).join(', ') : answers[f.key]}`);
    if (section.key === 'about' && goal) [1, 2, 3].forEach(tier => {
      const price = goal[`retainer_tier_${tier}` as keyof ContextGoal];
      if (price != null) lines.push(`- **Retainer tier ${tier}:** $${price}/month`);
    });
    if (section.key === 'numbers' && latestTotals) {
      const mrr = latestTotals.mrr_manual ?? latestTotals.mrr;
      if (mrr != null) lines.push(`- **Latest MRR:** $${mrr}`);
      if (latestTotals.month) lines.push(`- **Report month:** ${latestTotals.month}`);
      if (latestTotals.active_retainers != null) lines.push(`- **Active retainers:** ${latestTotals.active_retainers}`);
    }
    if (section.key === 'now' && goal) {
      if (goal.starting_mrr != null) lines.push(`- **Starting MRR:** $${goal.starting_mrr}`);
      if (goal.target_mrr != null) lines.push(`- **Target MRR:** $${goal.target_mrr}`);
      if (goal.target_date) lines.push(`- **Target date:** ${goal.target_date}`);
    }
    return lines.length ? `## ${section.title}\n${lines.join('\n')}` : '';
  }).filter(Boolean).join('\n\n');
}

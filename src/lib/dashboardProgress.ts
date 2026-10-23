export const REVENUE_STEPS = [0, 10000, 20000, 30000, 40000, 50000, 84000, 100000, 150000];


/** Split a run-on focus note into short, scannable dot points. */
export function focusBullets(text?: string | null): string[] {
  if (!text) return [];
  const flattened = text.replace(/\s+/g, ' ').trim();
  if (!flattened) return [];
  // Long parenthetical asides read better as their own dot point.
  const spaced = flattened.replace(/\s*\(([^()]{30,})\)/g, ' | $1');
  const chunks = spaced
    .split(/\s*\|\s*|\s+[-–—]\s+|\s+\/\s+|(?<=[.!?])\s+/)
    .map((chunk) => chunk.replace(/^[-–—\s]+|[,;:\s]+$/g, '').trim())
    .filter((chunk) => chunk.length > 1);

  const bullets: string[] = [];
  for (const chunk of chunks) {
    const last = bullets.at(-1);
    // Lowercase openings ("to get engagement") are continuations, not new points.
    if (last && (/^[a-z]/.test(chunk) || chunk.length < 12)) {
      bullets[bullets.length - 1] = `${last.replace(/[.!?]+$/, '')}, ${chunk}`;
      continue;
    }
    bullets.push(chunk.charAt(0).toUpperCase() + chunk.slice(1));
  }
  return bullets.map((bullet) => bullet.replace(/[.!?]+$/, ''));
}


/** Equal-width ladder levels with interpolation within each level. */
export function revenuePosition(revenue: number) {
  const amount = Math.max(0, revenue);
  const index = REVENUE_STEPS.findIndex((step) => step > amount);
  if (index < 0) return 100;
  if (index === 0) return 0;
  const lower = REVENUE_STEPS[index - 1];
  return ((index - 1 + (amount - lower) / (REVENUE_STEPS[index] - lower)) / (REVENUE_STEPS.length - 1)) * 100;
}

export function submissionStreak(months: string[], today: string) {
  const monthNumber = (date: string) => Number(date.slice(0, 4)) * 12 + Number(date.slice(5, 7)) - 1;
  const submitted = new Set(months.map(monthNumber));
  const current = monthNumber(today);
  let cursor = submitted.has(current) ? current : current - 1;
  let streak = 0;
  while (submitted.has(cursor)) { streak++; cursor--; }
  let longest = 0;
  for (const month of submitted) {
    let length = 0;
    let next = month;
    while (submitted.has(next)) { length++; next--; }
    longest = Math.max(longest, length);
  }
  return { streak, longest };
}
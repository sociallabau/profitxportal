export const REVENUE_STEPS = [0, 10000, 20000, 30000, 40000, 50000, 84000, 100000, 150000];

const ASIDE = String.fromCharCode(1);
const FILLERS = /^(just|basically|additionally|plus|so|also|then|and|but|let's|i want you to|you need to|we need to|you have to)\s+/i;

/** Strip hedged lead-ins so each point reads as an instruction. */
function direct(chunk: string) {
  let out = chunk.replace(/^[-–—.,:;\s]+|[,;:\s]+$/g, '').trim();
  while (FILLERS.test(out)) out = out.replace(FILLERS, '').trim();
  if (!out) return '';
  return (out.charAt(0).toUpperCase() + out.slice(1)).replace(/[.!?]+$/, '');
}

/** Split a run-on focus note into short, direct dot points. */
export function focusBullets(text?: string | null): string[] {
  if (!text) return [];
  const flattened = text.replace(/\s+/g, ' ').trim();
  if (!flattened) return [];
  // Long parenthetical asides read better as their own dot point.
  const marked = flattened.replace(/\s*\(([^()]{30,})\)/g, ` ${ASIDE}$1${ASIDE} `);
  const bullets: string[] = [];

  marked.split(ASIDE).forEach((piece, index) => {
    const aside = index % 2 === 1;
    const parts = piece
      .split(/\s+and\s+then\s+|\s+[-–—]\s+|\s+\/\s+|(?<=[.!?])\s+|,\s+/)
      .map((chunk) => chunk.trim())
      .filter((chunk) => chunk.length > 0);

    const joined: string[] = [];
    for (const chunk of parts) {
      const last = joined.at(-1);
      // One- or two-word fragments are tails, not their own point.
      if (last && !aside && chunk.split(/\s+/).length < 3) {
        joined[joined.length - 1] = `${last}, ${chunk}`;
        continue;
      }
      joined.push(chunk);
    }

    for (const chunk of joined) {
      const point = direct(chunk);
      if (point.length > 1 && !bullets.includes(point)) bullets.push(point);
    }
  });

  return bullets;
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

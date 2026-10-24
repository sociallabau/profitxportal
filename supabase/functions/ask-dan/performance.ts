export type UsageCall = { stage: string; model: string; ms: number; input_tokens: number; cache_read_input_tokens: number; cache_creation_input_tokens: number; output_tokens: number; retry: boolean; error?: string };
export type Timing = { total_ms: number; steps: Record<string, number>; calls: UsageCall[] };
export function timing() {
  const started = performance.now();
  const data: Timing = { total_ms: 0, steps: {}, calls: [] };
  return { data, finish: () => { data.total_ms = Math.round(performance.now() - started); return data; },
    measure: async <T>(name: string, fn: () => Promise<T>): Promise<T> => {
      const start = performance.now();
      try { return await fn(); } finally { data.steps[name] = (data.steps[name] ?? 0) + Math.round(performance.now() - start); }
    } };
}

/** Keep the best match window, rather than the unrelated start of a long transcript. */
export function relevantExcerpt(content: string, terms: string[], limit = 900): string {
  if (content.length <= limit) return content;
  const lower = content.toLowerCase();
  const positions = terms.map(t => lower.indexOf(t.toLowerCase())).filter(n => n >= 0);
  let start = 0, best = -1;
  for (const pos of positions) {
    const candidate = Math.max(0, Math.min(content.length - limit, pos - Math.floor(limit / 2)));
    const score = terms.filter(t => lower.slice(candidate, candidate + limit).includes(t.toLowerCase())).length;
    if (score > best) { best = score; start = candidate; }
  }
  return content.slice(start, start + limit);
}

/** A passing checker has no final field; a failing checker must supply a valid correction. */
export function checkerResult<T>(parsed: Record<string, unknown> | null, draft: T, parse: (v: unknown) => T | null) {
  if (!parsed || !Array.isArray(parsed.issues)) return null;
  if (parsed.pass === true && parsed.issues.length === 0) return { final: draft, pass: true, issues: [] };
  const final = parse(parsed.final);
  if (parsed.pass !== false || !final) return null;
  return { final, pass: false, issues: parsed.issues as { type: string; note: string }[] };
}
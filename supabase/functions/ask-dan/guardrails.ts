// Pure code guardrails run on the final answer.
import { BANNED_PHRASES, SWEARS } from "./prompts.ts";

export const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// First names that are also everyday words — too noisy to match on their own.
const COMMON = new Set(["will", "mark", "grace", "faith", "hope", "rich", "chase", "max", "page", "may", "june", "dan", "bro", "sam", "art", "joy", "case"]);

/** Builds the list of name tokens (full names + distinctive first names) for everyone except the asker. */
export function nameTokens(allNames: string[], askerName: string | null): string[] {
  const own = new Set((askerName ?? "").toLowerCase().split(/\s+/).filter(Boolean));
  const out = new Set<string>();
  for (const raw of allNames) {
    const full = raw.trim();
    if (full.length < 3) continue;
    if (full.toLowerCase() !== (askerName ?? "").toLowerCase()) out.add(full);
    const first = full.split(/\s+/)[0];
    if (first.length >= 3 && !own.has(first.toLowerCase()) && !COMMON.has(first.toLowerCase())) out.add(first);
  }
  return [...out].sort((a, b) => b.length - a.length);
}

export function findNames(text: string, tokens: string[]): string[] {
  return tokens.filter(t => new RegExp(`\\b${escapeRe(t)}\\b`, "i").test(text));
}

export function redact(text: string, tokens: string[]): string {
  let out = text;
  for (const t of tokens) out = out.replace(new RegExp(`\\b${escapeRe(t)}\\b`, "gi"), "a member");
  return out;
}

export function findBanned(text: string): string[] {
  const lower = text.toLowerCase();
  const hits = BANNED_PHRASES.filter(p => lower.includes(p));
  for (const s of SWEARS) if (new RegExp(`\\b${s}\\b`, "i").test(text)) hits.push(s);
  if (/\bleverag(e|ing)\s+(your|the|this|it|their|that)\b/i.test(text)) hits.push("leverage (verb)");
  return hits;
}

export const wordCount = (t: string) => t.split(/\s+/).filter(Boolean).length;

/** Drop "bro" from a line, keeping the punctuation around it tidy ("Nah bro, at" -> "Nah, at"; "Bro, do" -> "Do"). */
function stripBro(s: string): string {
  const out = s.replace(/^\s*bro\b[,!.]?\s*/i, "").replace(/\s+bro\b/gi, "").replace(/\s{2,}/g, " ");
  return out && /^\s*bro\b/i.test(s) ? out[0].toUpperCase() + out.slice(1) : out;
}

/** Dan doesn't say "bro" every time: keep at most the first one, and none when `allow` is false (a recent answer already used it). */
export function limitBro<T extends { answer: string; points: { do: string; why: string }[]; note: string | null }>(a: T, allow: boolean): T {
  let used = !allow;
  const pass = (s: string) => {
    if (!/\bbro\b/i.test(s)) return s;
    if (used) return stripBro(s);
    used = true;
    const end = s.search(/\bbro\b/i) + 3;
    return s.slice(0, end) + stripBro(s.slice(end));
  };
  const answer = pass(a.answer);
  const points = a.points.map(pt => ({ ...pt, do: pass(pt.do), why: pass(pt.why) }));
  return { ...a, answer, points, note: a.note == null ? null : pass(a.note) };
}

export function looksTruncated(text: string): boolean {
  const t = text.trim();
  return !/[.!?:)"'’”…]$/.test(t);
}

/** Resource must match a catalogue line exactly (full line or just its title part). */
export function matchResource(resource: string | null, catalogue: string[]): string | null {
  if (!resource) return null;
  const r = resource.trim();
  const title = (line: string) => (line.split(" · ").pop() ?? line).split(" — ")[0].trim();
  return catalogue.find(l => l === r) ?? catalogue.find(l => title(l) === title(r)) ?? null;
}

/** Match dollar amounts rather than coincidental digits. */
export function hasCostPerClient(text: string, cost: number): boolean {
  return [...text.matchAll(/\$\s*(\d[\d,]*(?:\.\d+)?)/g)]
    .some(match => Number(match[1].replace(/,/g, "")) === Math.round(cost));
}

/** Keep computed facts inside a point, not a disposable trailing note. */
export function repairCostPerClient<T extends { points: { do: string; why: string }[] }>(answer: T, cost: number, price: number | null | undefined): T {
  if (!Number.isFinite(cost) || !answer.points.length) return answer;
  const fact = `~$${Math.round(cost).toLocaleString("en-US")} a client${typeof price === "number" && price > 0 ? ` vs your $${price.toLocaleString("en-US")} retainer, ${cost < price / 2 ? "under half" : "not under half"} your first month's fee` : ""}`;
  const index = answer.points.findIndex(point => /cost|client|fee|budget|scal/i.test(`${point.do} ${point.why}`));
  const target = index < 0 ? 0 : index;
  return { ...answer, points: answer.points.map((point, i) => i === target ? { ...point, why: `${point.why.replace(/[.!]$/, "")}; ${fact}.` } : point) };
}

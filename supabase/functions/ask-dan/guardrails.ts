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

export function looksTruncated(text: string): boolean {
  const t = text.trim();
  return !/[.!?)"'’”…]$/.test(t);
}

/** Resource must match a catalogue line exactly (full line or just its title part). */
export function matchResource(resource: string | null, catalogue: string[]): string | null {
  if (!resource) return null;
  const r = resource.trim();
  const title = (line: string) => (line.split(" · ").pop() ?? line).split(" — ")[0].trim();
  return catalogue.find(l => l === r) ?? catalogue.find(l => title(l) === title(r)) ?? null;
}

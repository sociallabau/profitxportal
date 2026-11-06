/**
 * Client Health chat: Dan or Emily types "booked a call with Harry Tuesday 8:15am" and the
 * model drafts who, when and what kind of contact. Code never trusts the draft on its own —
 * the client must be a single exact match in the roster (never a guess between two people
 * with the same first name), the date must actually parse, and "already happened" vs "still
 * ahead" is recomputed from that date rather than taken from the model's own label.
 */

export type ContactLogDraft = {
  client_name: string | null;
  scheduled_at: string | null;
  kind: string | null;
  note: string | null;
  understood: boolean;
};

export type Roster = { id: string; name: string }[];

export const CONTACT_KINDS = ["whatsapp", "call", "quarterly_call", "group_call", "other"] as const;
export type ContactKind = (typeof CONTACT_KINDS)[number];

const DAY = 24 * 60 * 60 * 1000;
/** A date within a year either way of now. Anything further out is almost certainly a misread, not a real booking. */
const YEAR = 366 * DAY;

/** Exact name match first (case/whitespace-insensitive), then first-name only if that's unique. Never guesses between two people. */
export function resolveClient(name: string | null, roster: Roster): { id: string; name: string } | null {
  const q = name?.trim().toLowerCase().replace(/\s+/g, " ") ?? "";
  if (!q) return null;
  const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");
  const exact = roster.filter(r => norm(r.name) === q);
  if (exact.length === 1) return exact[0];
  const firstName = roster.filter(r => norm(r.name).split(" ")[0] === q);
  return firstName.length === 1 ? firstName[0] : null;
}

export function resolveKind(kind: string | null | undefined): ContactKind {
  return (CONTACT_KINDS as readonly string[]).includes(kind ?? "") ? (kind as ContactKind) : "call";
}

export type ResolvedContactLog =
  | { ok: true; client: { id: string; name: string }; at: Date; when: "past" | "future"; kind: ContactKind; note: string | null }
  | { ok: false; reason: "not_understood" | "client_not_found" | "bad_date" };

/**
 * Resolves the model's draft against real data. `preselected` is passed when the chat was opened
 * from inside one client's own panel, so the text doesn't need to name them at all.
 */
export function resolveContactLog(
  draft: ContactLogDraft,
  roster: Roster,
  now: Date,
  preselected?: { id: string; name: string } | null,
): ResolvedContactLog {
  if (!draft.understood) return { ok: false, reason: "not_understood" };
  const client = preselected ?? resolveClient(draft.client_name, roster);
  if (!client) return { ok: false, reason: "client_not_found" };
  const at = draft.scheduled_at ? new Date(draft.scheduled_at) : null;
  if (!at || isNaN(at.getTime()) || Math.abs(at.getTime() - now.getTime()) > YEAR) return { ok: false, reason: "bad_date" };
  const when = at.getTime() <= now.getTime() + DAY ? "past" : "future";
  return { ok: true, client, at, when, kind: resolveKind(draft.kind), note: draft.note?.trim().slice(0, 300) || null };
}

/** `roster` is null when a client is already selected (opened from their own panel), so the model never needs to name them. */
export function contactLogPrompt(today: string, roster: string[] | null): string {
  return `You are Dan Wilmott's analyst inside the ProfitX portal, helping him log client contact from the Client Health page. Dan (the coach, an admin) just typed a short note about a client he's spoken to or booked in — Emily, his team member, may also be the one typing.

TODAY: ${today} (Brisbane time, no daylight saving). Resolve relative dates ("Tuesday", "tomorrow") against this.
${roster ? `CLIENTS:\n${roster.join(", ")}` : "The client is already selected on screen — do not try to name them, leave client_name null."}

Return JSON only, no other text:
{"understood": true or false (false if this note isn't actually about contacting a client),
 "client_name": ${roster ? "the one name from CLIENTS this is about, written exactly as it appears there, or null if it's unclear which client" : "null"},
 "scheduled_at": "ISO 8601 date-time with a +10:00 offset, for when the contact happened or is booked — or null if you can't tell",
 "kind": "whatsapp" | "call" | "quarterly_call" | "group_call" | "other",
 "note": "a short note worth keeping — what was discussed or why — or null"}

If a day is given with no time, assume 9am that day. If no day is given but it clearly already happened ("just spoke to", "had a call with"), use TODAY.`;
}

/**
 * Client Health chat: Dan or Emily types "booked a call with Harry Tuesday 8:15am" and the
 * model drafts who, when and what kind of contact. Code never trusts the draft on its own —
 * the client must resolve to exactly one person in the roster, the date must actually parse,
 * and "already happened" vs "still ahead" is recomputed from that date rather than taken from
 * the model's own label.
 *
 * Resolving the client makes educated guesses — a nickname ("Harry" for "Harrison"), a surname
 * initial ("Harry T") — but every tier still only acts when exactly one person in the roster
 * fits. A bare "Harry" stays unresolved if there are two; nicknames widen who counts as "a
 * Harry" without weakening that rule.
 */
import type { QuarterlyState } from "../_shared/clientCare.ts";

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

/**
 * Common English nickname -> full name(s) it can stand in for. Deliberately small and not
 * exhaustive — it only needs to widen a match that still has to come out unique, never to be
 * a complete directory of names. A name with no entry here still resolves fine on its own.
 */
const NICKNAMES: Record<string, string[]> = {
  harry: ["harrison", "henry", "harold"],
  will: ["william"], bill: ["william"], liam: ["william"],
  rob: ["robert"], bob: ["robert"], bobby: ["robert"],
  mike: ["michael"], mick: ["michael"],
  alex: ["alexander", "alexandra"],
  sam: ["samuel", "samantha"],
  dan: ["daniel"], danny: ["daniel"],
  matt: ["matthew"],
  nick: ["nicholas"], nic: ["nicholas"],
  tom: ["thomas"], tommy: ["thomas"],
  chris: ["christopher", "christina", "christine"],
  liz: ["elizabeth"], beth: ["elizabeth"], eliza: ["elizabeth"],
  jen: ["jennifer"], jenny: ["jennifer"],
  kate: ["katherine", "kathryn", "catherine"], katie: ["katherine", "kathryn", "catherine"],
  dave: ["david"],
  jim: ["james"], jimmy: ["james"],
  ed: ["edward"], ted: ["edward"], eddie: ["edward"],
  steve: ["steven", "stephen"],
  andy: ["andrew"],
  tony: ["anthony"],
  joe: ["joseph"], joey: ["joseph"],
  ben: ["benjamin"],
  charlie: ["charles"],
  fred: ["frederick"],
  pat: ["patrick", "patricia"],
  greg: ["gregory"],
  ken: ["kenneth"],
  ron: ["ronald"],
  rick: ["richard"], dick: ["richard"], richie: ["richard"],
  jack: ["john"], jon: ["jonathan"], johnny: ["john"],
  max: ["maxwell", "maximilian"],
  zac: ["zachary"], zach: ["zachary"],
  nat: ["nathan", "natalie", "nathaniel"],
};

/** True if `a` and `b` are plausibly the same first name — identical, or one is a known nickname for the other. */
function sharesFirstName(a: string, b: string): boolean {
  if (a === b) return true;
  return (NICKNAMES[a] ?? []).includes(b) || (NICKNAMES[b] ?? []).includes(a);
}

/** Exact name match first (case/whitespace-insensitive), then a first name or nickname if that's
 * unique, then a nickname plus a surname initial. Every tier only acts when exactly one person
 * fits — nicknames widen who a name could mean, which makes it *more* important to check for a
 * second match, never less, so the first-name and nickname checks run together, not in sequence. */
export function resolveClient(name: string | null, roster: Roster): { id: string; name: string } | null {
  const q = name?.trim().toLowerCase().replace(/\s+/g, " ") ?? "";
  if (!q) return null;
  const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");
  const exact = roster.filter(r => norm(r.name) === q);
  if (exact.length === 1) return exact[0];

  const qTokens = q.split(" ");

  // A bare first name or nickname — "Zac", or "Harry" meaning Harrison — only if it is unique
  // across the roster once nicknames are taken into account.
  if (qTokens.length === 1) {
    const byFirstName = roster.filter(r => sharesFirstName(qTokens[0], norm(r.name).split(" ")[0]));
    return byFirstName.length === 1 ? byFirstName[0] : null;
  }

  // A nickname plus a surname initial is specific enough to act on: "Harry T" only resolves
  // if exactly one Harry/Harrison/Henry/Harold in the roster has a surname starting with T.
  const surnamePrefix = qTokens[qTokens.length - 1];
  const bySurname = roster.filter(r => {
    const rTokens = norm(r.name).split(" ");
    return rTokens.length > 1 && sharesFirstName(qTokens[0], rTokens[0]) && rTokens[rTokens.length - 1].startsWith(surnamePrefix);
  });
  return bySurname.length === 1 ? bySurname[0] : null;
}

export function resolveKind(kind: string | null | undefined): ContactKind {
  return (CONTACT_KINDS as readonly string[]).includes(kind ?? "") ? (kind as ContactKind) : "call";
}

/**
 * Does a logged or booked call stand in for a client's quarterly catch-up? Only when they have
 * no sensible quarterly date at all right now — overdue, or never scheduled — and it's a real
 * 1:1 contact, not a WhatsApp message or a group call, neither of which was ever meant to replace
 * it. A call booked while one is already planned soon never overwrites that existing plan; this
 * only fills a gap, never reschedules a real one.
 */
export function standsInForQuarterly(kind: ContactKind, quarterlyState: QuarterlyState): boolean {
  if (kind === "whatsapp" || kind === "group_call") return false;
  return quarterlyState === "overdue" || quarterlyState === "unscheduled";
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
 "client_name": ${roster ? 'the one name from CLIENTS this is about, written exactly as it appears there — even from just a nickname or a first name and surname initial (e.g. "Harry T" for "Harrison Tzortzis"), make the confident match. Only use null if it is genuinely unclear between two or more people' : "null"},
 "scheduled_at": "ISO 8601 date-time with a +10:00 offset, for when the contact happened or is booked — or null if you can't tell",
 "kind": "whatsapp" | "call" | "quarterly_call" | "group_call" | "other",
 "note": "a short note worth keeping — what was discussed or why — or null"}

If a day is given with no time, assume 9am that day. If no day is given but it clearly already happened ("just spoke to", "had a call with"), use TODAY.`;
}

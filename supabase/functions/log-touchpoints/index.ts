// Lets an automation record contact with clients without anyone typing it in:
//   - a Grok / WhatsApp scan ("last chatted with Jake on 3 Nov")
//   - a scan of call recordings in Google Drive ("Alee attended the 28 Oct group call")
//
// POST with header  x-ingest-key: <TOUCHPOINT_INGEST_KEY>  and a JSON body:
//   { "source": "whatsapp_scan" | "recording_scan",
//     "touchpoints": [ { "client": "Jake Nelson", "kind": "whatsapp", "occurred_at": "2026-11-03", "note": "optional" } ] }
// `client` is a full name (case-insensitive) or a profile id. Names that match no one or
// more than one person are skipped and reported back, never guessed. Re-sending the same
// contact is safe: the same client + kind + day is recorded once.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const KINDS = ["whatsapp", "call", "quarterly_call", "group_call", "other"];
const SOURCES = ["whatsapp_scan", "recording_scan"];
const MAX_BATCH = 500;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

/** Constant-time string comparison, so the key can't be guessed byte by byte. */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  const expected = Deno.env.get("TOUCHPOINT_INGEST_KEY");
  const given = req.headers.get("x-ingest-key") ?? "";
  if (!expected || !safeEqual(given, expected)) return json({ error: "Unauthorized" }, 401);

  const body = await req.json().catch(() => null) as { source?: string; touchpoints?: Record<string, unknown>[] } | null;
  const source = body?.source ?? "";
  if (!SOURCES.includes(source)) return json({ error: `source must be one of ${SOURCES.join(", ")}` }, 400);
  const items = body?.touchpoints;
  if (!Array.isArray(items) || items.length === 0) return json({ error: "touchpoints must be a non-empty array" }, 400);
  if (items.length > MAX_BATCH) return json({ error: `at most ${MAX_BATCH} touchpoints per call` }, 400);

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: people, error: peopleError } = await admin.from("profiles").select("id, full_name").is("archived_at", null);
  if (peopleError) return json({ error: peopleError.message }, 500);

  const byId = new Map((people ?? []).map(p => [p.id, p]));
  const byName = new Map<string, string[]>();
  for (const p of people ?? []) {
    const key = (p.full_name ?? "").trim().toLowerCase();
    if (key) byName.set(key, [...(byName.get(key) ?? []), p.id]);
  }

  const rows: Record<string, unknown>[] = [];
  const skipped: { client: unknown; reason: string }[] = [];
  for (const item of items) {
    const ref = String(item.client ?? "").trim();
    const matches = byId.has(ref) ? [ref] : byName.get(ref.toLowerCase()) ?? [];
    if (matches.length === 0) { skipped.push({ client: item.client, reason: "no matching client" }); continue; }
    if (matches.length > 1) { skipped.push({ client: item.client, reason: "more than one client has that name — use their id" }); continue; }
    const kind = String(item.kind ?? "");
    if (!KINDS.includes(kind)) { skipped.push({ client: item.client, reason: `kind must be one of ${KINDS.join(", ")}` }); continue; }
    const when = new Date(String(item.occurred_at ?? ""));
    if (isNaN(when.getTime()) || when.getTime() > Date.now() + 86400000) { skipped.push({ client: item.client, reason: "occurred_at is missing, invalid or in the future" }); continue; }
    rows.push({
      client_id: matches[0], kind, occurred_at: when.toISOString(), source,
      note: typeof item.note === "string" ? item.note.slice(0, 500) : null,
    });
  }

  // Same client + kind + day is one contact, so a re-sent scan doesn't double up.
  let inserted = 0;
  if (rows.length) {
    const clientIds = [...new Set(rows.map(r => r.client_id as string))];
    const { data: existing } = await admin.from("client_touchpoints").select("client_id, kind, occurred_at").in("client_id", clientIds);
    const seen = new Set((existing ?? []).map(e => `${e.client_id}|${e.kind}|${String(e.occurred_at).slice(0, 10)}`));
    const fresh = rows.filter(r => {
      const key = `${r.client_id}|${r.kind}|${String(r.occurred_at).slice(0, 10)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    if (fresh.length) {
      const { error } = await admin.from("client_touchpoints").insert(fresh);
      if (error) return json({ error: error.message }, 500);
    }
    inserted = fresh.length;
  }
  return json({ received: items.length, inserted, duplicates: rows.length - inserted, skipped });
});

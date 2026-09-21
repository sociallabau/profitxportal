// Reads the ProfitX calendar live, so a call added in Google shows up in the
// portal without anyone re-syncing anything.
//
// The calendar is public, so this needs no credentials at all — it reads the
// iCal feed, expands the weekly recurrence, applies single-instance overrides,
// and returns what is coming up.

const CALENDAR_ID =
  "c_ebc91e1852c822a22f276f89341b663bc02bd2d7931f1667750941112e7672fe@group.calendar.google.com";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/** iCal wraps long lines at 75 characters with a leading space. */
function unfold(ics: string): string {
  return ics.replace(/\r\n/g, "\n").replace(/\n[ \t]/g, "");
}

function field(block: string, name: string): string | null {
  const match = block.match(new RegExp(`^${name}(?:;[^:\\n]*)?:(.*)$`, "m"));
  return match ? match[1].trim() : null;
}

/** ICS escapes commas, semicolons and newlines. */
function unescapeText(value: string): string {
  return value
    .replace(/\\n/g, "\n")
    .replace(/\\,/g, ",")
    .replace(/\;/g, ";")
    .replace(/\\\\/g, "\\");
}

/** DTSTART comes as 20260623T210000Z, or a local time with a TZID. */
function parseDate(block: string, name: string): Date | null {
  const line = block.match(new RegExp(`^${name}(;[^:\\n]*)?:(.*)$`, "m"));
  if (!line) return null;
  const raw = line[2].trim();

  const utc = raw.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/);
  if (utc) {
    const [, y, mo, d, h, mi, sec] = utc;
    return new Date(Date.UTC(+y, +mo - 1, +d, +h, +mi, +sec));
  }

  // A floating or TZID time. The calendar is Brisbane, which has no daylight
  // saving, so a fixed +10 offset is correct year round.
  const local = raw.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})$/);
  if (local) {
    const [, y, mo, d, h, mi, sec] = local;
    return new Date(Date.UTC(+y, +mo - 1, +d, +h - 10, +mi, +sec));
  }

  const dateOnly = raw.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (dateOnly) {
    const [, y, mo, d] = dateOnly;
    return new Date(Date.UTC(+y, +mo - 1, +d, -10, 0, 0));
  }
  return null;
}

function meetUrlFrom(block: string): string {
  const conference = field(block, "X-GOOGLE-CONFERENCE");
  if (conference) return conference;
  const description = field(block, "DESCRIPTION") ?? "";
  const match = unescapeText(description).match(/https:\/\/meet\.google\.com\/[a-z-]+/i);
  return match ? match[0] : "";
}

/** The three kinds of session Dan runs, inferred from the title. */
function categoryOf(title: string): "Workshop" | "Q&A" | "Coaching" {
  if (/workshop|hot seat|lesson/i.test(title)) return "Workshop";
  if (/q\s*&\s*a|q and a/i.test(title)) return "Q&A";
  return "Coaching";
}

/** Strips the boilerplate Google appends about joining the call. */
function cleanDescription(raw: string | null): string {
  if (!raw) return "";
  return unescapeText(raw)
    .split(/Join with Google Meet:/i)[0]
    .split(/-::~:~::/)[0]
    .trim()
    .slice(0, 400);
}

type Session = {
  title: string;
  category: string;
  start: string;
  durationMins: number;
  meetUrl: string;
  description: string;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const url =
      `https://calendar.google.com/calendar/ical/${encodeURIComponent(CALENDAR_ID)}/public/basic.ics`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Calendar ${res.status}`);

    const ics = unfold(await res.text());
    const blocks = ics.match(/BEGIN:VEVENT[\s\S]*?END:VEVENT/g) ?? [];

    const now = new Date();
    const horizon = new Date(now.getTime() + 120 * 86400000);

    const singles: Session[] = [];
    // Keyed by the instance they replace, so an override wins over the rule.
    const overrides = new Map<string, Session | null>();
    const recurring: { block: string; start: Date; durationMins: number }[] = [];

    const toSession = (block: string, start: Date, durationMins: number): Session => {
      const title = unescapeText(field(block, "SUMMARY") ?? "ProfitX call");
      return {
        title,
        category: categoryOf(title),
        start: start.toISOString(),
        durationMins,
        meetUrl: meetUrlFrom(block),
        description: cleanDescription(field(block, "DESCRIPTION")),
      };
    };

    for (const block of blocks) {
      const start = parseDate(block, "DTSTART");
      if (!start) continue;
      const end = parseDate(block, "DTEND");
      const durationMins = end ? Math.round((end.getTime() - start.getTime()) / 60000) : 60;

      const recurrenceId = parseDate(block, "RECURRENCE-ID");
      const cancelled = /^STATUS:CANCELLED$/m.test(block);

      if (recurrenceId) {
        const key = recurrenceId.toISOString().slice(0, 10);
        overrides.set(key, cancelled ? null : toSession(block, start, durationMins));
        continue;
      }
      if (cancelled) continue;

      if (/^RRULE:/m.test(block)) {
        recurring.push({ block, start, durationMins });
        continue;
      }
      singles.push(toSession(block, start, durationMins));
    }

    // Expand the weekly rules forward. Only FREQ=WEEKLY appears on this
    // calendar; anything else is left as its single occurrence.
    for (const { block, start, durationMins } of recurring) {
      const rrule = field(block, "RRULE") ?? "";
      if (!/FREQ=WEEKLY/.test(rrule)) {
        singles.push(toSession(block, start, durationMins));
        continue;
      }
      const interval = Number(rrule.match(/INTERVAL=(\d+)/)?.[1] ?? 1);
      const untilRaw = rrule.match(/UNTIL=(\d{8})/)?.[1];
      const until = untilRaw
        ? new Date(Date.UTC(+untilRaw.slice(0, 4), +untilRaw.slice(4, 6) - 1, +untilRaw.slice(6, 8)))
        : horizon;
      const stop = until < horizon ? until : horizon;

      for (let when = new Date(start); when <= stop; when = new Date(when.getTime() + interval * 7 * 86400000)) {
        if (when < now) continue;
        const key = when.toISOString().slice(0, 10);
        if (overrides.has(key)) continue;   // handled below, or cancelled
        singles.push(toSession(block, when, durationMins));
      }
    }

    for (const override of overrides.values()) {
      if (override) singles.push(override);
    }

    const upcoming = singles
      .filter(s => new Date(s.start) >= new Date(now.getTime() - 3 * 3600000))
      .sort((a, b) => a.start.localeCompare(b.start));

    return new Response(JSON.stringify({ calls: upcoming, fetchedAt: now.toISOString() }), {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
        // Fresh enough to feel live, cached enough not to hit Google on every load.
        "Cache-Control": "public, max-age=900",
      },
    });
  } catch (err) {
    console.error("calendar-feed error", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Could not read the calendar" }),
      { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

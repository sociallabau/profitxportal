import PageLayout from '@/components/PageLayout';
import { Card } from '@/components/ui/card';
import { Video, Calendar, ExternalLink } from 'lucide-react';

type Call = {
  title: string;
  category: 'Workshop' | 'Q&A' | 'Coaching';
  /** ISO start datetime, local time assumed (e.g. "2026-04-29T18:00:00") */
  start: string;
  /** Duration in minutes */
  durationMins: number;
  meetUrl: string;
  description?: string;
};

const CALLS: Call[] = [
  {
    title: 'ProfitX — Workshop — Paid Ads',
    category: 'Workshop',
    start: '2026-04-29T07:00:00',
    durationMins: 90,
    meetUrl: 'https://meet.google.com/zzd-yxwv-byn',
    description: 'Live workshop covering paid ads strategy. Join via Google Meet.',
  },
  {
    title: 'ProfitX — Q&A Call',
    category: 'Q&A',
    start: '2026-05-13T07:00:00',
    durationMins: 90,
    meetUrl: 'https://meet.google.com/vte-wrkq-rpp',
    description: 'Live Q&A call. Time zone: Australia/Brisbane. Join via Google Meet.',
  },
  {
    title: 'ProfitX Workshop — Profit By Design™ Workshop',
    category: 'Workshop',
    start: '2026-05-27T07:00:00',
    durationMins: 90,
    meetUrl: 'https://meet.google.com/hjc-ycoe-sxq',
    description: 'Profit By Design™ Workshop. Time zone: Australia/Brisbane. Join via Google Meet.',
  },
  {
    title: 'ProfitX — 6 Week Focus Finder',
    category: 'Workshop',
    start: '2026-05-29T15:00:00',
    durationMins: 90,
    meetUrl: 'https://meet.google.com/wvb-vcyj-fpa',
    description: '6 Week Focus Finder. Time zone: Australia/Brisbane. Join via Google Meet.',
  },
  {
    title: 'ProfitX — Q&A Call',
    category: 'Q&A',
    start: '2026-06-10T07:00:00',
    durationMins: 90,
    meetUrl: 'https://meet.google.com/hrh-zzii-fjg',
    description: 'Live Q&A call. Time zone: Australia/Brisbane. Join via Google Meet.',
  },
  {
    title: 'ProfitX Workshop — Smooth Operator™',
    category: 'Workshop',
    start: '2026-06-24T07:00:00',
    durationMins: 90,
    meetUrl: 'https://meet.google.com/asf-ects-ojs',
    description:
      'Smooth Operator™ Workshop. Time zone: Australia/Brisbane. Join via Google Meet, or dial +61 2 9051 3403 PIN 632 998 776.',
  },
];

/**
 * Recurring weekly Momentum Call — every Tuesday 7:30–8:15am Brisbane.
 * We generate the next 3 upcoming occurrences from "now" so the list
 * auto-rolls forward each week.
 */
function generateMomentumCalls(count = 3): Call[] {
  const calls: Call[] = [];
  const now = new Date();
  // Start from today, find next Tuesday at 07:30 local time
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 7, 30, 0);
  const day = d.getDay(); // 0=Sun ... 2=Tue
  let daysUntilTue = (2 - day + 7) % 7;
  // If today is Tuesday and the call already finished (after 8:15am), skip to next week
  if (daysUntilTue === 0) {
    const endToday = new Date(d.getTime() + 45 * 60000);
    if (now.getTime() > endToday.getTime()) daysUntilTue = 7;
  }
  d.setDate(d.getDate() + daysUntilTue);

  for (let i = 0; i < count; i++) {
    const occ = new Date(d);
    occ.setDate(d.getDate() + i * 7);
    const pad = (n: number) => String(n).padStart(2, '0');
    const iso = `${occ.getFullYear()}-${pad(occ.getMonth() + 1)}-${pad(occ.getDate())}T07:30:00`;
    calls.push({
      title: 'ProfitX — Momentum Call™',
      category: 'Coaching',
      start: iso,
      durationMins: 45,
      meetUrl: 'https://meet.google.com/nph-fmht-azf',
      description:
        'Weekly Momentum Call. Time zone: Australia/Brisbane. Join via Google Meet, or dial +61 3 8594 7912 PIN 386 124 991.',
    });
  }
  return calls;
}

const ALL_CALLS: Call[] = [...CALLS, ...generateMomentumCalls(3)];

const categoryStyles: Record<Call['category'], string> = {
  Workshop: 'bg-warning/15 text-warning border-warning/30',
  'Q&A': 'bg-primary/15 text-primary border-primary/30',
  Coaching: 'bg-success/15 text-success border-success/30',
};

function formatDateLong(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

function formatTimeRange(iso: string, mins: number) {
  const start = new Date(iso);
  const end = new Date(start.getTime() + mins * 60000);
  const fmt = (d: Date) =>
    d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  return `${fmt(start)} – ${fmt(end)}`;
}

function toGoogleCalUtc(iso: string) {
  // Convert to YYYYMMDDTHHmmssZ
  return new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

function googleCalendarUrl(call: Call) {
  const start = toGoogleCalUtc(call.start);
  const end = toGoogleCalUtc(
    new Date(new Date(call.start).getTime() + call.durationMins * 60000).toISOString()
  );
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: call.title,
    dates: `${start}/${end}`,
    details: `${call.description ?? ''}\n\nJoin: ${call.meetUrl}`,
    location: call.meetUrl,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export default function Calls() {
  const now = Date.now();
  const upcoming = [...ALL_CALLS]
    .filter((c) => new Date(c.start).getTime() + c.durationMins * 60000 >= now)
    .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

  return (
    <PageLayout>
      <div className="mb-6">
        <h1 className="text-3xl font-bold italic text-foreground">Upcoming Calls</h1>
        <p className="text-muted-foreground mt-1">
          Upcoming workshops, Q&amp;As and coaching calls — join live or add to your calendar.
        </p>
      </div>

      {upcoming.length === 0 ? (
        <Card className="p-10 text-center">
          <p className="text-muted-foreground">No upcoming calls scheduled. Check back soon.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {upcoming.map((call) => (
            <Card
              key={call.meetUrl + call.start}
              className="h-full p-5 flex flex-col gap-4 hover:border-primary/50 hover:shadow-md hover:shadow-primary/10 transition-all"
            >
              <div className="aspect-video rounded-lg bg-gradient-to-br from-primary/20 via-primary/5 to-transparent border border-border flex items-center justify-center">
                <Video className="w-12 h-12 text-primary/80" />
              </div>

              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full border ${categoryStyles[call.category]}`}
                  >
                    {call.category}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {formatDateLong(call.start)} · {formatTimeRange(call.start, call.durationMins)}
                  </span>
                </div>
                <h3 className="font-semibold text-foreground leading-snug">{call.title}</h3>
                {call.description && (
                  <p className="text-xs text-muted-foreground">{call.description}</p>
                )}
              </div>

              <div className="mt-auto flex flex-col gap-2">
                <a
                  href={call.meetUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-1.5 text-sm font-medium px-3 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Join Google Meet
                </a>
                <a
                  href={googleCalendarUrl(call)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-1.5 text-sm font-medium px-3 py-2 rounded-lg border border-border text-foreground hover:bg-muted/50 transition-colors"
                >
                  <Calendar className="w-3.5 h-3.5" />
                  Add to Calendar
                </a>
              </div>
            </Card>
          ))}
        </div>
      )}
    </PageLayout>
  );
}

import PageLayout from '@/components/PageLayout';
import { Card } from '@/components/ui/card';
import { Video, Calendar, ExternalLink, CalendarPlus } from 'lucide-react';
import smoothOperatorThumb from '@/assets/smooth-operator-thumb.png';
import momentumCallThumb from '@/assets/momentum-call-thumb.png';
import hotSeatElijahThumb from '@/assets/hot-seat-elijah-thumb.png';
import payToPlayThumb from '@/assets/pay-to-play-thumb.png';

type Call = {
  title: string;
  category: 'Workshop' | 'Q&A' | 'Coaching';
  /** ISO start datetime, local time assumed (e.g. "2026-04-29T18:00:00") */
  start: string;
  /** Duration in minutes */
  durationMins: number;
  meetUrl: string;
  description?: string;
  thumbnail?: string;
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
    title: 'ProfitX Workshop - Smooth Operator™',
    category: 'Workshop',
    start: '2026-06-24T07:00:00',
    durationMins: 90,
    meetUrl: 'https://meet.google.com/twb-tvei-feu',
    description:
      'Smooth Operator™ Workshop. Time zone: Australia/Brisbane. Join via Google Meet, or dial +61 3 8594 7255 PIN 271 718 706.',
    thumbnail: smoothOperatorThumb,
  },
  {
    title: 'ProfitX - Hot Seat - Elijah Arnold (Director @ Social Lab)',
    category: 'Coaching',
    start: '2026-07-08T07:00:00',
    durationMins: 60,
    meetUrl: 'https://meet.google.com/kdn-nbhx-xce',
    description:
      'Hot Seat call with Elijah Arnold — Director @ Social Lab. Content pillars & strategy for clients, organic vs ads, structuring campaigns. Time zone: Australia/Brisbane. Join via Google Meet.',
    thumbnail: hotSeatElijahThumb,
  },
  {
    title: 'ProfitX Workshop - Pay To Play™',
    category: 'Workshop',
    start: '2026-07-22T07:00:00',
    durationMins: 90,
    meetUrl: 'https://meet.google.com/juk-skti-xkr',
    description:
      'Pay To Play™ Workshop — Ads for yourself, ads for clients, tracking & metrics, reporting. Time zone: Australia/Brisbane. Join via Google Meet, or dial +61 2 9051 7711 PIN 718 677 495.',
    thumbnail: payToPlayThumb,
  },
  {
    title: 'ProfitX - Paid Ad Powerup™',
    category: 'Workshop',
    start: '2026-08-05T07:00:00',
    durationMins: 90,
    meetUrl: 'https://meet.google.com/nvk-msus-ciu',
    description:
      'Paid Ad Powerup™ Workshop — create some paid ads you want to run for yourself prior and bring them along to workshop and improve them together. Time zone: Australia/Brisbane. Join via Google Meet, or dial +61 2 9051 4385 PIN 896 755 264.',
  },
  {
    title: 'ProfitX - Organic Content Snowball™',
    category: 'Workshop',
    start: '2026-08-19T07:00:00',
    durationMins: 90,
    meetUrl: 'https://meet.google.com/sfx-eqyd-gkw',
    description:
      'Organic Content Snowball™ Workshop — key points TBA. Time zone: Australia/Brisbane. Join via Google Meet, or dial +61 2 9051 4914 PIN 510 348 311.',
  },
];

/**
 * Recurring Momentum Calls — Tuesdays 7:30–8:15am Brisbane.
 */
const MOMENTUM_DATES = [
  '2026-06-16',
  '2026-06-23',
  '2026-06-30',
  '2026-07-07',
  '2026-07-14',
  '2026-07-21',
  '2026-07-28',
  '2026-08-04',
  '2026-08-11',
  '2026-08-18',
  '2026-08-25',
];

const MOMENTUM_CALLS: Call[] = MOMENTUM_DATES.map((date) => ({
  title: 'ProfitX - Momentum Call™',
  category: 'Coaching',
  start: `${date}T07:30:00`,
  durationMins: 45,
  meetUrl: 'https://meet.google.com/szo-giha-ido',
  description:
    'Weekly Momentum Call. Time zone: Australia/Brisbane. Join via Google Meet, or dial +61 2 9051 6693 PIN 586 616 608.',
  thumbnail: momentumCallThumb,
}));

const ALL_CALLS: Call[] = [...CALLS, ...MOMENTUM_CALLS];

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

function brisbaneDateKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-AU', {
    timeZone: 'Australia/Brisbane',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

export default function Calls() {
  const todayBrisbane = brisbaneDateKey();
  const upcoming = [...ALL_CALLS]
    .filter((c) => c.start.slice(0, 10) >= todayBrisbane)
    .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

  return (
    <PageLayout>
      <div className="mb-6">
        <h1 className="text-3xl font-bold italic text-foreground">Upcoming Calls</h1>
        <p className="text-muted-foreground mt-1">
          Upcoming workshops, Q&amp;As and coaching calls — join live or add to your calendar.
        </p>
        <a
          href="https://calendar.google.com/calendar/u/0?cid=Y19lYmM5MWUxODUyYzgyMmEyMmYyNzZmODkzNDFiNjYzYmMwMmJkMmQ3OTMxZjE2Njc3NTA5NDExMTJlNzY3MmZlQGdyb3VwLmNhbGVuZGFyLmdvb2dsZS5jb20"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 mt-4 text-sm font-medium px-4 py-2.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          <CalendarPlus className="w-4 h-4" />
          Add ProfitX Calendar to Your Calendar
        </a>
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
              <div className="aspect-video rounded-lg overflow-hidden bg-gradient-to-br from-primary/20 via-primary/5 to-transparent border border-border flex items-center justify-center">
                {call.thumbnail ? (
                  <img src={call.thumbnail} alt={call.title} className="w-full h-full object-cover" />
                ) : (
                  <Video className="w-12 h-12 text-primary/80" />
                )}
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

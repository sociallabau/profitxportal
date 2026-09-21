import PageLayout from '@/components/PageLayout';
import { Card } from '@/components/ui/card';
import { Video, Calendar, ExternalLink, CalendarPlus } from 'lucide-react';
import { brisbaneDateKey, type Call } from '@/data/calls';
import { useUpcomingCalls } from '@/hooks/useUpcomingCalls';

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
  const todayBrisbane = brisbaneDateKey();
  const { calls: upcoming } = useUpcomingCalls();

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

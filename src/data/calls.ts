import smoothOperatorThumb from '@/assets/smooth-operator-thumb.png';
import momentumCallThumb from '@/assets/momentum-call-thumb.png';
import hotSeatElijahThumb from '@/assets/hot-seat-elijah-thumb.png';
import payToPlayThumb from '@/assets/pay-to-play-thumb.png';
import paidAdPowerupThumb from '@/assets/paid-ad-powerup-thumb.png';
import organicContentSnowballThumb from '@/assets/organic-content-snowball-thumb.png';

export type Call = {
  title: string;
  category: 'Workshop' | 'Q&A' | 'Coaching';
  /** For workshops: 'learn' = light blue, 'do' = orange. Alternates fortnightly. */
  workshopType?: 'learn' | 'do';
  /** ISO start datetime, Brisbane local time assumed (e.g. "2026-07-22T07:00:00") */
  start: string;
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
      'Smooth Operator™ Workshop. Time zone: Australia/Brisbane. Join via Google Meet.',
    thumbnail: smoothOperatorThumb,
  },
  {
    title: 'ProfitX - Hot Seat - Elijah Arnold (Director @ Social Lab)',
    category: 'Coaching',
    start: '2026-07-08T07:00:00',
    durationMins: 60,
    meetUrl: 'https://meet.google.com/kdn-nbhx-xce',
    description:
      'Hot Seat call with Elijah Arnold — Director @ Social Lab. Time zone: Australia/Brisbane.',
    thumbnail: hotSeatElijahThumb,
  },
  {
    title: 'ProfitX Workshop - Pay To Play™',
    category: 'Workshop',
    start: '2026-07-22T07:00:00',
    durationMins: 90,
    meetUrl: 'https://meet.google.com/juk-skti-xkr',
    description:
      'Pay To Play™ Workshop — Ads for yourself, ads for clients, tracking & metrics, reporting.',
    thumbnail: payToPlayThumb,
  },
  {
    title: 'ProfitX - Paid Ad Powerup™',
    category: 'Workshop',
    start: '2026-08-05T07:00:00',
    durationMins: 90,
    meetUrl: 'https://meet.google.com/nvk-msus-ciu',
    description:
      'Paid Ad Powerup™ Workshop — bring paid ads you want to run for yourself and improve them together.',
    thumbnail: paidAdPowerupThumb,
  },
  {
    title: 'ProfitX - Organic Content Snowball™',
    category: 'Workshop',
    start: '2026-08-19T07:00:00',
    durationMins: 90,
    meetUrl: 'https://meet.google.com/sfx-eqyd-gkw',
    description: 'Organic Content Snowball™ Workshop.',
    thumbnail: organicContentSnowballThumb,
  },
];

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
  description: 'Weekly Momentum Call. Time zone: Australia/Brisbane.',
  thumbnail: momentumCallThumb,
}));

export const ALL_CALLS: Call[] = [...CALLS, ...MOMENTUM_CALLS];

export function brisbaneDateKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-AU', {
    timeZone: 'Australia/Brisbane',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

export function getUpcomingCalls(limit?: number): Call[] {
  const today = brisbaneDateKey();
  const upcoming = ALL_CALLS.filter((c) => c.start.slice(0, 10) >= today).sort(
    (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime()
  );
  return limit ? upcoming.slice(0, limit) : upcoming;
}

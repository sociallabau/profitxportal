/**
 * Every recording in the Vault. The Vault page renders these, and Dan AI's
 * resource list and links are built from the same list, so add new sessions
 * here only.
 */

export type Template = { label: string; url: string };

export type VaultItem = {
  title: string;
  category: 'Q&A' | 'Workshop' | 'Lesson' | 'Momentum Call' | 'Hot Seat';
  date?: string;
  url?: string;
  /** Key into the Vault page's thumbnail map. */
  thumb: string;
  sortDate?: string;
  workbookUrl?: string;
  workbookLabel?: string;
  transcriptUrl?: string;
  transcriptLabel?: string;
  gptUrl?: string;
  gptLabel?: string;
  templates?: Template[];
};

export const VAULT_ITEMS: VaultItem[] = [
  {
    title: 'Momentum Call - Outsourced Video Editing Help + Breaking Down Limiting Beliefs',
    sortDate: '2026-10-27',
    category: 'Momentum Call',
    date: 'Oct 27',
    url: 'https://drive.google.com/file/d/1y4IQtcsbA4DHJ1MaRD47ZnheLhydLvPM/view?usp=sharing',
    thumb: 'vaultMomentumJun23',
    transcriptUrl: 'https://docs.google.com/document/d/1Drp_CGhetHMXJhU2xNv9DMa5G6UNn97jiR5s-Uz12sc/edit?usp=sharing',
    transcriptLabel: 'Notes',
  },
  {
    title: 'Workshop — Ad Metrics & Tracking 101™',
    sortDate: '2026-10-14',
    category: 'Workshop',
    date: 'Oct 14',
    url: 'https://drive.google.com/file/d/1wDK6YcLBI7mlDZCYjl8812XDtKNJ4iRB/view?usp=sharing',
    thumb: 'vaultAdMetrics101',
    transcriptUrl: 'https://docs.google.com/document/d/1h3yHNx-LdS8Z8t9adARu6pL4bmqRJrEMfcCw_Bdv-cA/edit?usp=sharing',
    transcriptLabel: 'Notes & Transcript',
    workbookUrl: 'https://messy-arrow-f59.notion.site/Ad-Metrics-Tracking-101-4d2bdcf32ce48286af2a811528d0cd25?source=copy_link',
    workbookLabel: 'Workbook',
    templates: [
      { label: 'Lead Tracker Template', url: 'https://docs.google.com/spreadsheets/d/1hjSAx0srg9jrmNW1Bm-7y5zTxZt7WwRE/edit?usp=sharing' },
    ],
  },
  {
    title: 'Momentum Call - Paid Ads, Offers',
    sortDate: '2026-10-13',
    category: 'Momentum Call',
    date: 'Oct 13',
    url: 'https://drive.google.com/file/d/1QubJB6IVOtYnQSyu0U3advGYqGkQ0F36/view?usp=sharing',
    thumb: 'vaultMomentumJun23',
    transcriptUrl: 'https://docs.google.com/document/d/1b1xNlvFKXMc5V1xZtrn80As0YqHbVMnMXQFiuvNY6cs/edit?usp=sharing',
    transcriptLabel: 'Summary',
  },
  {
    title: 'Workshop — The System™',
    sortDate: '2026-09-30',
    category: 'Workshop',
    date: 'Sep 30',
    url: 'https://drive.google.com/file/d/1n0G-elBO7EoGeElVGKUYprSFmCLGjE6k/view?usp=sharing',
    thumb: 'vaultTheSystem',
    transcriptUrl: 'https://docs.google.com/document/d/154VMVTAagqhy1Y2Dz0BwHLWIkw4dSp3GBaJ7jmC0R68/edit?usp=sharing',
    transcriptLabel: 'Notes & Transcript',
    workbookUrl: 'https://messy-arrow-f59.notion.site/The-System-3e8bdcf32ce480d29b58cb9f603349e6?source=copy_link',
    workbookLabel: 'Workbook',
  },
  {
    title: 'Hot Seat — Colby Shaw (Cognition Media)',
    sortDate: '2026-09-29',
    category: 'Hot Seat',
    date: 'Sep 29',
    thumb: 'hotSeatElijahThumb',
    url: 'https://drive.google.com/file/d/1W7Zvc_xSRvVrUuRROeK8UM9GKLPgzAKK/view?usp=sharing',
    transcriptUrl: 'https://docs.google.com/document/d/1r9R4hIkfRjyUNKOIaaSS9JtZNjfJbUzlifTJkjPQBT4/edit?usp=sharing',
    transcriptLabel: 'Notes & Transcript',
    workbookUrl: 'https://drive.google.com/file/d/1z0ryVLovj0dRG1qVTBW2rdpjUEtMGtcL/view?usp=sharing',
    workbookLabel: 'Chat Links',
  },
  {
    title: 'Momentum Call - Setting Up Lead Generation Ads, Ad Creatives etc...',
    sortDate: '2026-09-15',
    category: 'Momentum Call',
    date: 'Sep 15',
    url: 'https://drive.google.com/file/d/1ft16zC_6tWP4Y4gyhx01SDea4-tsebGx/view?usp=sharing',
    thumb: 'vaultMomentumJun23',
    workbookUrl: 'https://drive.google.com/file/d/1H8DSAbovxST0GwmXxjTgx7ahag2BQEAb/view?usp=sharing',
    workbookLabel: 'Chat Links',
    transcriptUrl: 'https://docs.google.com/document/d/1olHUYtlJulK-8g74g2AZOhqQtk2yEDDCwSjkxn6oIoE/edit?usp=sharing',
    transcriptLabel: 'Summary',
  },
  {
    title: 'Momentum Call',
    sortDate: '2026-08-31',
    category: 'Momentum Call',
    date: 'Aug 31',
    url: 'https://drive.google.com/file/d/1eG9R6QTOiOkhJDygeJb0auk8LrYxAmMT/view?usp=sharing',
    thumb: 'vaultMomentumJun23',
    transcriptUrl: 'https://docs.google.com/document/d/1UfgFvRlGadb-_kQscpE6k0Uo85-KehK-csiNxq0VItg/edit?usp=sharing',
    transcriptLabel: 'Notes',
  },
  {
    title: 'Momentum Call - Editing Team Building',
    sortDate: '2026-08-17',
    category: 'Momentum Call',
    url: 'https://drive.google.com/file/d/1fJwBGtiCMOBDNvd5WyEfI95Hq7l_diJf/view?usp=sharing',
    thumb: 'vaultMomentumEditingTeamBuilding',
    transcriptUrl: 'https://docs.google.com/document/d/1u-EAADftNxoKFIj5pGhah_eJGtvLK9e3Eii0L5QKxTA/edit?usp=sharing',
    transcriptLabel: 'Notes',
  },
  {
    title: 'Momentum Call - Agreements, Paid Ads, Hiring Editors',
    sortDate: '2026-08-10',
    category: 'Momentum Call',
    url: 'https://drive.google.com/file/d/1hYygX0ANWeI_4Wdcac4vKJtU2jW7adQB/view?usp=sharing',
    thumb: 'vaultMomentumPaidAds',
    transcriptUrl: 'https://docs.google.com/document/d/1HMz0IUUczCf6Jj7c-kqEmlEK3vz2luzWnfuTFUG5wAI/edit?usp=sharing',
    transcriptLabel: 'Notes',
  },
  {
    title: 'Momentum Call - Paid Ads Help',
    sortDate: '2026-07-28',
    category: 'Momentum Call',
    url: 'https://drive.google.com/file/d/12OC-POZS8tdv625XWVmsD-hWHbaRE690/view',
    thumb: 'vaultMomentumPaidAds',
    transcriptUrl: 'https://docs.google.com/document/d/1iqz8FemCgnmQASG6SVRe6jyWvjGg2ibi6Oy9N8UlDvA/edit?tab=t.3098yypf2lxi',
  },

  {
    title: 'Hot Seat — Elijah Arnold (Director @ Social Lab)',
    sortDate: '2026-07-08',
    category: 'Hot Seat',
    date: 'Jul 8',
    url: 'https://drive.google.com/file/d/135nNXlAhgg0mTkRYYx4Ih4P1ktKWWJ0X/view?usp=sharing',
    thumb: 'hotSeatElijahThumb',
    transcriptUrl: 'https://docs.google.com/document/d/1Thzxbdc9Ib3k2Vw0mxFZaPjwmy62IZJzkv5YMPltGx8/edit?usp=sharing',
    transcriptLabel: 'Summary',
    workbookUrl: 'https://drive.google.com/file/d/1RHX3xTT7F2TdpdTOgRcQgUxIRRpyNoU0/view?usp=sharing',
    workbookLabel: 'Chat notes',
  },

  {
    title: 'Momentum Call — Team Building, Hiring, Accountability & Expectations',
    sortDate: '2026-07-14',
    category: 'Momentum Call',
    url: 'https://drive.google.com/file/d/13zzS10OTydl8sJ-Fyo3_fA1KSvIHIPP6/view?usp=sharing',
    thumb: 'vaultMomentumTeamBuilding',
  },
  {
    title: 'Momentum Call — Paid Ads, Ad Creatives & Metrics',
    sortDate: '2026-06-23',
    category: 'Momentum Call',
    date: 'Jun 23',
    url: 'https://drive.google.com/file/d/1BKWdivnL93FX4wq6KQLQH3-fG46hGsWy/view?usp=sharing',
    thumb: 'vaultMomentumJun23',
    transcriptUrl: 'https://docs.google.com/document/d/1WGZDRGfcyVGUcfarTUSlKYBgTA6NP3JIh7G65hjLzL0/edit?usp=sharing',
  },
  {
    title: 'Q&A — June 10th',
    sortDate: '2026-06-10',
    category: 'Q&A',
    date: 'Jun 10',
    url: 'https://drive.google.com/file/d/1dgxq-QSDq60T_a-6MA9FGIozpl0gjgdq/view?usp=sharing',
    thumb: 'vaultQaJune',
    transcriptUrl: 'https://docs.google.com/document/d/1nnxYqHz9HpyN5tW9ZB9KUTyR521cjVFOJwQGqmxRhfM/edit?usp=sharing',
  },
  {
    title: 'Workshop — Pay To Play™',
    sortDate: '2026-07-22',
    category: 'Workshop',
    date: 'Jul 22',
    url: 'https://drive.google.com/file/d/1MZa8VCzbeSpIjyXzA3us7ZAH5enzBrcG/view?usp=sharing',
    thumb: 'payToPlayThumb',
    workbookUrl: 'https://drive.google.com/file/d/1coCIkrVQS99d9Wz8hLmPl1b6d1nzcn8F/view?usp=sharing',
    workbookLabel: 'Workbook (blank)',
    transcriptUrl: 'https://docs.google.com/document/d/1xt63AsqskPFQx3yDG0tLasAZKQsMQ16h-3dIeXMoqTY/edit?usp=sharing',
    templates: [
      { label: 'Workbook (worked example)', url: 'https://drive.google.com/file/d/175Yei1TzkI6k8xQiSKyAs7jP17swIBon/view?usp=sharing' },
      { label: 'Lead Tracker Template', url: 'https://docs.google.com/spreadsheets/d/1hjSAx0srg9jrmNW1Bm-7y5zTxZt7WwRE/edit?usp=sharing' },
    ],
  },
  {
    title: 'Workshop — Paid Ad Powerup™',
    sortDate: '2026-08-05',
    category: 'Workshop',
    date: 'Aug 5',
    url: 'https://drive.google.com/file/d/1pD_JKTFzN2GjyRE3gLvPtjzdsBAMoa6E/view?usp=sharing',
    thumb: 'vaultPaidAdPowerup',
    transcriptUrl: 'https://docs.google.com/document/d/1Ab6f9JWaXEP6yE5Jxi0JQPXFPA-cYlx6yuXFY4qyN3c/edit?usp=sharing',
    transcriptLabel: 'Notes',
    workbookUrl: 'https://ripe-age-78d.notion.site/FILMING-39cf13ad5f5d8014a528dd50a9178dbf',
    workbookLabel: 'Reference Script',
  },
  {
    title: 'Workshop — Organic Content Snowball™',
    sortDate: '2026-08-19',
    category: 'Workshop',
    date: 'Aug 19',
    url: 'https://drive.google.com/file/d/1JvminvG4kmCw2YW1ZN7a1sI62Skxbco3/view?usp=sharing',
    thumb: 'vaultOrganicContentSnowball',
    transcriptUrl: 'https://docs.google.com/document/d/1nlTj3kq6RPMVgurbq4QbwRmizavVOfC6XmtqMWM5B68/edit?usp=sharing',
    transcriptLabel: 'Notes',
    workbookUrl: 'https://messy-arrow-f59.notion.site/Organic-Content-Snowball-3c0bdcf32ce4800ebc8dede4ecf65f89?source=copy_link',
    workbookLabel: 'Workshop Workbook',
    templates: [
      { label: 'Social Lab Planner', url: 'https://ripe-age-78d.notion.site/Social-Lab-Content-Plan-3c0f13ad5f5d809ea9d9d29be7b58c7b' },
    ],
  },
  {
    title: 'Workshop — Delivery Magic™',
    sortDate: '2026-09-16',
    category: 'Workshop',
    date: 'Sep 16',
    url: 'https://drive.google.com/file/d/1nGibPK7u5Xs7lQ9sMupiToaniG3dPWYI/view?usp=sharing',
    thumb: 'vaultDeliveryMagic',
    transcriptUrl: 'https://docs.google.com/document/d/18Lmqd5MUIRaz42CHcd5YhhFCKNlOMzwye_fOxF81wq4/edit?usp=sharing',
    transcriptLabel: 'Notes',
    workbookUrl: 'https://messy-arrow-f59.notion.site/Delivery-Magic-3dcbdcf32ce4803a9b62f55d304b5aa7?source=copy_link',
    workbookLabel: 'Workshop Workbook',
    templates: [
      { label: 'Basic Template', url: 'https://ripe-age-78d.notion.site/NEW-TEMPLATE-Basic-2e1f13ad5f5d81a8b1dbde7eef2b93cc?source=copy_link' },
      { label: 'Template Doc', url: 'https://drive.google.com/file/d/1OMa_0bn46bAHwN6iWhcQbOP20vP8BawR/view?usp=sharing' },
      { label: 'Tracking Spreadsheet', url: 'https://docs.google.com/spreadsheets/d/1YUXXh8SEOAwVLwSArFuv9t9zkyRaOyvH66m7DO-1WWs/edit?usp=sharing' },
    ],
  },
  {
    title: 'Workshop — Spring Planning™ + Editing Flow',
    sortDate: '2026-09-02',
    category: 'Workshop',
    date: 'Sep 2',
    url: 'https://drive.google.com/file/d/1V8ws2rkSoxfd6PeHGERqlFg2yP3hv6ps/view?usp=sharing',
    thumb: 'vaultSpringPlanning',
    transcriptUrl: 'https://docs.google.com/document/d/1Ixi4c7ePysoE5Q1-I8lmx683VdWLMSiWx7ibnvh3AWs/edit?usp=sharing',
    transcriptLabel: 'Notes',
    workbookUrl: 'https://messy-arrow-f59.notion.site/Spring-Planning-3cabdcf32ce48049a791ed93d41acfba?source=copy_link',
    workbookLabel: 'Workshop Workbook',
  },
  {
    title: 'Workshop — Smooth Operator™',
    sortDate: '2026-06-17',
    category: 'Workshop',
    url: 'https://drive.google.com/file/d/1gL1dwbaRYRkPNfKGwUGLKB4MQtLMlj4G/view?usp=sharing',
    thumb: 'vaultContentStrategy',
    workbookUrl: 'https://drive.google.com/file/d/1sVIsKqFUE5L1zVDsZ2rBPV-8KhnZ9yOU/view?usp=sharing',
    transcriptUrl: 'https://docs.google.com/document/d/1BnNkY-G22_N2dOBXi-T-9YRwIUqA1Gqypi0kO_qKFI8/edit?usp=sharing',
    gptUrl: 'https://chatgpt.com/g/g-6a30873896388191b5615dc3b54654c0-content-strategy-mapper',
    gptLabel: 'Strategy Session GPT',
  },
  {
    title: 'Workshop — Profit By Design™',
    sortDate: '2026-05-27',
    category: 'Workshop',
    date: 'May 27',
    url: 'https://fathom.video/share/eszuA_bGgedERbyHpaVHWpp2jQ1zyfsr',
    thumb: 'vaultProfitByDesign',
    workbookUrl: 'https://drive.google.com/file/d/1gFwRMipbuberV3xdo5ikR7UpD4ia-xy9/view?usp=sharing',
    templates: [
      { label: 'Full Detailed P&L Template', url: 'https://docs.google.com/spreadsheets/d/1D1DUaFonfb2ti6QqGRf3em9GrPicguEyASx_uq-B8po/edit?usp=sharing' },
      { label: 'Client Profitability Calculator', url: 'https://docs.google.com/spreadsheets/d/1ZBn-liGJHSG1v9mASUS6gWuSu6vne-bCzmfyR0mNPRg/edit?usp=sharing' },
    ],
  },
  {
    title: 'Q&A — May 13th',
    sortDate: '2026-05-13',
    category: 'Q&A',
    date: 'May 13',
    url: 'https://fathom.video/share/PGSbzCgBaxAVwbQa8Ra_TdGUr3Ba75LR',
    thumb: 'vaultQaMay',
  },
  {
    title: 'Lesson — Paid Advertising (Meta Ads)',
    sortDate: '2026-04-01',
    category: 'Lesson',
    url: 'https://fathom.video/share/Py4yTENtyK8bmzL7tg6H3Qsd5_GbE63f',
    thumb: 'vaultPaidAds',
    workbookUrl: 'https://messy-arrow-f59.notion.site/Paid-Ads-Workshop-Resources-Workbooks-34fbdcf32ce4816bb7dde01b4933d0fb?source=copy_link',
  },
  {
    title: 'Q&A — April 14th',
    sortDate: '2026-04-14',
    category: 'Q&A',
    date: 'Apr 14',
    url: 'https://fathom.video/share/fNxXUxTxAaazuGGzzdSocVzQ_JmqKmFm',
    thumb: 'vaultQaApril',
  },
  {
    title: 'Lesson — Organic Content Flow',
    sortDate: '2026-03-01',
    category: 'Lesson',
    url: 'https://fathom.video/share/DcMunbGJxo_LVJ3kUveZHXqCgCm7UsTc',
    thumb: 'vaultOrganic',
    workbookUrl: 'https://messy-arrow-f59.notion.site/Traffic-Engine-Workshop-Resources-32dbdcf32ce480e0abd8fa3e9b587b67?source=copy_link',
  },
  {
    title: 'Q&A — March 18th',
    sortDate: '2026-03-18',
    category: 'Q&A',
    date: 'Mar 18',
    url: 'https://fathom.video/share/cxFvsiwisUVxLfxqN_edSJC7XjXysuWb',
    thumb: 'vaultQaMarch',
  },
];

/** The Drive file id in a recording's link, if it lives on Drive. */
export function driveFileId(url?: string): string | null {
  return url?.match(/drive\.google\.com\/file\/d\/([\w-]+)/)?.[1] ?? null;
}

/** The Fathom share token of a Fathom link. */
export function fathomToken(url?: string): string | null {
  return url?.match(/fathom\.video\/share\/([\w-]+)/)?.[1] ?? null;
}

/** Host and page id of a public Notion workbook link. */
export function notionPage(url?: string): { host: string; id: string } | null {
  const m = url?.match(/^https:\/\/([\w-]+\.notion\.site)\/(?:[^?]*-)?([0-9a-f]{32})/);
  return m ? { host: m[1], id: m[2] } : null;
}

/**
 * Every file behind each Vault entry, for Dan AI's knowledge sync. The edge
 * functions can't import from src, so this is written to
 * supabase/functions/_shared/vaultFiles.ts (a test keeps the two identical).
 */
export function vaultFiles() {
  return VAULT_ITEMS.map(v => {
    const links = [v.url, v.transcriptUrl, v.workbookUrl, ...(v.templates ?? []).map(t => t.url)];
    return {
      title: v.title,
      date: v.sortDate ?? null,
      drive: [v.url, v.transcriptUrl, v.workbookUrl].map(driveId).filter((x): x is string => !!x),
      fathom: links.map(fathomToken).filter((x): x is string => !!x),
      notion: [v.workbookUrl].map(notionPage).filter((x): x is { host: string; id: string } => !!x),
    };
  });
}

/** The Drive id of a Drive file or Google Doc link (recording, notes, transcript or workbook). */
export function driveId(url?: string): string | null {
  return url?.match(/(?:drive\.google\.com\/file\/d|docs\.google\.com\/(?:document|spreadsheets|presentation)\/d)\/([\w-]+)/)?.[1] ?? null;
}

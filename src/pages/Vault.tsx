import PageLayout from '@/components/PageLayout';
import { Card } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { PlayCircle, ExternalLink, BookOpen, FileSpreadsheet, FileText, ChevronDown, Sparkles } from 'lucide-react';

import vaultQaMarch from '@/assets/vault-qa-march.jpg';
import vaultOrganic from '@/assets/vault-organic-content.jpg';
import vaultQaApril from '@/assets/vault-qa-april.jpg';
import vaultPaidAds from '@/assets/vault-paid-ads.jpg';
import vaultQaMay from '@/assets/vault-qa-may.jpg';
import vaultQaJune from '@/assets/vault-qa-june.jpg';
import vaultMomentumPaidAds from '@/assets/vault-momentum-paid-ads.jpg';
import vaultProfitByDesign from '@/assets/vault-profit-by-design.jpg';
import vaultMomentumJun23 from '@/assets/vault-momentum-jun23.jpg';
import vaultMomentumTeamBuilding from '@/assets/vault-momentum-team-building.jpg';
import vaultContentStrategy from '@/assets/vault-workshop-content-strategy.jpg';
import hotSeatElijahThumb from '@/assets/hot-seat-elijah-thumb.png';
import payToPlayThumb from '@/assets/pay-to-play-thumb.png';

type Template = { label: string; url: string };

type VaultItem = {
  title: string;
  category: 'Q&A' | 'Workshop' | 'Lesson' | 'Momentum Call' | 'Hot Seat';
  date?: string;
  url: string;
  thumbnail: string;
  workbookUrl?: string;
  workbookLabel?: string;
  transcriptUrl?: string;
  transcriptLabel?: string;
  gptUrl?: string;
  gptLabel?: string;
  templates?: Template[];
};

const ITEMS: VaultItem[] = [
  {
    title: 'Momentum Call — Latest',
    category: 'Momentum Call',
    url: 'https://drive.google.com/file/d/12OC-POZS8tdv625XWVmsD-hWHbaRE690/view',
    thumbnail: vaultMomentumTeamBuilding,
    transcriptUrl: 'https://docs.google.com/document/d/1iqz8FemCgnmQASG6SVRe6jyWvjGg2ibi6Oy9N8UlDvA/edit?tab=t.3098yypf2lxi',
  },
  {
    title: 'Hot Seat — Elijah Arnold (Director @ Social Lab)',
    category: 'Hot Seat',
    date: 'Jul 8',
    url: 'https://drive.google.com/file/d/135nNXlAhgg0mTkRYYx4Ih4P1ktKWWJ0X/view?usp=sharing',
    thumbnail: hotSeatElijahThumb,
    transcriptUrl: 'https://docs.google.com/document/d/1Thzxbdc9Ib3k2Vw0mxFZaPjwmy62IZJzkv5YMPltGx8/edit?usp=sharing',
    transcriptLabel: 'Summary',
    workbookUrl: 'https://drive.google.com/file/d/1RHX3xTT7F2TdpdTOgRcQgUxIRRpyNoU0/view?usp=sharing',
    workbookLabel: 'Chat notes',
  },

  {
    title: 'Momentum Call — Team Building, Hiring, Accountability & Expectations',
    category: 'Momentum Call',
    url: 'https://drive.google.com/file/d/13zzS10OTydl8sJ-Fyo3_fA1KSvIHIPP6/view?usp=sharing',
    thumbnail: vaultMomentumTeamBuilding,
  },
  {
    title: 'Momentum Call — Paid Ads, Ad Creatives & Metrics',
    category: 'Momentum Call',
    date: 'Jun 23',
    url: 'https://drive.google.com/file/d/1BKWdivnL93FX4wq6KQLQH3-fG46hGsWy/view?usp=sharing',
    thumbnail: vaultMomentumJun23,
    transcriptUrl: 'https://docs.google.com/document/d/1WGZDRGfcyVGUcfarTUSlKYBgTA6NP3JIh7G65hjLzL0/edit?usp=sharing',
  },
  {
    title: 'Q&A — June 10th',
    category: 'Q&A',
    date: 'Jun 10',
    url: 'https://drive.google.com/file/d/1dgxq-QSDq60T_a-6MA9FGIozpl0gjgdq/view?usp=sharing',
    thumbnail: vaultQaJune,
    transcriptUrl: 'https://docs.google.com/document/d/1nnxYqHz9HpyN5tW9ZB9KUTyR521cjVFOJwQGqmxRhfM/edit?usp=sharing',
  },
  {
    title: 'Workshop — Pay To Play™',
    category: 'Workshop',
    date: 'Jul 22',
    url: 'https://drive.google.com/file/d/1MZa8VCzbeSpIjyXzA3us7ZAH5enzBrcG/view?usp=sharing',
    thumbnail: payToPlayThumb,
    workbookUrl: 'https://drive.google.com/file/d/1coCIkrVQS99d9Wz8hLmPl1b6d1nzcn8F/view?usp=sharing',
    workbookLabel: 'Workbook (blank)',
    transcriptUrl: 'https://docs.google.com/document/d/1xt63AsqskPFQx3yDG0tLasAZKQsMQ16h-3dIeXMoqTY/edit?usp=sharing',
    templates: [
      { label: 'Workbook (worked example)', url: 'https://drive.google.com/file/d/175Yei1TzkI6k8xQiSKyAs7jP17swIBon/view?usp=sharing' },
      { label: 'Lead Tracker Template', url: 'https://docs.google.com/spreadsheets/d/1hjSAx0srg9jrmNW1Bm-7y5zTxZt7WwRE/edit?usp=sharing' },
    ],
  },
  {
    title: 'Workshop — Smooth Operator™',
    category: 'Workshop',
    url: 'https://drive.google.com/file/d/1gL1dwbaRYRkPNfKGwUGLKB4MQtLMlj4G/view?usp=sharing',
    thumbnail: vaultContentStrategy,
    workbookUrl: 'https://drive.google.com/file/d/1sVIsKqFUE5L1zVDsZ2rBPV-8KhnZ9yOU/view?usp=sharing',
    transcriptUrl: 'https://docs.google.com/document/d/1BnNkY-G22_N2dOBXi-T-9YRwIUqA1Gqypi0kO_qKFI8/edit?usp=sharing',
    gptUrl: 'https://chatgpt.com/g/g-6a30873896388191b5615dc3b54654c0-content-strategy-mapper',
    gptLabel: 'Strategy Session GPT',
  },
  {
    title: 'Workshop — Profit By Design™',
    category: 'Workshop',
    date: 'May 27',
    url: 'https://fathom.video/share/eszuA_bGgedERbyHpaVHWpp2jQ1zyfsr',
    thumbnail: vaultProfitByDesign,
    workbookUrl: 'https://drive.google.com/file/d/1gFwRMipbuberV3xdo5ikR7UpD4ia-xy9/view?usp=sharing',
    templates: [
      { label: 'Full Detailed P&L Template', url: 'https://docs.google.com/spreadsheets/d/1D1DUaFonfb2ti6QqGRf3em9GrPicguEyASx_uq-B8po/edit?usp=sharing' },
      { label: 'Client Profitability Calculator', url: 'https://docs.google.com/spreadsheets/d/1ZBn-liGJHSG1v9mASUS6gWuSu6vne-bCzmfyR0mNPRg/edit?usp=sharing' },
    ],
  },
  {
    title: 'Q&A — May 13th',
    category: 'Q&A',
    date: 'May 13',
    url: 'https://fathom.video/share/PGSbzCgBaxAVwbQa8Ra_TdGUr3Ba75LR',
    thumbnail: vaultQaMay,
  },
  {
    title: 'Lesson — Paid Advertising (Meta Ads)',
    category: 'Lesson',
    url: 'https://fathom.video/share/Py4yTENtyK8bmzL7tg6H3Qsd5_GbE63f',
    thumbnail: vaultPaidAds,
    workbookUrl: 'https://messy-arrow-f59.notion.site/Paid-Ads-Workshop-Resources-Workbooks-34fbdcf32ce4816bb7dde01b4933d0fb?source=copy_link',
  },
  {
    title: 'Q&A — April 14th',
    category: 'Q&A',
    date: 'Apr 14',
    url: 'https://fathom.video/share/fNxXUxTxAaazuGGzzdSocVzQ_JmqKmFm',
    thumbnail: vaultQaApril,
  },
  {
    title: 'Lesson — Organic Content Flow',
    category: 'Lesson',
    url: 'https://fathom.video/share/DcMunbGJxo_LVJ3kUveZHXqCgCm7UsTc',
    thumbnail: vaultOrganic,
    workbookUrl: 'https://messy-arrow-f59.notion.site/Traffic-Engine-Workshop-Resources-32dbdcf32ce480e0abd8fa3e9b587b67?source=copy_link',
  },
  {
    title: 'Q&A — March 18th',
    category: 'Q&A',
    date: 'Mar 18',
    url: 'https://fathom.video/share/cxFvsiwisUVxLfxqN_edSJC7XjXysuWb',
    thumbnail: vaultQaMarch,
  },
];

const categoryStyles: Record<VaultItem['category'], string> = {
  'Q&A': 'bg-primary/15 text-primary border-primary/30',
  Workshop: 'bg-warning/15 text-warning border-warning/30',
  Lesson: 'bg-success/15 text-success border-success/30',
  'Momentum Call': 'bg-accent/15 text-accent-foreground border-accent/40',
  'Hot Seat': 'bg-destructive/15 text-destructive border-destructive/30',
};

const SECTIONS: { heading: string; categories: VaultItem['category'][] }[] = [
  { heading: 'Momentum Calls', categories: ['Momentum Call'] },
  { heading: 'Hot Seat', categories: ['Hot Seat'] },
  { heading: 'Q&A Calls', categories: ['Q&A'] },
  { heading: 'Workshops', categories: ['Workshop', 'Lesson'] },
];


export default function Vault() {
  return (
    <PageLayout>
      <div className="mb-6">
        <h1 className="text-3xl font-bold italic text-foreground">Vault</h1>
        <p className="text-muted-foreground mt-1">Recordings of momentum calls, Q&As and workshops — watch any time.</p>
      </div>
      <div className="flex flex-col gap-10">
        {SECTIONS.map((section) => {
          const items = ITEMS.filter((i) => section.categories.includes(i.category));
          if (items.length === 0) return null;
          return (
            <Collapsible key={section.heading} defaultOpen>
              <section>
                <CollapsibleTrigger className="group flex items-center gap-2 w-full text-left mb-4">
                  <h2 className="text-xl font-bold text-foreground">{section.heading}</h2>
                  <span className="text-xs text-muted-foreground">({items.length})</span>
                  <ChevronDown className="w-5 h-5 text-muted-foreground transition-transform group-data-[state=closed]:-rotate-90" />
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {items.map((item) => (
                      <Card
                        key={item.url}
                        className="h-full overflow-hidden hover:border-primary/50 hover:shadow-md hover:shadow-primary/10 transition-all flex flex-col group"
                      >
                        <a href={item.url} target="_blank" rel="noopener noreferrer" className="block">
                          <div className="relative aspect-video overflow-hidden bg-muted">
                            <img
                              src={item.thumbnail}
                              alt={item.title}
                              width={1024}
                              height={576}
                              loading="lazy"
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            />
                            <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                              <PlayCircle className="w-14 h-14 text-white drop-shadow-lg" />
                            </div>
                          </div>
                        </a>
                        <div className="p-5 flex flex-col gap-2 flex-1">
                          <div className="flex items-center gap-2">
                            <span
                              className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full border ${categoryStyles[item.category]}`}
                            >
                              {item.category}
                            </span>
                            {item.date && (
                              <span className="text-xs text-muted-foreground">{item.date}</span>
                            )}
                          </div>
                          <h3 className="font-semibold text-foreground leading-snug">{item.title}</h3>
                          <div className="mt-auto pt-2 flex flex-col gap-1.5">
                            <a
                              href={item.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors"
                            >
                              <ExternalLink className="w-3 h-3" />
                              {item.url.includes('drive.google.com') ? 'Watch recording' : 'Watch on Fathom'}
                            </a>
                            {item.workbookUrl && (
                              <a
                                href={item.workbookUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors"
                              >
                                <BookOpen className="w-3 h-3" />
                                {item.workbookLabel ?? 'Workbook'}
                              </a>
                            )}
                            {item.transcriptUrl && (
                              <a
                                href={item.transcriptUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors"
                              >
                                <FileText className="w-3 h-3" />
                                {item.transcriptLabel ?? 'Transcript & summary'}
                              </a>
                            )}
                            {item.gptUrl && (
                              <a
                                href={item.gptUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors"
                              >
                                <Sparkles className="w-3 h-3" />
                                {item.gptLabel ?? 'Custom GPT'}
                              </a>
                            )}
                            {item.templates && item.templates.length > 0 && (
                              <div className="pt-1.5 mt-1 border-t border-border/50 flex flex-col gap-1.5">
                                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/80">Templates</span>
                                {item.templates.map((tpl) => (
                                  <a
                                    key={tpl.url}
                                    href={tpl.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors"
                                  >
                                    <FileSpreadsheet className="w-3 h-3" />
                                    {tpl.label}
                                  </a>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                </CollapsibleContent>
              </section>
            </Collapsible>

          );
        })}
      </div>
    </PageLayout>
  );
}


import PageLayout from '@/components/PageLayout';
import { Card } from '@/components/ui/card';
import { PlayCircle, ExternalLink } from 'lucide-react';

type VaultItem = {
  title: string;
  category: 'Q&A' | 'Workshop' | 'Lesson';
  date?: string;
  url: string;
};

const ITEMS: VaultItem[] = [
  {
    title: 'Q&A — March 18th',
    category: 'Q&A',
    date: 'Mar 18',
    url: 'https://fathom.video/share/cxFvsiwisUVxLfxqN_edSJC7XjXysuWb',
  },
  {
    title: 'Lesson — Organic Content Flow',
    category: 'Lesson',
    url: 'https://fathom.video/share/DcMunbGJxo_LVJ3kUveZHXqCgCm7UsTc',
  },
  {
    title: 'Q&A — April 14th',
    category: 'Q&A',
    date: 'Apr 14',
    url: 'https://fathom.video/share/fNxXUxTxAaazuGGzzdSocVzQ_JmqKmFm',
  },
];

const categoryStyles: Record<VaultItem['category'], string> = {
  'Q&A': 'bg-primary/15 text-primary border-primary/30',
  Workshop: 'bg-warning/15 text-warning border-warning/30',
  Lesson: 'bg-success/15 text-success border-success/30',
};

export default function Vault() {
  return (
    <PageLayout>
      <div className="mb-6">
        <h1 className="text-3xl font-bold italic text-foreground">Vault</h1>
        <p className="text-muted-foreground mt-1">Recordings of Q&As, workshops and lessons — watch any time.</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {ITEMS.map((item) => (
          <a
            key={item.url}
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="group"
          >
            <Card className="h-full p-5 hover:border-primary/50 hover:shadow-md hover:shadow-primary/10 transition-all flex flex-col gap-4">
              <div className="aspect-video rounded-lg bg-gradient-to-br from-primary/20 via-primary/5 to-transparent border border-border flex items-center justify-center">
                <PlayCircle className="w-12 h-12 text-primary/80 group-hover:scale-110 transition-transform" />
              </div>
              <div className="flex flex-col gap-2">
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
                <h3 className="font-semibold text-foreground leading-snug">
                  {item.title}
                </h3>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground group-hover:text-primary transition-colors">
                  <ExternalLink className="w-3 h-3" />
                  Watch on Fathom
                </div>
              </div>
            </Card>
          </a>
        ))}
      </div>
    </PageLayout>
  );
}

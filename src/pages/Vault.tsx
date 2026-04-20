import PageLayout from '@/components/PageLayout';
import { Card } from '@/components/ui/card';
import { PlayCircle, ExternalLink } from 'lucide-react';
import vaultQaMarch from '@/assets/vault-qa-march.jpg';
import vaultOrganic from '@/assets/vault-organic-content.jpg';
import vaultQaApril from '@/assets/vault-qa-april.jpg';

type VaultItem = {
  title: string;
  category: 'Q&A' | 'Workshop' | 'Lesson';
  date?: string;
  url: string;
  thumbnail: string;
};

const ITEMS: VaultItem[] = [
  {
    title: 'Q&A — March 18th',
    category: 'Q&A',
    date: 'Mar 18',
    url: 'https://fathom.video/share/cxFvsiwisUVxLfxqN_edSJC7XjXysuWb',
    thumbnail: vaultQaMarch,
  },
  {
    title: 'Lesson — Organic Content Flow',
    category: 'Lesson',
    url: 'https://fathom.video/share/DcMunbGJxo_LVJ3kUveZHXqCgCm7UsTc',
    thumbnail: vaultOrganic,
  },
  {
    title: 'Q&A — April 14th',
    category: 'Q&A',
    date: 'Apr 14',
    url: 'https://fathom.video/share/fNxXUxTxAaazuGGzzdSocVzQ_JmqKmFm',
    thumbnail: vaultQaApril,
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
            <Card className="h-full overflow-hidden hover:border-primary/50 hover:shadow-md hover:shadow-primary/10 transition-all flex flex-col">
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
              <div className="p-5 flex flex-col gap-2">
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

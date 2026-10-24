// Renders module_pages.sections. One renderer for the module page and the Cash Menu
// dialog, so a module looks the same wherever it opens.
import { useState } from 'react';
import { CheckCircle2, Circle, Lightbulb, Link as LinkIcon, ChevronRight, Play } from 'lucide-react';
import moduleCoverC2 from '@/assets/module-cover-stupidly-simple-ad.jpg';
import moduleCoverC1 from '@/assets/module-cover-5ps-framework.jpg';

export const PILLAR_COLORS: Record<string, { accent: string; bg: string; border: string }> = {
  build: { accent: 'text-blue-600', bg: 'bg-blue-500/10', border: 'border-blue-500/30' },
  traffic: { accent: 'text-primary', bg: 'bg-primary/10', border: 'border-primary/30' },
  sales: { accent: 'text-primary', bg: 'bg-purple-500/10', border: 'border-purple-500/30' },
  scale: { accent: 'text-orange-600', bg: 'bg-orange-500/10', border: 'border-orange-500/30' },
  offer: { accent: 'text-primary', bg: 'bg-primary/10', border: 'border-primary/30' },
  clients: { accent: 'text-primary', bg: 'bg-primary/10', border: 'border-primary/30' },
  delivery: { accent: 'text-primary', bg: 'bg-primary/10', border: 'border-primary/30' },
};

const SECTION_NUMBERS = ['①', '②', '③', '④'];

/** One content block. Content is admin-authored JSON, so every field is optional. */
export interface SectionBlock {
  type: string;
  number?: number | string;
  label?: string;
  title?: string;
  text?: string;
  url?: string;
  poster?: string;
  items?: unknown;
  steps?: unknown;
}
type ItemObject = { id?: string | number; emoji?: string; bold?: string; text?: string; title?: string; label?: string };
type SectionItem = string | ItemObject;

const asArray = (value: unknown): SectionItem[] => (Array.isArray(value) ? value : []);
const asObject = (item: SectionItem): ItemObject => (typeof item === 'string' ? { text: item } : item ?? {});

const itemText = (item: SectionItem): string => {
  const o = asObject(item);
  return o.text ?? o.title ?? o.label ?? '';
};

const POSTER_MAP: Record<string, string> = {
  'module-cover-stupidly-simple-ad': moduleCoverC2,
  'module-cover-5ps-framework': moduleCoverC1,
};

function VideoEmbed({ section }: { section: SectionBlock }) {
  const [playing, setPlaying] = useState(false);
  const url: string = section.url || '';
  const loomMatch = url.match(/loom\.com\/(?:share|embed)\/([a-zA-Z0-9]+)/);
  const driveMatch = url.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/);
  const driveOpenMatch = !driveMatch ? url.match(/drive\.google\.com\/open\?id=([a-zA-Z0-9_-]+)/) : null;
  const youtubeMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]+)/);
  let embedUrl = url;
  if (loomMatch) embedUrl = `https://www.loom.com/embed/${loomMatch[1]}`;
  else if (driveMatch) embedUrl = `https://drive.google.com/file/d/${driveMatch[1]}/preview`;
  else if (driveOpenMatch) embedUrl = `https://drive.google.com/file/d/${driveOpenMatch[1]}/preview`;
  else if (youtubeMatch) embedUrl = `https://www.youtube.com/embed/${youtubeMatch[1]}`;

  const posterSrc = section.poster ? POSTER_MAP[section.poster] : undefined;

  if (posterSrc && !playing) {
    return (
      <div className="space-y-2">
        <div
          className="relative w-full overflow-hidden rounded-xl border border-border cursor-pointer group bg-black"
          style={{ paddingTop: '56.25%' }}
          onClick={() => setPlaying(true)}
        >
          <img src={posterSrc} alt={section.title || 'Video cover'} className="absolute inset-0 w-full h-full object-cover" />
          <div className="absolute inset-0 bg-black/20 group-hover:bg-black/30 transition-colors" />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-16 h-16 rounded-full bg-primary/90 flex items-center justify-center group-hover:scale-110 transition-transform shadow-lg">
              <Play className="w-6 h-6 text-primary-foreground ml-1" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="relative w-full overflow-hidden rounded-xl border border-border bg-black" style={{ paddingTop: '56.25%' }}>
        <iframe
          src={embedUrl}
          title={section.title || 'Module video'}
          allowFullScreen
          allow="autoplay; encrypted-media"
          className="absolute inset-0 h-full w-full"
        />
      </div>
    </div>
  );
}

export function RenderSection({
  section,
  colors,
  moduleId,
  completionMap,
  onToggle,
}: {
  section: SectionBlock;
  colors: { accent: string; bg: string; border: string };
  moduleId: string;
  completionMap: Record<string, boolean>;
  onToggle: (taskKey: string, current: boolean) => void;
}) {
  switch (section.type) {
    case 'section_header':
      return (
        <div className="flex items-center gap-3 pt-6 first:pt-0">
          <span className={`text-2xl font-bold ${colors.accent}`}>
            {section.number ? SECTION_NUMBERS[Number(section.number) - 1] || section.number : null}
          </span>
          <span className={`text-xs font-bold tracking-[0.3em] uppercase ${colors.accent}`}>
            {section.label || section.title}
          </span>
          <div className={`flex-1 h-px ${colors.bg}`} />
        </div>
      );

    case 'heading':
      return <h2 className="text-xl font-bold">{section.text}</h2>;

    case 'video_embed': {
      return <VideoEmbed section={section} />;
    }

    case 'paragraph':
      return <p className="text-sm text-muted-foreground leading-relaxed">{section.text}</p>;

    case 'callout':
      return (
        <div className={`rounded-xl border ${colors.border} ${colors.bg} p-4`}>
          {section.title && <p className="text-sm font-bold mb-2">{section.title}</p>}
          {section.text && (
            <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
              {section.text}
            </p>
          )}
          {section.items && (
            <ul className="mt-2 space-y-1.5">
              {asArray(section.items).map((item, j) => (
                <li key={j} className="text-sm text-muted-foreground flex items-start gap-2">
                  <span className={`mt-1.5 w-1.5 h-1.5 rounded-full ${colors.accent} bg-current shrink-0`} />
                  {itemText(item)}
                </li>
              ))}
            </ul>
          )}
        </div>
      );

    case 'bullet_list':
      return (
        <ul className="space-y-3">
          {asArray(section.items).map(asObject).map((item, j) => (
            <li key={j} className="flex items-start gap-3 text-sm">
              {item.emoji && <span className="text-lg shrink-0">{item.emoji}</span>}
              <div>
                {item.bold && <span className="font-semibold text-foreground">{item.bold}</span>}
                {item.text && <span className="text-muted-foreground"> {item.text}</span>}
              </div>
            </li>
          ))}
        </ul>
      );

    case 'numbered_steps': {
      const numberedItems = asArray(section.items ?? section.steps);
      return (
        <div className="space-y-4">
          {numberedItems.map((step, j) => (
            <div key={j} className="bg-card border border-border rounded-xl p-4">
              <div className="flex items-start gap-3">
                <span className={`shrink-0 w-7 h-7 rounded-full ${colors.bg} ${colors.accent} flex items-center justify-center text-xs font-bold`}>
                  {j + 1}
                </span>
                <div className="min-w-0">
                  {asObject(step).title && <p className="text-sm font-bold">{asObject(step).title}</p>}
                  <p className="text-sm text-muted-foreground mt-1 leading-relaxed whitespace-pre-line">
                    {itemText(step)}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      );
    }

    case 'pro_tip':
      return (
        <div className="rounded-xl border border-warning/30 bg-warning/5 p-4 flex items-start gap-3">
          <Lightbulb className="w-5 h-5 text-warning shrink-0 mt-0.5" />
          <p className="text-sm text-muted-foreground leading-relaxed">{section.text}</p>
        </div>
      );

    case 'action_checklist': {
      const checklistItems = asArray(section.items);
      return (
        <div className="bg-card border border-border rounded-xl p-4 space-y-3">
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Action Checklist</p>
          {checklistItems.map((item, index) => {
            const text = itemText(item);
            const id = asObject(item).id ?? index;
            const taskKey = `module:${moduleId}:${id}`;
            const checked = !!completionMap[taskKey];
            return (
              <button
                key={id}
                onClick={() => onToggle(taskKey, checked)}
                className="flex items-center gap-3 w-full text-left group"
              >
                {checked ? (
                  <CheckCircle2 className="w-5 h-5 text-success shrink-0" />
                ) : (
                  <Circle className="w-5 h-5 text-muted-foreground/40 group-hover:text-primary/60 shrink-0" />
                )}
                <span className={`text-sm ${checked ? 'text-muted-foreground line-through' : 'text-foreground'}`}>
                  {text}
                </span>
              </button>
            );
          })}
        </div>
      );
    }

    case 'link_placeholder':
      return section.url ? (
        <LinkPlaceholderButton url={section.url} label={section.label ?? 'Open link'} />
      ) : (
        <div className="rounded-xl border border-dashed border-border p-4 flex items-center gap-3 opacity-60">
          <LinkIcon className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">{section.label}</span>
          <span className="text-xs text-muted-foreground/50 ml-auto">Link not added yet</span>
        </div>
      );

    case 'next_module':
      return (
        <div className="rounded-xl border border-border bg-card p-4 flex items-center gap-3">
          <ChevronRight className={`w-5 h-5 ${colors.accent}`} />
          <span className="text-sm font-semibold">{section.text}</span>
        </div>
      );

    default:
      return null;
  }
}

function getInstagramEmbedUrl(url: string): string | null {
  const m = url.match(/instagram\.com\/(p|reel|tv)\/([^/?#]+)/i);
  if (!m) return null;
  return `https://www.instagram.com/${m[1]}/${m[2]}/embed`;
}

function LinkPlaceholderButton({ url, label }: { url: string; label: string }) {
  const isPdf = /\.pdf($|\?)/i.test(url);
  const isInternal = url.startsWith('/');
  const instagramEmbed = getInstagramEmbedUrl(url);

  if (instagramEmbed) {
    return (
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="px-3 py-2 flex items-center justify-between gap-2 border-b border-border">
          <span className="text-xs font-semibold text-foreground truncate">{label}</span>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10px] uppercase tracking-wider text-primary hover:underline shrink-0"
          >
            Open ↗
          </a>
        </div>
        <iframe
          src={instagramEmbed}
          loading="lazy"
          allow="encrypted-media"
          allowFullScreen
          className="w-full bg-background"
          style={{ height: 540, border: 0 }}
          title={label}
        />
      </div>
    );
  }

  const handlePdfDownload = async (e: React.MouseEvent) => {
    e.preventDefault();
    try {
      const res = await fetch(url, { mode: 'cors' });
      if (!res.ok) throw new Error('fetch failed');
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const filename = (url.split('/').pop()?.split('?')[0]) || `${label || 'download'}.pdf`;
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
    } catch {
      // Fallback: open in new tab if fetch is blocked by CORS
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  if (isPdf) {
    return (
      <a
        href={url}
        onClick={handlePdfDownload}
        download
        className="flex items-center gap-1.5 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground px-3 py-1.5 text-xs font-semibold transition-colors"
      >
        <LinkIcon className="w-3.5 h-3.5" />
        {label}
      </a>
    );
  }

  if (!isInternal) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-1.5 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground px-3 py-1.5 text-xs font-semibold transition-colors"
      >
        <LinkIcon className="w-3.5 h-3.5" />
        {label}
      </a>
    );
  }

  return (
    <a
      href={url}
      className="flex items-center gap-1.5 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground px-3 py-1.5 text-xs font-semibold transition-colors"
    >
      <LinkIcon className="w-3.5 h-3.5" />
      {label}
    </a>
  );
}


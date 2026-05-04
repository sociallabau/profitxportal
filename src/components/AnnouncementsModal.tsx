import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Lock, Video, ClipboardList, Sparkles, Wand2 } from 'lucide-react';

type Announcement = {
  key: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  body: React.ReactNode;
  cta?: { label: string; path: string };
};

const ANNOUNCEMENTS: Announcement[] = [
  {
    key: 'announce_content_generator_v1',
    icon: Wand2,
    title: 'New: AI Content Generator',
    body: (
      <>
        A brand new <strong className="text-foreground">Content Generator</strong> is now live inside the <strong className="text-foreground">Content Studio</strong>. Generate Reel frameworks, Carousels and Lead Emails tailored to your business in seconds.
        <div className="mt-3 p-3 rounded-lg bg-primary/10 border border-primary/20">
          📲 Check <strong className="text-foreground">WhatsApp</strong> for the Loom walkthrough on how to use it.
        </div>
      </>
    ),
    cta: { label: 'Try it now', path: '/content-studio?tab=Content+Generator' },
  },
  {
    key: 'announce_vault_calls_v1',
    icon: Sparkles,
    title: '2 New Sections Added',
    body: (
      <>
        I've added two new areas to the portal:
        <ul className="mt-3 space-y-2">
          <li className="flex items-start gap-2">
            <Lock className="w-4 h-4 mt-0.5 text-primary shrink-0" />
            <span><strong className="text-foreground">Vault</strong> — recordings of all previous Q&amp;As, workshops and lessons.</span>
          </li>
          <li className="flex items-start gap-2">
            <Video className="w-4 h-4 mt-0.5 text-primary shrink-0" />
            <span><strong className="text-foreground">Upcoming Calls</strong> — every new call will be added here so you can join and add it to your calendar.</span>
          </li>
        </ul>
      </>
    ),
    cta: { label: 'Check out the Vault', path: '/vault' },
  },
  {
    key: 'announce_organic_output_v1',
    icon: ClipboardList,
    title: 'New: Track Your Organic Content Output',
    body: (
      <>
        Don't forget to enter your <strong className="text-foreground">organic content output</strong> in your monthly submission — it helps us track which content is driving leads and revenue for your business.
      </>
    ),
    cta: { label: 'Go to Monthly Submission', path: '/submissions/monthly' },
  },
];

export default function AnnouncementsModal() {
  const navigate = useNavigate();
  const [queue, setQueue] = useState<Announcement[]>([]);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const pending = ANNOUNCEMENTS.filter((a) => {
      try {
        return localStorage.getItem(a.key) !== '1';
      } catch {
        return false;
      }
    });
    if (pending.length) {
      setQueue(pending);
      setIndex(0);
    }
  }, []);

  if (!queue.length || index >= queue.length) return null;

  const current = queue[index];
  const Icon = current.icon;
  const isLast = index === queue.length - 1;

  const dismiss = () => {
    try {
      localStorage.setItem(current.key, '1');
    } catch {
      // ignore
    }
    if (isLast) {
      setQueue([]);
    } else {
      setIndex((i) => i + 1);
    }
  };

  const handleCta = () => {
    const path = current.cta?.path;
    dismiss();
    if (path) navigate(path);
  };

  return (
    <Dialog open={true} onOpenChange={(open) => { if (!open) dismiss(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="w-12 h-12 rounded-full bg-primary/15 flex items-center justify-center mb-3">
            <Icon className="w-6 h-6 text-primary" />
          </div>
          <DialogTitle className="text-xl">{current.title}</DialogTitle>
          <DialogDescription asChild>
            <div className="text-sm text-muted-foreground pt-1">{current.body}</div>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-2 flex-col sm:flex-row">
          <button
            onClick={dismiss}
            className="px-4 py-2 rounded-lg border border-border text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
          >
            {isLast ? 'Got it' : 'Next'}
          </button>
          {current.cta && (
            <button
              onClick={handleCta}
              className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              {current.cta.label}
            </button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

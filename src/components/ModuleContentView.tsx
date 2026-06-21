import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { CheckCircle2, Circle, Lightbulb, Link as LinkIcon, ChevronRight } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useRequireAuth } from '@/hooks/useAuth';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const PILLAR_COLORS: Record<string, { accent: string; bg: string; border: string }> = {
  build: { accent: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/30' },
  traffic: { accent: 'text-green-400', bg: 'bg-green-500/10', border: 'border-green-500/30' },
  sales: { accent: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-500/30' },
  scale: { accent: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/30' },
};

const SECTION_NUMBERS = ['①', '②', '③', '④'];

interface SectionBlock {
  type: string;
  [key: string]: any;
}

export default function ModuleContentView({ moduleId }: { moduleId: string }) {
  const { user } = useRequireAuth();
  const qc = useQueryClient();

  const { data: modulePage, isLoading } = useQuery({
    queryKey: ['module-page', moduleId],
    enabled: !!moduleId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('module_pages')
        .select('*')
        .eq('module_id', moduleId)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const { data: completions = [] } = useQuery({
    queryKey: ['module-checklist', user?.id, moduleId],
    enabled: !!user && !!moduleId,
    queryFn: async () => {
      const { data } = await supabase
        .from('checklist_progress')
        .select('task_key, completed')
        .eq('user_id', user!.id)
        .like('task_key', `module:${moduleId}:%`);
      return data ?? [];
    },
  });

  const completionMap: Record<string, boolean> = Object.fromEntries(
    completions.map((c: any) => [c.task_key, c.completed])
  );

  const toggleChecklist = useMutation({
    mutationFn: async ({ taskKey, current }: { taskKey: string; current: boolean }) => {
      await supabase.from('checklist_progress').upsert(
        { user_id: user!.id, task_key: taskKey, completed: !current, updated_at: new Date().toISOString() },
        { onConflict: 'user_id,task_key' }
      );
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['module-checklist'] }),
  });

  if (isLoading) {
    return <div className="text-muted-foreground py-10 text-center">Loading module...</div>;
  }

  if (!modulePage) {
    return <div className="text-muted-foreground py-10 text-center">Module content not found.</div>;
  }

  const colors = PILLAR_COLORS[modulePage.pillar || 'build'];
  const sections: SectionBlock[] = (modulePage.sections as SectionBlock[]) || [];

  return (
    <div>
      <div className="mb-6">
        <span className={`text-xs font-bold uppercase tracking-widest ${colors.accent}`}>
          {modulePage.pillar} Module
        </span>
        <h2 className="text-xl md:text-2xl font-bold mt-2 text-foreground">{modulePage.title}</h2>
        {modulePage.subtitle && (
          <p className="text-sm text-muted-foreground mt-2">{modulePage.subtitle}</p>
        )}
      </div>

      <div className="space-y-6">
        {sections.map((section, i) => (
          <RenderSection
            key={i}
            section={section}
            colors={colors}
            moduleId={moduleId}
            completionMap={completionMap}
            onToggle={(taskKey, current) => toggleChecklist.mutate({ taskKey, current })}
          />
        ))}
      </div>
    </div>
  );
}

function RenderSection({
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
            {SECTION_NUMBERS[section.number - 1] || section.number}
          </span>
          <span className={`text-xs font-bold tracking-[0.3em] uppercase ${colors.accent}`}>
            {section.label}
          </span>
          <div className={`flex-1 h-px ${colors.bg}`} />
        </div>
      );
    case 'heading':
      return <h3 className="text-lg font-bold text-foreground">{section.text}</h3>;
    case 'paragraph':
      return <p className="text-sm text-muted-foreground leading-relaxed">{section.text}</p>;
    case 'callout':
      return (
        <div className={`rounded-xl border ${colors.border} ${colors.bg} p-4`}>
          {section.title && <p className="text-sm font-bold mb-2 text-foreground">{section.title}</p>}
          {section.text && (
            <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
              {section.text}
            </p>
          )}
          {section.items && (
            <ul className="mt-2 space-y-1.5">
              {section.items.map((item: string, j: number) => (
                <li key={j} className="text-sm text-muted-foreground flex items-start gap-2">
                  <span className={`mt-1.5 w-1.5 h-1.5 rounded-full ${colors.accent} bg-current shrink-0`} />
                  {item}
                </li>
              ))}
            </ul>
          )}
        </div>
      );
    case 'bullet_list':
      return (
        <ul className="space-y-3">
          {section.items.map((item: any, j: number) => (
            <li key={j} className="flex items-start gap-3 text-sm">
              {item.emoji && <span className="text-lg shrink-0">{item.emoji}</span>}
              <div>
                {item.bold && <span className="font-semibold text-foreground">{item.bold}</span>}
                {item.text && <span className="text-muted-foreground"> {item.text}</span>}
                {typeof item === 'string' && <span className="text-muted-foreground">{item}</span>}
              </div>
            </li>
          ))}
        </ul>
      );
    case 'numbered_steps':
      return (
        <div className="space-y-4">
          {section.items.map((step: any, j: number) => (
            <div key={j} className="bg-card border border-border rounded-xl p-4">
              <div className="flex items-start gap-3">
                <span className={`shrink-0 w-7 h-7 rounded-full ${colors.bg} ${colors.accent} flex items-center justify-center text-xs font-bold`}>
                  {j + 1}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-foreground">{step.title}</p>
                  <p className="text-sm text-muted-foreground mt-1 leading-relaxed whitespace-pre-line">
                    {step.text}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      );
    case 'pro_tip':
      return (
        <div className="rounded-xl border border-warning/30 bg-warning/5 p-4 flex items-start gap-3">
          <Lightbulb className="w-5 h-5 text-warning shrink-0 mt-0.5" />
          <p className="text-sm text-muted-foreground leading-relaxed">{section.text}</p>
        </div>
      );
    case 'action_checklist':
      return (
        <div className="bg-card border border-border rounded-xl p-4 space-y-3">
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Action Checklist</p>
          {section.items.map((item: any) => {
            const taskKey = `module:${moduleId}:${item.id}`;
            const checked = !!completionMap[taskKey];
            return (
              <button
                key={item.id}
                onClick={() => onToggle(taskKey, checked)}
                className="flex items-center gap-3 w-full text-left group"
              >
                {checked ? (
                  <CheckCircle2 className="w-5 h-5 text-green-400 shrink-0" />
                ) : (
                  <Circle className="w-5 h-5 text-muted-foreground/40 group-hover:text-primary/60 shrink-0" />
                )}
                <span className={`text-sm ${checked ? 'text-muted-foreground line-through' : 'text-foreground'}`}>
                  {item.text}
                </span>
              </button>
            );
          })}
        </div>
      );
    case 'link_placeholder': {
      if (!section.url) {
        return (
          <div className="rounded-xl border border-dashed border-border p-4 flex items-center gap-3 opacity-60">
            <LinkIcon className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">{section.label}</span>
          </div>
        );
      }
      const igMatch = section.url.match(/instagram\.com\/(p|reel|tv)\/([^/?#]+)/i);
      if (igMatch) {
        const embed = `https://www.instagram.com/${igMatch[1]}/${igMatch[2]}/embed`;
        return (
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="px-3 py-2 flex items-center justify-between gap-2 border-b border-border">
              <span className="text-xs font-semibold text-foreground truncate">{section.label}</span>
              <a
                href={section.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[10px] uppercase tracking-wider text-primary hover:underline shrink-0"
              >
                Open ↗
              </a>
            </div>
            <iframe
              src={embed}
              loading="lazy"
              allow="encrypted-media"
              allowFullScreen
              className="w-full bg-background"
              style={{ height: 540, border: 0 }}
              title={section.label}
            />
          </div>
        );
      }
      return section.url.startsWith('/') ? (
        <a
          href={section.url}
          className="inline-flex items-center gap-2 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground px-6 py-3 text-sm font-semibold transition-colors"
        >
          <LinkIcon className="w-4 h-4" />
          {section.label}
        </a>
      ) : (
        <a
          href={section.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground px-6 py-3 text-sm font-semibold transition-colors"
        >
          <LinkIcon className="w-4 h-4" />
          {section.label}
        </a>
      );
    }

    case 'next_module':
      return (
        <div className="rounded-xl border border-border bg-card p-4 flex items-center gap-3">
          <ChevronRight className={`w-5 h-5 ${colors.accent}`} />
          <span className="text-sm font-semibold text-foreground">{section.text}</span>
        </div>
      );
    default:
      return null;
  }
}

export function ModuleContentDialog({
  moduleId,
  open,
  onOpenChange,
}: {
  moduleId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl w-[95vw] max-h-[90vh] overflow-y-auto bg-card border-border">
        <DialogHeader>
          <DialogTitle className="sr-only">Module content</DialogTitle>
        </DialogHeader>
        <ModuleContentView moduleId={moduleId} />
      </DialogContent>
    </Dialog>
  );
}

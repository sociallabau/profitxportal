import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, CheckCircle2, Circle, Lightbulb, AlertTriangle, Link as LinkIcon, ChevronRight, Pencil, Save, X, Play } from 'lucide-react';
import { useState } from 'react';
import PageLayout from '@/components/PageLayout';
import { supabase } from '@/lib/supabase';
import moduleCoverC2 from '@/assets/module-cover-stupidly-simple-ad.jpg';
import { useRequireAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';

const PILLAR_COLORS: Record<string, { accent: string; bg: string; border: string }> = {
  build: { accent: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/30' },
  traffic: { accent: 'text-primary', bg: 'bg-primary/10', border: 'border-primary/30' },
  sales: { accent: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-500/30' },
  scale: { accent: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/30' },
  offer: { accent: 'text-primary', bg: 'bg-primary/10', border: 'border-primary/30' },
  clients: { accent: 'text-primary', bg: 'bg-primary/10', border: 'border-primary/30' },
  delivery: { accent: 'text-primary', bg: 'bg-primary/10', border: 'border-primary/30' },
};

const SECTION_NUMBERS = ['①', '②', '③', '④'];

interface SectionBlock {
  type: string;
  [key: string]: any;
}

const asArray = (value: unknown): any[] => (Array.isArray(value) ? value : []);

const itemText = (item: any): string => {
  if (typeof item === 'string') return item;
  return item?.text ?? item?.title ?? item?.label ?? '';
};

export default function ModulePage() {
  const { moduleId } = useParams<{ moduleId: string }>();
  const navigate = useNavigate();
  const { user } = useRequireAuth();
  const { data: profile } = useProfile();
  const qc = useQueryClient();
  const isAdmin = !!profile?.is_admin;
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editSubtitle, setEditSubtitle] = useState('');
  const [editSections, setEditSections] = useState('');

  const { data: modulePage, isLoading } = useQuery({
    queryKey: ['module-page', moduleId],
    enabled: !!moduleId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('module_pages')
        .select('*')
        .eq('module_id', moduleId!)
        .maybeSingle();
      if (error) {
        console.error('Failed to load module page', error);
        return null;
      }
      return data;
    },
    retry: false,
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

  const { data: moduleCompletion } = useQuery({
    queryKey: ['module-completions', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from('checklist_progress')
        .select('task_key, completed')
        .eq('user_id', user!.id)
        .eq('task_key', moduleId!)
        .maybeSingle();
      return data;
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

  const markComplete = useMutation({
    mutationFn: async () => {
      await supabase.from('checklist_progress').upsert(
        { user_id: user!.id, task_key: moduleId!, completed: true, updated_at: new Date().toISOString() },
        { onConflict: 'user_id,task_key' }
      );
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['module-completions'] });
      toast.success('Module marked as complete!');
      navigate('/roadmap');
    },
  });

  const savePage = useMutation({
    mutationFn: async () => {
      let parsedSections;
      try {
        parsedSections = JSON.parse(editSections);
      } catch {
        throw new Error('Invalid JSON in sections');
      }
      const { error } = await supabase
        .from('module_pages')
        .update({ title: editTitle, subtitle: editSubtitle, sections: parsedSections, updated_at: new Date().toISOString() })
        .eq('module_id', moduleId!);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['module-page', moduleId] });
      setEditing(false);
      toast.success('Module page saved');
    },
    onError: (e: any) => toast.error(e.message),
  });

  const startEdit = () => {
    if (!modulePage) return;
    setEditTitle(modulePage.title);
    setEditSubtitle(modulePage.subtitle || '');
    setEditSections(JSON.stringify(modulePage.sections, null, 2));
    setEditing(true);
  };

  const colors = PILLAR_COLORS[modulePage?.pillar || 'build'];
  const isModuleComplete = !!moduleCompletion?.completed;

  if (isLoading) {
    return (
      <PageLayout>
        <div className="flex items-center justify-center py-20">
          <div className="text-muted-foreground">Loading module...</div>
        </div>
      </PageLayout>
    );
  }

  if (!modulePage) {
    return (
      <PageLayout>
        <div className="text-center py-20">
          <p className="text-muted-foreground mb-4">This module page has not been created yet.</p>
          <Button variant="outline" onClick={() => navigate('/roadmap')}>
            <ArrowLeft className="w-4 h-4 mr-2" /> Back to Roadmap
          </Button>
        </div>
      </PageLayout>
    );
  }

  if (editing) {
    return (
      <PageLayout>
        <div className="mb-4 flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>
            <X className="w-4 h-4 mr-1" /> Cancel
          </Button>
          <Button size="sm" onClick={() => savePage.mutate()} disabled={savePage.isPending}>
            <Save className="w-4 h-4 mr-1" /> Save
          </Button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Title</label>
            <Input value={editTitle} onChange={e => setEditTitle(e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Subtitle</label>
            <Input value={editSubtitle} onChange={e => setEditSubtitle(e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Sections (JSON)</label>
            <Textarea
              className="font-mono text-xs min-h-[500px]"
              value={editSections}
              onChange={e => setEditSections(e.target.value)}
            />
          </div>
        </div>
      </PageLayout>
    );
  }

  const sections: SectionBlock[] = Array.isArray(modulePage.sections)
    ? (modulePage.sections as SectionBlock[])
    : [];

  return (
    <PageLayout>
      {/* Back + Admin Edit */}
      <div className="flex items-center justify-between mb-6">
        <Button variant="ghost" size="sm" onClick={() => navigate('/roadmap')} className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-4 h-4 mr-1" /> Back to Roadmap
        </Button>
        {isAdmin && (
          <Button variant="outline" size="sm" onClick={startEdit}>
            <Pencil className="w-4 h-4 mr-1" /> Edit Page
          </Button>
        )}
      </div>

      {/* Header */}
      <div className="relative mb-6 rounded-2xl border border-border/60 bg-gradient-to-br from-card/80 via-card/50 to-primary/5 p-6 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-transparent pointer-events-none" />
        <div className="absolute -top-10 -right-10 w-40 h-40 bg-primary/20 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10">
          <span className={`text-xs font-bold uppercase tracking-widest ${colors.accent}`}>
            {modulePage.pillar} Module
          </span>
          <h1 className="text-2xl md:text-3xl font-bold mt-2">{modulePage.title}</h1>
        </div>
      </div>

      {/* Content Sections */}
      <div className="space-y-6 max-w-3xl">
        {sections.map((section, i) => (
          <RenderSection
            key={i}
            section={section}
            colors={colors}
            moduleId={moduleId!}
            completionMap={completionMap}
            onToggle={(taskKey, current) => toggleChecklist.mutate({ taskKey, current })}
          />
        ))}
      </div>

      {/* Mark Complete */}
      <div className="mt-10 pt-6 border-t border-border max-w-3xl">
        <Button
          onClick={() => markComplete.mutate()}
          disabled={isModuleComplete || markComplete.isPending}
          className={isModuleComplete ? 'bg-green-600 hover:bg-green-600' : ''}
          size="lg"
        >
          {isModuleComplete ? (
            <><CheckCircle2 className="w-5 h-5 mr-2" /> Module Complete</>
          ) : (
            <>Mark Module Complete <ChevronRight className="w-4 h-4 ml-1" /></>
          )}
        </Button>
      </div>
    </PageLayout>
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
              {asArray(section.items).map((item: string, j: number) => (
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
          {asArray(section.items).map((item: any, j: number) => (
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
      const numberedItems = asArray(section.items ?? section.steps);
      return (
        <div className="space-y-4">
          {numberedItems.map((step: any, j: number) => (
            <div key={j} className="bg-card border border-border rounded-xl p-4">
              <div className="flex items-start gap-3">
                <span className={`shrink-0 w-7 h-7 rounded-full ${colors.bg} ${colors.accent} flex items-center justify-center text-xs font-bold`}>
                  {j + 1}
                </span>
                <div className="min-w-0">
                  {step.title && <p className="text-sm font-bold">{step.title}</p>}
                  <p className="text-sm text-muted-foreground mt-1 leading-relaxed whitespace-pre-line">
                    {itemText(step)}
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
      const checklistItems = asArray(section.items);
      return (
        <div className="bg-card border border-border rounded-xl p-4 space-y-3">
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Action Checklist</p>
          {checklistItems.map((item: any, index: number) => {
            const text = itemText(item);
            const taskKey = `module:${moduleId}:${item.id ?? index}`;
            const checked = !!completionMap[taskKey];
            return (
              <button
                key={item.id ?? index}
                onClick={() => onToggle(taskKey, checked)}
                className="flex items-center gap-3 w-full text-left group"
              >
                {checked ? (
                  <CheckCircle2 className="w-5 h-5 text-green-400 shrink-0" />
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

    case 'link_placeholder':
      return section.url ? (
        <LinkPlaceholderButton url={section.url} label={section.label} />
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

function LinkPlaceholderButton({ url, label }: { url: string; label: string }) {
  const isPdf = /\.pdf($|\?)/i.test(url);
  const isInternal = url.startsWith('/');

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

  return (
    <a
      href={url}
      target={isInternal ? undefined : '_blank'}
      rel={isInternal ? undefined : 'noopener noreferrer'}
      className="flex items-center gap-1.5 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground px-3 py-1.5 text-xs font-semibold transition-colors"
    >
      <LinkIcon className="w-3.5 h-3.5" />
      {label}
    </a>
  );
}

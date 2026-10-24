import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, CheckCircle2, Circle, Lightbulb, AlertTriangle, Link as LinkIcon, ChevronRight, Pencil, Save, X, Play } from 'lucide-react';
import { useState } from 'react';
import PageLayout from '@/components/PageLayout';
import { supabase } from '@/lib/supabase';
import { useRequireAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { PILLAR_COLORS, RenderSection, type SectionBlock } from '@/components/module/ModuleSections';


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


  const completionMap: Record<string, boolean> = Object.fromEntries(
    completions.map(c => [c.task_key, !!c.completed])
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
    onError: (e: Error) => toast.error(e.message),
  });

  const startEdit = () => {
    if (!modulePage) return;
    setEditTitle(modulePage.title);
    setEditSubtitle(modulePage.subtitle || '');
    setEditSections(JSON.stringify(modulePage.sections, null, 2));
    setEditing(true);
  };

  const colors = PILLAR_COLORS[modulePage?.pillar || 'build'];


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
    ? (modulePage.sections as unknown as SectionBlock[])
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

    </PageLayout>
  );
}

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useRequireAuth } from '@/hooks/useAuth';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { PILLAR_COLORS, RenderSection, type SectionBlock } from '@/components/module/ModuleSections';

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

  if (isLoading) {
    return <div className="text-muted-foreground py-10 text-center">Loading module...</div>;
  }

  if (!modulePage) {
    return <div className="text-muted-foreground py-10 text-center">Module content not found.</div>;
  }

  const colors = PILLAR_COLORS[modulePage.pillar || 'build'];
  const sections = ((modulePage.sections ?? []) as unknown) as SectionBlock[];

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

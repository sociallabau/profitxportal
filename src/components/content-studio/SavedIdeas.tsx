import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useRequireAuth } from '@/hooks/useAuth';
import { Bookmark, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

export default function SavedIdeas() {
  const { user } = useRequireAuth();
  const queryClient = useQueryClient();

  const { data: ideas = [] } = useQuery({
    queryKey: ['saved-ideas'],
    queryFn: async () => {
      const { data } = await supabase
        .from('saved_ideas')
        .select('*')
        .eq('user_id', user?.id)
        .order('saved_at', { ascending: false });
      return data ?? [];
    },
    enabled: !!user,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from('saved_ideas').delete().eq('id', id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['saved-ideas'] });
      toast.success('Idea removed');
    },
  });

  if (ideas.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
          <Bookmark className="w-7 h-7 text-muted-foreground" />
        </div>
        <p className="text-sm text-muted-foreground">
          No saved ideas yet. Search for content on the Instagram tab and save videos that inspire you.
        </p>
      </div>
    );
  }

  return (
    <div>
      <p className="text-sm text-muted-foreground mb-4">Your personal swipe file of content inspiration.</p>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {ideas.map((idea: any) => (
          <div key={idea.id} className="bg-card border border-border rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-foreground">@{idea.source_handle || 'unknown'}</span>
              {idea.outlier_score && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                  {idea.outlier_score}x
                </span>
              )}
            </div>
            {idea.source_caption && (
              <p className="text-xs text-muted-foreground line-clamp-3">{idea.source_caption}</p>
            )}
            {idea.ai_script && (
              <p className="text-xs text-foreground/80 line-clamp-3">{idea.ai_script}</p>
            )}
            <div className="flex items-center justify-between pt-1">
              <span className="text-[10px] text-muted-foreground">
                {idea.saved_at ? new Date(idea.saved_at).toLocaleDateString() : ''}
              </span>
              <button
                onClick={() => deleteMutation.mutate(idea.id)}
                className="text-destructive hover:bg-destructive/10 p-1.5 rounded-lg transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

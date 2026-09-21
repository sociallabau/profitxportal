import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useRequireAuth } from '@/hooks/useAuth';
import { ChevronLeft, ChevronRight, Plus, Trash2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, addMonths, subMonths, isSameDay, parseISO } from 'date-fns';
import type { Row } from '@/lib/db';

type ContentPost = Row<'content_posts'>;

const PLATFORMS = ['Instagram', 'YouTube', 'TikTok'] as const;
const POST_TYPES = ['Reel', 'Story', 'Carousel', 'Long-form', 'Short'] as const;
const CATEGORIES = ['Educational', 'Behind the Scenes', 'Social Proof', 'Offer', 'Trending'] as const;
const STATUSES = [
  { id: 'idea', label: 'Idea', color: 'bg-muted-foreground' },
  { id: 'drafting', label: 'Drafting', color: 'bg-blue-500' },
  { id: 'ready', label: 'Ready', color: 'bg-orange-500' },
  { id: 'published', label: 'Published', color: 'bg-green-500' },
] as const;

const PLATFORM_SHORT: Record<string, string> = { Instagram: 'IG', YouTube: 'YT', TikTok: 'TT' };

export default function ContentCalendar() {
  const { user } = useRequireAuth();
  const queryClient = useQueryClient();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [panelOpen, setPanelOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [editingPost, setEditingPost] = useState<any>(null);

  // Form state
  const [platform, setPlatform] = useState<string>('Instagram');
  const [postType, setPostType] = useState<string>('Reel');
  const [category, setCategory] = useState<string>('Educational');
  const [title, setTitle] = useState('');
  const [hook, setHook] = useState('');
  const [script, setScript] = useState('');
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState('idea');

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const { data: posts = [] } = useQuery({
    queryKey: ['content-posts', format(currentMonth, 'yyyy-MM')],
    queryFn: async () => {
      const { data } = await supabase
        .from('content_posts')
        .select('*')
        .eq('user_id', user?.id)
        .gte('date', format(monthStart, 'yyyy-MM-dd'))
        .lte('date', format(monthEnd, 'yyyy-MM-dd'));
      return data ?? [];
    },
    enabled: !!user,
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!user || !selectedDate) return;
      const row = {
        user_id: user.id,
        date: format(selectedDate, 'yyyy-MM-dd'),
        platform,
        post_type: postType,
        category,
        title,
        hook,
        script,
        notes,
        status,
        posted_at: format(selectedDate, 'yyyy-MM-dd'),
      };
      if (editingPost) {
        await supabase.from('content_posts').update(row).eq('id', editingPost.id);
      } else {
        await supabase.from('content_posts').insert(row);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['content-posts'] });
      toast.success('Post saved!');
      closePanel();
    },
    onError: () => toast.error('Failed to save post'),
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!editingPost) return;
      await supabase.from('content_posts').delete().eq('id', editingPost.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['content-posts'] });
      toast.success('Post deleted');
      closePanel();
    },
  });

  const openPanel = (date: Date, post?: ContentPost) => {
    setSelectedDate(date);
    if (post) {
      setEditingPost(post);
      setPlatform(post.platform || 'Instagram');
      setPostType(post.post_type || 'Reel');
      setCategory(post.category || 'Educational');
      setTitle(post.title || '');
      setHook(post.hook || '');
      setScript(post.script || '');
      setNotes(post.notes || '');
      setStatus(post.status || 'idea');
    } else {
      setEditingPost(null);
      setPlatform('Instagram');
      setPostType('Reel');
      setCategory('Educational');
      setTitle('');
      setHook('');
      setScript('');
      setNotes('');
      setStatus('idea');
    }
    setPanelOpen(true);
  };

  const closePanel = () => {
    setPanelOpen(false);
    setEditingPost(null);
  };

  const startDay = getDay(monthStart);
  const paddingDays = startDay === 0 ? 6 : startDay - 1;

  return (
    <div className="relative">
      {/* Calendar Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-lg font-semibold text-foreground min-w-[160px] text-center">
            {format(currentMonth, 'MMMM yyyy')}
          </span>
          <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
        <button
          onClick={() => openPanel(new Date())}
          className="flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:bg-primary/90 transition-colors"
        >
          <Plus className="w-4 h-4" /> Add Post
        </button>
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7 gap-px bg-border rounded-xl overflow-hidden">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => (
          <div key={d} className="bg-card px-2 py-2 text-center text-xs font-semibold text-muted-foreground">{d}</div>
        ))}
        {Array.from({ length: paddingDays }).map((_, i) => (
          <div key={`pad-${i}`} className="bg-card min-h-[80px]" />
        ))}
        {days.map(day => {
          const dayPosts = posts.filter(p => p.date && isSameDay(parseISO(p.date), day));
          return (
            <div
              key={day.toISOString()}
              onClick={() => openPanel(day)}
              className="bg-card min-h-[80px] p-1.5 cursor-pointer hover:bg-muted/50 transition-colors"
            >
              <span className="text-xs text-muted-foreground">{format(day, 'd')}</span>
              <div className="mt-1 space-y-0.5">
                {dayPosts.map(p => {
                  const statusObj = STATUSES.find(s => s.id === p.status) || STATUSES[0];
                  return (
                    <button
                      key={p.id}
                      onClick={(e) => { e.stopPropagation(); openPanel(day, p); }}
                      className={`block w-full text-left text-[10px] px-1.5 py-0.5 rounded ${statusObj.color}/20 text-foreground truncate`}
                    >
                      {PLATFORM_SHORT[p.platform] || p.platform}
                      {p.title ? ` · ${p.title}` : ''}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Slide-over Panel */}
      {panelOpen && (
        <>
          <div className="fixed inset-0 z-40 bg-background/70" onClick={closePanel} />
          <div
            className="fixed right-0 top-0 z-50 w-full sm:max-w-md bg-card border-l border-border overflow-y-auto p-6 pb-[calc(env(safe-area-inset-bottom)+6rem)] overscroll-contain"
            style={{ height: '100dvh' }}
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-foreground">
                {editingPost ? 'Edit Post' : 'New Post'}
              </h2>
              <button onClick={closePanel} className="text-muted-foreground hover:text-foreground text-lg">✕</button>
            </div>

            {selectedDate && (
              <p className="text-xs text-muted-foreground mb-4">{format(selectedDate, 'EEEE, d MMMM yyyy')}</p>
            )}

            <div className="space-y-4">
              {/* Platform */}
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Platform</label>
                <div className="flex gap-2 flex-wrap">
                  {PLATFORMS.map(p => (
                    <button key={p} onClick={() => setPlatform(p)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${platform === p ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground'}`}
                    >{p}</button>
                  ))}
                </div>
              </div>

              {/* Post Type */}
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Post Type</label>
                <div className="flex gap-2 flex-wrap">
                  {POST_TYPES.map(t => (
                    <button key={t} onClick={() => setPostType(t)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${postType === t ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground'}`}
                    >{t}</button>
                  ))}
                </div>
              </div>

              {/* Category */}
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Category</label>
                <div className="flex gap-2 flex-wrap">
                  {CATEGORIES.map(c => (
                    <button key={c} onClick={() => setCategory(c)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${category === c ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground'}`}
                    >{c}</button>
                  ))}
                </div>
              </div>

              {/* Title */}
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Title / Topic</label>
                <input type="text" value={title} onChange={e => setTitle(e.target.value)}
                  placeholder="What's this piece about?"
                  className="w-full px-3 py-2 bg-input border border-border rounded-lg text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40" />
              </div>

              {/* Hook */}
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Hook / Opening Line</label>
                <textarea value={hook} onChange={e => setHook(e.target.value)} rows={2}
                  placeholder="The first line that stops the scroll..."
                  className="w-full px-3 py-2 bg-input border border-border rounded-lg text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none" />
              </div>

              {/* Script */}
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Script / Outline</label>
                <textarea value={script} onChange={e => setScript(e.target.value)} rows={4}
                  placeholder="Bullet points, full script, or storyboard notes..."
                  className="w-full px-3 py-2 bg-input border border-border rounded-lg text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none" />
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Notes</label>
                <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
                  placeholder="B-roll ideas, CTA, thumbnail concept..."
                  className="w-full px-3 py-2 bg-input border border-border rounded-lg text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none" />
              </div>

              {/* Status */}
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Status</label>
                <div className="flex gap-2 flex-wrap">
                  {STATUSES.map(s => (
                    <button key={s.id} onClick={() => setStatus(s.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 ${status === s.id ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground'}`}
                    >
                      <span className={`w-2 h-2 rounded-full ${s.color}`} />
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => saveMutation.mutate()}
                  disabled={saveMutation.isPending}
                  className="flex-1 py-2.5 bg-primary text-primary-foreground font-semibold rounded-lg text-sm hover:bg-primary/90 transition disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {saveMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                  Save
                </button>
                {editingPost && (
                  <button
                    onClick={() => deleteMutation.mutate()}
                    disabled={deleteMutation.isPending}
                    className="px-4 py-2.5 text-destructive hover:bg-destructive/10 rounded-lg text-sm font-medium transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

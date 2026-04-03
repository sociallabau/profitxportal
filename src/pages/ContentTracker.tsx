import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, X } from 'lucide-react';
import PageLayout from '@/components/PageLayout';
import { supabase } from '@/lib/supabase';
import { useRequireAuth } from '@/hooks/useAuth';

const PLATFORMS = ['Instagram', 'YouTube', 'TikTok', 'LinkedIn', 'Other'];

export default function ContentTracker() {
  const { user } = useRequireAuth();
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ platform: 'Instagram', content_type: '', views: '', likes: '', leads: '', notes: '' });

  const { data: posts } = useQuery({
    queryKey: ['content-posts', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from('content_posts')
        .select('*')
        .eq('user_id', user!.id)
        .order('posted_at', { ascending: false });
      return data ?? [];
    },
  });

  const addPost = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('content_posts').insert({
        user_id: user!.id,
        platform: form.platform,
        content_type: form.content_type,
        posted_at: new Date().toISOString().split('T')[0],
        views: parseInt(form.views) || 0,
        likes: parseInt(form.likes) || 0,
        leads: parseInt(form.leads) || 0,
        notes: form.notes,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['content-posts'] });
      setForm({ platform: 'Instagram', content_type: '', views: '', likes: '', leads: '', notes: '' });
      setShowForm(false);
    },
  });

  const totalViews = posts?.reduce((s: number, p: any) => s + Number(p.views), 0) ?? 0;
  const totalLeads = posts?.reduce((s: number, p: any) => s + Number(p.leads), 0) ?? 0;

  return (
    <PageLayout>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl">Content Tracker</h1>
          <p className="text-sm text-muted-foreground mt-1">Track what you post and the results it gets you.</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground font-semibold rounded-lg text-sm hover:bg-primary/90 transition-all"
        >
          <Plus className="w-4 h-4" /> Add Post
        </button>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: 'Posts Logged', value: posts?.length ?? 0 },
          { label: 'Total Views', value: totalViews.toLocaleString() },
          { label: 'Leads from Content', value: totalLeads },
        ].map((s) => (
          <div key={s.label} className="bg-card border border-border rounded-xl p-4 text-center">
            <p className="text-xs text-muted-foreground mb-1">{s.label}</p>
            <p className="text-xl font-bold text-foreground">{s.value}</p>
          </div>
        ))}
      </div>

      {showForm && (
        <div className="bg-card border border-primary/30 rounded-xl p-5 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-foreground">Add New Post</h3>
            <button onClick={() => setShowForm(false)}><X className="w-4 h-4 text-muted-foreground" /></button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-3">
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1">Platform</label>
              <select value={form.platform} onChange={(e) => setForm({ ...form, platform: e.target.value })}
                className="w-full px-3 py-2 bg-input border border-border rounded-lg text-foreground text-sm focus:ring-2 focus:ring-primary/40 focus:outline-none">
                {PLATFORMS.map((p) => <option key={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1">Content Type</label>
              <input value={form.content_type} onChange={(e) => setForm({ ...form, content_type: e.target.value })}
                placeholder="Reel, Video, Carousel..."
                className="w-full px-3 py-2 bg-input border border-border rounded-lg text-foreground placeholder:text-muted-foreground text-sm focus:ring-2 focus:ring-primary/40 focus:outline-none" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1">Views</label>
              <input type="number" value={form.views} onChange={(e) => setForm({ ...form, views: e.target.value })}
                placeholder="0"
                className="w-full px-3 py-2 bg-input border border-border rounded-lg text-foreground placeholder:text-muted-foreground text-sm focus:ring-2 focus:ring-primary/40 focus:outline-none" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1">Likes</label>
              <input type="number" value={form.likes} onChange={(e) => setForm({ ...form, likes: e.target.value })}
                placeholder="0"
                className="w-full px-3 py-2 bg-input border border-border rounded-lg text-foreground placeholder:text-muted-foreground text-sm focus:ring-2 focus:ring-primary/40 focus:outline-none" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1">Leads</label>
              <input type="number" value={form.leads} onChange={(e) => setForm({ ...form, leads: e.target.value })}
                placeholder="0"
                className="w-full px-3 py-2 bg-input border border-border rounded-lg text-foreground placeholder:text-muted-foreground text-sm focus:ring-2 focus:ring-primary/40 focus:outline-none" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1">Notes</label>
              <input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Optional note..."
                className="w-full px-3 py-2 bg-input border border-border rounded-lg text-foreground placeholder:text-muted-foreground text-sm focus:ring-2 focus:ring-primary/40 focus:outline-none" />
            </div>
          </div>
          <div className="flex justify-end">
            <button onClick={() => addPost.mutate()} disabled={addPost.isPending}
              className="px-5 py-2 bg-primary text-primary-foreground font-semibold rounded-lg text-sm hover:bg-primary/90 transition-all disabled:opacity-50">
              {addPost.isPending ? 'Saving...' : 'Save Post →'}
            </button>
          </div>
        </div>
      )}

      {posts && posts.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                {['Platform', 'Type', 'Date', 'Views', 'Likes', 'Leads'].map((h) => (
                  <th key={h} className="pb-2 text-xs font-semibold text-muted-foreground pr-4">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {posts.map((p: any) => (
                <tr key={p.id} className="border-b border-border/50">
                  <td className="py-2.5 pr-4">
                    <span className="px-2 py-0.5 bg-primary/10 text-primary rounded text-xs font-semibold">{p.platform}</span>
                  </td>
                  <td className="py-2.5 pr-4 text-muted-foreground">{p.content_type || '—'}</td>
                  <td className="py-2.5 pr-4 text-muted-foreground">{new Date(p.posted_at).toLocaleDateString()}</td>
                  <td className="py-2.5 pr-4 text-foreground">{Number(p.views).toLocaleString()}</td>
                  <td className="py-2.5 pr-4 text-foreground">{Number(p.likes).toLocaleString()}</td>
                  <td className="py-2.5 text-primary font-semibold">{p.leads}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="text-center py-12 text-muted-foreground">
          <p className="text-sm">No posts tracked yet.</p>
          <button onClick={() => setShowForm(true)} className="mt-2 text-sm text-primary hover:underline">Add your first post →</button>
        </div>
      )}
    </PageLayout>
  );
}

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ExternalLink, Plus, X } from 'lucide-react';
import PageLayout from '@/components/PageLayout';
import { supabase } from '@/lib/supabase';
import { useRequireAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';

const CATEGORIES = ['Templates', 'Scripts', 'SOPs', 'Tools', 'Training', 'Case Studies'];

const CATEGORY_EMOJI: Record<string, string> = {
  Templates: '📄', Scripts: '📝', SOPs: '⚙️',
  Tools: '🛠️', Training: '🎓', 'Case Studies': '🏆',
};

export default function Resources() {
  const { user } = useRequireAuth();
  const { data: profile } = useProfile();
  const qc = useQueryClient();
  const [activeCategory, setActiveCategory] = useState('All');
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', url: '', category: 'Templates' });

  const { data: resources } = useQuery({
    queryKey: ['resources'],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from('resources')
        .select('*')
        .eq('is_active', true)
        .order('sort_order')
        .order('created_at', { ascending: false });
      return data ?? [];
    },
  });

  const addResource = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('resources').insert(form);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['resources'] });
      setForm({ title: '', description: '', url: '', category: 'Templates' });
      setShowAdd(false);
    },
  });

  const filtered = activeCategory === 'All'
    ? resources ?? []
    : (resources ?? []).filter((r: any) => r.category === activeCategory);

  return (
    <PageLayout>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl">Resource Library</h1>
          <p className="text-sm text-muted-foreground mt-1">Tools, templates and training to accelerate your growth.</p>
        </div>
        {profile?.is_admin && (
          <button onClick={() => setShowAdd(!showAdd)}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground font-semibold rounded-lg text-sm hover:bg-primary/90 transition-all">
            <Plus className="w-4 h-4" /> Add Resource
          </button>
        )}
      </div>

      {showAdd && profile?.is_admin && (
        <div className="bg-card border border-primary/30 rounded-xl p-5 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-foreground">Add New Resource</h3>
            <button onClick={() => setShowAdd(false)}><X className="w-4 h-4 text-muted-foreground" /></button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1">Title</label>
              <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}
                placeholder="Discovery Call Script"
                className="w-full px-3 py-2 bg-input border border-border rounded-lg text-foreground text-sm focus:ring-2 focus:ring-primary/40 focus:outline-none" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1">Category</label>
              <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}
                className="w-full px-3 py-2 bg-input border border-border rounded-lg text-foreground text-sm focus:ring-2 focus:ring-primary/40 focus:outline-none">
                {CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1">URL</label>
              <input value={form.url} onChange={e => setForm({ ...form, url: e.target.value })}
                placeholder="https://docs.google.com/..."
                className="w-full px-3 py-2 bg-input border border-border rounded-lg text-foreground text-sm focus:ring-2 focus:ring-primary/40 focus:outline-none" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1">Description</label>
              <input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
                placeholder="Short description..."
                className="w-full px-3 py-2 bg-input border border-border rounded-lg text-foreground text-sm focus:ring-2 focus:ring-primary/40 focus:outline-none" />
            </div>
          </div>
          <div className="flex justify-end">
            <button onClick={() => addResource.mutate()} disabled={!form.title || !form.url || addResource.isPending}
              className="px-5 py-2 bg-primary text-primary-foreground font-semibold rounded-lg text-sm hover:bg-primary/90 transition-all disabled:opacity-50">
              {addResource.isPending ? 'Saving...' : 'Add Resource →'}
            </button>
          </div>
        </div>
      )}

      <div className="flex gap-2 mb-6 overflow-x-auto pb-1 flex-wrap">
        {['All', ...CATEGORIES].map(cat => (
          <button key={cat} onClick={() => setActiveCategory(cat)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors shrink-0 ${
              activeCategory === cat
                ? 'bg-primary text-primary-foreground'
                : 'bg-card border border-border text-muted-foreground hover:text-foreground'
            }`}>
            {cat !== 'All' && CATEGORY_EMOJI[cat]} {cat}
          </button>
        ))}
      </div>

      {filtered.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((r: any) => (
            <a key={r.id} href={r.url} target="_blank" rel="noopener noreferrer"
              className="group bg-card border border-border rounded-xl p-5 hover:border-primary/40 hover:bg-primary/5 transition-all flex flex-col">
              <div className="flex items-start justify-between gap-2 mb-2">
                <span className="text-2xl">{CATEGORY_EMOJI[r.category] ?? '📎'}</span>
                <span className="text-xs px-2 py-0.5 bg-primary/10 text-primary rounded-full font-semibold">{r.category}</span>
              </div>
              <h3 className="text-sm font-bold text-foreground mb-1 group-hover:text-primary transition-colors">{r.title}</h3>
              {r.description && <p className="text-xs text-muted-foreground flex-1 mb-3">{r.description}</p>}
              <div className="flex items-center gap-1 text-xs text-primary font-semibold mt-auto">
                Open <ExternalLink className="w-3 h-3" />
              </div>
            </a>
          ))}
        </div>
      ) : (
        <div className="text-center py-16 text-muted-foreground">
          <p className="text-3xl mb-3">📚</p>
          <p className="text-sm">No resources yet.{profile?.is_admin ? ' Add the first one above.' : ' Your coach will add resources here soon.'}</p>
        </div>
      )}
    </PageLayout>
  );
}

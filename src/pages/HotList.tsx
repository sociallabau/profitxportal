import { useState, useEffect } from 'react';
import PageLayout from '@/components/PageLayout';
import { useRequireAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, X } from 'lucide-react';

interface HotListCard {
  id: string;
  user_id: string;
  name: string;
  business_name?: string | null;
  email?: string | null;
  phone?: string | null;
  source?: string | null;
  deal_value?: number | null;
  notes?: string | null;
  column_id: string;
  position: number;
  created_at: string;
  updated_at: string;
}

const COLUMNS = [
  { id: 'reached_out', label: '📤 Reached Out' },
  { id: 'call_taken', label: '📞 Call Taken / Proposal Sent' },
  { id: 'needs_push', label: '⏰ Needs Push for Meeting' },
  { id: 'meeting_taken', label: '🤝 Meeting Taken' },
  { id: 'two_stage_close', label: '🎯 Needs 2-Stage Close' },
  { id: 'one_off_closed', label: '💵 One-Off Closed' },
  { id: 'retainer_closed', label: '✅ Retainer Closed' },
];

const DEFAULT_COL = COLUMNS[0].id;

const emptyForm = {
  name: '',
  business_name: '',
  phone: '',
  email: '',
  source: '',
  deal_value: '',
  notes: '',
  column_id: DEFAULT_COL,
};

export default function HotList() {
  const { user, loading: authLoading } = useRequireAuth();
  const [cards, setCards] = useState<HotListCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCard, setEditingCard] = useState<HotListCard | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [draggedCardId, setDraggedCardId] = useState<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);

  useEffect(() => {
    if (user) loadCards();
  }, [user]);

  const loadCards = async () => {
    const { data, error } = await supabase
      .from('hot_list')
      .select('*')
      .eq('user_id', user!.id)
      .order('position', { ascending: true });
    if (!error && data) setCards(data as any as HotListCard[]);
    setLoading(false);
  };

  const openAdd = (colId = DEFAULT_COL) => {
    setEditingCard(null);
    setForm({ ...emptyForm, column_id: colId });
    setModalOpen(true);
  };

  const openEdit = (card: HotListCard) => {
    setEditingCard(card);
    setForm({
      name: card.name,
      business_name: card.business_name || '',
      phone: card.phone || '',
      email: card.email || '',
      source: card.source || '',
      deal_value: card.deal_value != null ? String(card.deal_value) : '',
      notes: card.notes || '',
      column_id: card.column_id,
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error('Name is required'); return; }
    setSaving(true);
    const dealValueNum = form.deal_value.trim() ? Number(form.deal_value) : null;
    const payload = {
      name: form.name,
      business_name: form.business_name || null,
      phone: form.phone || null,
      email: form.email || null,
      source: form.source || null,
      deal_value: Number.isFinite(dealValueNum as number) ? dealValueNum : null,
      notes: form.notes || null,
      column_id: form.column_id,
    };
    if (editingCard) {
      const { error } = await supabase.from('hot_list').update({
        ...payload,
        updated_at: new Date().toISOString(),
      } as any).eq('id', editingCard.id);
      if (error) toast.error('Failed to update');
      else toast.success('Lead updated');
    } else {
      const { error } = await supabase.from('hot_list').insert({
        user_id: user!.id,
        ...payload,
        position: cards.filter(c => c.column_id === form.column_id).length,
      } as any);
      if (error) toast.error('Failed to add lead');
      else toast.success('Lead added');
    }
    setSaving(false);
    setModalOpen(false);
    loadCards();
  };

  const handleDelete = async (id: string) => {
    await supabase.from('hot_list').delete().eq('id', id);
    setCards(prev => prev.filter(c => c.id !== id));
    toast.success('Lead removed');
  };

  const handleDrop = async (targetColumnId: string) => {
    if (!draggedCardId) return;
    setCards(prev => prev.map(c =>
      c.id === draggedCardId ? { ...c, column_id: targetColumnId } : c
    ));
    await supabase
      .from('hot_list')
      .update({ column_id: targetColumnId, updated_at: new Date().toISOString() })
      .eq('id', draggedCardId);
    setDraggedCardId(null);
    setDragOverCol(null);
  };

  if (authLoading || loading) return null;

  const inputCls = "w-full px-3 py-2 bg-input border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40";

  return (
    <PageLayout>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Hot List</h1>
          <p className="text-sm text-muted-foreground">Track and nurture your leads through each stage.</p>
        </div>
        <button
          onClick={() => openAdd()}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:bg-primary/90 transition-colors"
        >
          <Plus className="w-4 h-4" /> Add Lead
        </button>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-4">
        {COLUMNS.map(col => {
          const colCards = cards.filter(c => c.column_id === col.id);
          return (
            <div
              key={col.id}
              onDragOver={e => { e.preventDefault(); setDragOverCol(col.id); }}
              onDragLeave={() => setDragOverCol(null)}
              onDrop={() => handleDrop(col.id)}
              className={`flex-shrink-0 w-[260px] rounded-xl p-3 transition-colors ${
                dragOverCol === col.id ? 'bg-accent/50 ring-2 ring-primary' : 'bg-muted/30'
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-semibold text-foreground">{col.label}</span>
                <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">{colCards.length}</span>
              </div>

              {colCards.map(card => (
                <div
                  key={card.id}
                  draggable
                  onDragStart={() => setDraggedCardId(card.id)}
                  className="bg-card border border-border rounded-lg p-3 mb-2 cursor-grab active:cursor-grabbing shadow-sm hover:shadow-md transition-shadow"
                >
                  <div className="flex justify-between items-start mb-1">
                    <span className="font-semibold text-sm text-foreground">{card.name}</span>
                    <div className="flex gap-1">
                      <button onClick={() => openEdit(card)} className="text-muted-foreground hover:text-foreground p-0.5">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => handleDelete(card.id)} className="text-muted-foreground hover:text-destructive p-0.5">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  {card.business_name && (
                    <p className="text-xs text-foreground/80">{card.business_name}</p>
                  )}
                  {card.email && <p className="text-xs text-muted-foreground">{card.email}</p>}
                  {card.phone && <p className="text-xs text-muted-foreground">{card.phone}</p>}
                  <div className="flex gap-2 mt-1 flex-wrap">
                    {card.source && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">{card.source}</span>
                    )}
                    {card.deal_value != null && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/15 text-primary font-semibold">
                        ${Number(card.deal_value).toLocaleString()}
                      </span>
                    )}
                  </div>
                  {card.notes && (
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{card.notes}</p>
                  )}
                </div>
              ))}

              <button
                onClick={() => openAdd(col.id)}
                className="w-full mt-1 py-2 text-xs text-muted-foreground hover:text-foreground border border-dashed border-border rounded-lg hover:bg-muted/50 transition-colors"
              >
                + Add
              </button>
            </div>
          );
        })}
      </div>

      {/* Modal */}
      {modalOpen && (
        <>
          <div className="fixed inset-0 z-40 bg-background/70" onClick={() => setModalOpen(false)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-card border border-border rounded-xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-foreground">{editingCard ? 'Edit Lead' : 'Add Lead'}</h2>
                <button onClick={() => setModalOpen(false)} className="text-muted-foreground hover:text-foreground">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-3">
                <input
                  type="text"
                  placeholder="Name *"
                  value={form.name}
                  onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                  className={inputCls}
                />
                <input
                  type="text"
                  placeholder="Business name"
                  value={form.business_name}
                  onChange={e => setForm(p => ({ ...p, business_name: e.target.value }))}
                  className={inputCls}
                />
                <input
                  type="tel"
                  placeholder="Phone"
                  value={form.phone}
                  onChange={e => setForm(p => ({ ...p, phone: e.target.value }))}
                  className={inputCls}
                />
                <input
                  type="email"
                  placeholder="Email"
                  value={form.email}
                  onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                  className={inputCls}
                />
                <input
                  type="text"
                  placeholder="Source (e.g. Instagram, referral)"
                  value={form.source}
                  onChange={e => setForm(p => ({ ...p, source: e.target.value }))}
                  className={inputCls}
                />
                <input
                  type="number"
                  inputMode="decimal"
                  placeholder="$ Value"
                  value={form.deal_value}
                  onChange={e => setForm(p => ({ ...p, deal_value: e.target.value }))}
                  className={inputCls}
                />
                <textarea
                  placeholder="Notes"
                  rows={3}
                  value={form.notes}
                  onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
                  className={`${inputCls} resize-none`}
                />

                {/* Stage selector */}
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1.5">Stage</p>
                  <div className="flex gap-2 flex-wrap">
                    {COLUMNS.map(col => (
                      <button
                        key={col.id}
                        onClick={() => setForm(p => ({ ...p, column_id: col.id }))}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                          form.column_id === col.id
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        {col.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex gap-2 mt-6">
                <button
                  onClick={() => setModalOpen(false)}
                  className="flex-1 px-4 py-2 bg-muted text-muted-foreground rounded-lg text-sm font-medium hover:text-foreground transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                  {saving ? 'Saving...' : editingCard ? 'Update' : 'Add Lead'}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </PageLayout>
  );
}

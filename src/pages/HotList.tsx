import { useState, useEffect } from 'react';
import PageLayout from '@/components/PageLayout';
import { useRequireAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, X, Mail, Phone, Flame, GripVertical } from 'lucide-react';

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
  { id: 'reached_out',      label: 'Reached Out',          emoji: '📤', accent: 'hsl(220, 70%, 60%)' },
  { id: 'call_taken',       label: 'Call / Proposal Sent', emoji: '📞', accent: 'hsl(190, 80%, 55%)' },
  { id: 'needs_push',       label: 'Needs Push',           emoji: '⏰', accent: 'hsl(38, 92%, 55%)'  },
  { id: 'meeting_taken',    label: 'Meeting Taken',        emoji: '🤝', accent: 'hsl(275, 90%, 70%)' },
  { id: 'two_stage_close',  label: '2-Stage Close',        emoji: '🎯', accent: 'hsl(310, 80%, 65%)' },
  { id: 'one_off_closed',   label: 'One-Off Closed',       emoji: '💵', accent: 'hsl(160, 70%, 50%)' },
  { id: 'retainer_closed',  label: 'Retainer Closed',      emoji: '✅', accent: 'hsl(150, 80%, 45%)' },
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

const formatMoney = (n: number) => {
  if (n >= 1000) return `$${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`;
  return `$${n.toLocaleString()}`;
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

  // Pipeline totals
  const totalLeads = cards.length;
  const pipelineValue = cards.reduce((sum, c) => sum + (Number(c.deal_value) || 0), 0);
  const closedValue = cards
    .filter(c => c.column_id === 'one_off_closed' || c.column_id === 'retainer_closed')
    .reduce((sum, c) => sum + (Number(c.deal_value) || 0), 0);

  const inputCls = "w-full px-3.5 py-2.5 bg-input/60 border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/40 transition-all";

  return (
    <PageLayout>
      {/* Header — stacks on mobile with breathing room */}
      <div className="mb-6 sm:mb-8">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-5">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center shadow-lg shadow-primary/20">
                <Flame className="w-4 h-4 text-primary-foreground" />
              </div>
              <span className="text-[11px] font-semibold tracking-[0.18em] uppercase text-muted-foreground">Pipeline</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold text-foreground italic tracking-tight">Hot List</h1>
            <p className="text-sm text-muted-foreground mt-1.5 max-w-md">
              Track and nurture every lead — drag cards between stages to move them through your pipeline.
            </p>
          </div>
          <button
            onClick={() => openAdd()}
            className="flex items-center justify-center gap-2 px-5 py-2.5 bg-gradient-to-r from-primary to-primary/80 text-primary-foreground rounded-lg text-sm font-semibold hover:shadow-lg hover:shadow-primary/30 transition-all w-full sm:w-auto shrink-0"
          >
            <Plus className="w-4 h-4" /> Add Lead
          </button>
        </div>

        {/* Pipeline summary stats */}
        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          <div className="bg-card/60 backdrop-blur-sm border border-border rounded-xl p-3 sm:p-4">
            <p className="text-[10px] sm:text-xs uppercase tracking-wider text-muted-foreground font-semibold">Total Leads</p>
            <p className="text-xl sm:text-2xl font-bold text-foreground mt-1">{totalLeads}</p>
          </div>
          <div className="bg-card/60 backdrop-blur-sm border border-border rounded-xl p-3 sm:p-4">
            <p className="text-[10px] sm:text-xs uppercase tracking-wider text-muted-foreground font-semibold">Pipeline</p>
            <p className="text-xl sm:text-2xl font-bold text-foreground mt-1">{formatMoney(pipelineValue)}</p>
          </div>
          <div className="bg-gradient-to-br from-primary/15 to-primary/5 border border-primary/30 rounded-xl p-3 sm:p-4">
            <p className="text-[10px] sm:text-xs uppercase tracking-wider text-primary/80 font-semibold">Closed</p>
            <p className="text-xl sm:text-2xl font-bold text-primary mt-1">{formatMoney(closedValue)}</p>
          </div>
        </div>
      </div>

      {/* Kanban */}
      <div className="flex gap-3 sm:gap-4 overflow-x-auto pb-4 -mx-4 sm:-mx-6 px-4 sm:px-6 snap-x snap-mandatory">
        {COLUMNS.map(col => {
          const colCards = cards.filter(c => c.column_id === col.id);
          const colTotal = colCards.reduce((s, c) => s + (Number(c.deal_value) || 0), 0);
          const isDragOver = dragOverCol === col.id;
          return (
            <div
              key={col.id}
              onDragOver={e => { e.preventDefault(); setDragOverCol(col.id); }}
              onDragLeave={() => setDragOverCol(null)}
              onDrop={() => handleDrop(col.id)}
              className={`flex-shrink-0 w-[280px] sm:w-[300px] rounded-2xl p-3 transition-all snap-start ${
                isDragOver
                  ? 'bg-primary/10 ring-2 ring-primary/60'
                  : 'bg-card/40 backdrop-blur-sm border border-border'
              }`}
            >
              {/* Column header with accent stripe */}
              <div className="mb-3 px-1">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ background: col.accent, boxShadow: `0 0 8px ${col.accent}` }}
                    />
                    <span className="text-sm font-semibold text-foreground">
                      {col.emoji} {col.label}
                    </span>
                  </div>
                  <span className="text-[11px] font-semibold text-muted-foreground bg-muted/60 px-2 py-0.5 rounded-full min-w-[22px] text-center">
                    {colCards.length}
                  </span>
                </div>
                {colTotal > 0 && (
                  <p className="text-[11px] text-muted-foreground pl-4">{formatMoney(colTotal)} potential</p>
                )}
              </div>

              {/* Cards */}
              <div className="space-y-2">
                {colCards.map(card => (
                  <div
                    key={card.id}
                    draggable
                    onDragStart={() => setDraggedCardId(card.id)}
                    className="group relative bg-card border border-border rounded-xl p-3.5 cursor-grab active:cursor-grabbing shadow-sm hover:shadow-xl hover:border-border/60 hover:-translate-y-0.5 transition-all overflow-hidden"
                  >
                    {/* Left accent stripe */}
                    <div
                      className="absolute left-0 top-0 bottom-0 w-1"
                      style={{ background: col.accent }}
                    />

                    <div className="flex justify-between items-start mb-1.5 pl-1">
                      <div className="min-w-0 flex-1">
                        <h3 className="font-semibold text-sm text-foreground truncate">{card.name}</h3>
                        {card.business_name && (
                          <p className="text-xs text-muted-foreground truncate mt-0.5">{card.business_name}</p>
                        )}
                      </div>
                      <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-2">
                        <button
                          onClick={() => openEdit(card)}
                          className="text-muted-foreground hover:text-foreground p-1 rounded hover:bg-muted/60"
                          aria-label="Edit"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(card.id)}
                          className="text-muted-foreground hover:text-destructive p-1 rounded hover:bg-destructive/10"
                          aria-label="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Contact */}
                    {(card.email || card.phone) && (
                      <div className="space-y-0.5 pl-1 mb-2">
                        {card.email && (
                          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                            <Mail className="w-3 h-3 shrink-0" />
                            <span className="truncate">{card.email}</span>
                          </div>
                        )}
                        {card.phone && (
                          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                            <Phone className="w-3 h-3 shrink-0" />
                            <span className="truncate">{card.phone}</span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Tags */}
                    {(card.source || card.deal_value != null) && (
                      <div className="flex gap-1.5 flex-wrap pl-1 mb-1.5">
                        {card.deal_value != null && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/15 text-primary border border-primary/20">
                            {formatMoney(Number(card.deal_value))}
                          </span>
                        )}
                        {card.source && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted/70 text-muted-foreground border border-border/50">
                            {card.source}
                          </span>
                        )}
                      </div>
                    )}

                    {card.notes && (
                      <p className="text-[11px] text-muted-foreground/80 mt-1.5 pl-1 line-clamp-2 leading-relaxed">
                        {card.notes}
                      </p>
                    )}
                  </div>
                ))}
              </div>

              <button
                onClick={() => openAdd(col.id)}
                className="w-full mt-2 py-2 text-xs text-muted-foreground hover:text-foreground border border-dashed border-border rounded-lg hover:bg-muted/40 hover:border-primary/40 transition-all flex items-center justify-center gap-1.5"
              >
                <Plus className="w-3 h-3" /> Add lead
              </button>
            </div>
          );
        })}
      </div>

      {/* Modal */}
      {modalOpen && (
        <>
          <div className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm animate-fade-in" onClick={() => setModalOpen(false)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-card border border-border rounded-2xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto shadow-2xl animate-scale-in">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h2 className="text-xl font-bold text-foreground italic">{editingCard ? 'Edit Lead' : 'Add Lead'}</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {editingCard ? 'Update the details below' : 'Add a new prospect to your pipeline'}
                  </p>
                </div>
                <button
                  onClick={() => setModalOpen(false)}
                  className="text-muted-foreground hover:text-foreground hover:bg-muted/60 p-1.5 rounded-lg transition-colors"
                  aria-label="Close"
                >
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
                <div className="grid grid-cols-2 gap-3">
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
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <input
                    type="text"
                    placeholder="Source"
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
                </div>
                <textarea
                  placeholder="Notes"
                  rows={3}
                  value={form.notes}
                  onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
                  className={`${inputCls} resize-none`}
                />

                {/* Stage selector */}
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Stage</p>
                  <div className="flex gap-1.5 flex-wrap">
                    {COLUMNS.map(col => (
                      <button
                        key={col.id}
                        onClick={() => setForm(p => ({ ...p, column_id: col.id }))}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all flex items-center gap-1.5 ${
                          form.column_id === col.id
                            ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20'
                            : 'bg-muted/60 text-muted-foreground hover:text-foreground hover:bg-muted'
                        }`}
                      >
                        <span>{col.emoji}</span> {col.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex gap-2 mt-6">
                <button
                  onClick={() => setModalOpen(false)}
                  className="flex-1 px-4 py-2.5 bg-muted/60 text-muted-foreground rounded-lg text-sm font-medium hover:text-foreground hover:bg-muted transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex-1 px-4 py-2.5 bg-gradient-to-r from-primary to-primary/80 text-primary-foreground rounded-lg text-sm font-semibold hover:shadow-lg hover:shadow-primary/30 transition-all disabled:opacity-50"
                >
                  {saving ? 'Saving...' : editingCard ? 'Update Lead' : 'Add Lead'}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </PageLayout>
  );
}

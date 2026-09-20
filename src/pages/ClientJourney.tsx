import { useEffect, useState } from 'react';
import PageLayout from '@/components/PageLayout';
import { useRequireAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { Plus, Trash2, ChevronRight, Mail, Phone, Compass, X } from 'lucide-react';

interface ClientJourneyCard {
  id: string;
  name: string;
  phone: string;
  email?: string | null;
  stage: string;
  added_date: string;
}

const STAGES = [
  { id: 'new',             label: 'New Client',        description: 'Just signed',        emoji: '🆕', accent: 'hsl(220, 70%, 60%)' },
  { id: 'payment',         label: 'Payment Confirmed', description: 'Phone collected',    emoji: '💳', accent: 'hsl(190, 80%, 55%)' },
  { id: 'onboarding',      label: 'Onboarding Sent',   description: 'WhatsApp/links sent', emoji: '📨', accent: 'hsl(38, 92%, 55%)'  },
  { id: 'pre_call',        label: 'Pre-Call',          description: 'Message 1 sent',     emoji: '💬', accent: 'hsl(275, 90%, 70%)' },
  { id: 'call1_scheduled', label: 'Call 1 Scheduled',  description: 'Awaiting call',      emoji: '📅', accent: 'hsl(310, 80%, 65%)' },
  { id: 'call1_complete',  label: 'Call 1 Complete',   description: 'Tasks assigned',     emoji: '✅', accent: 'hsl(160, 70%, 50%)' },
  { id: 'call2_scheduled', label: 'Call 2 Scheduled',  description: 'Awaiting call',      emoji: '📆', accent: 'hsl(200, 80%, 60%)' },
  { id: 'active',          label: 'Active',            description: 'Ongoing coaching',   emoji: '🚀', accent: 'hsl(150, 80%, 45%)' },
];

const emptyForm = { name: '', phone: '', email: '' };

export default function ClientJourney() {
  const { user, loading: authLoading } = useRequireAuth();
  const [clients, setClients] = useState<ClientJourneyCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewForm, setShowNewForm] = useState(false);
  const [newClient, setNewClient] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverStage, setDragOverStage] = useState<string | null>(null);

  useEffect(() => {
    if (user) fetchClients();
  }, [user]);

  const fetchClients = async () => {
    const { data, error } = await supabase
      .from('client_journey')
      .select('*')
      .order('added_date', { ascending: false });

    if (error) {
      toast.error('Failed to load clients');
      console.error(error);
    } else {
      setClients(data ?? []);
    }
    setLoading(false);
  };

  const handleAddClient = async () => {
    if (!newClient.name.trim() || !newClient.phone.trim()) {
      toast.error('Name and phone are required');
      return;
    }
    setSaving(true);
    const { error } = await supabase.from('client_journey').insert({
      user_id: user!.id,
      name: newClient.name.trim(),
      phone: newClient.phone.trim(),
      email: newClient.email.trim() || null,
      stage: 'new',
    });
    setSaving(false);

    if (error) {
      toast.error('Failed to add client');
      console.error(error);
      return;
    }
    toast.success('Client added to journey');
    setNewClient(emptyForm);
    setShowNewForm(false);
    fetchClients();
  };

  const handleMoveStage = async (clientId: string, newStage: string) => {
    const previous = clients;
    setClients(prev => prev.map(c => (c.id === clientId ? { ...c, stage: newStage } : c)));

    const { error } = await supabase
      .from('client_journey')
      .update({ stage: newStage, updated_at: new Date().toISOString() })
      .eq('id', clientId);

    if (error) {
      setClients(previous);
      toast.error('Failed to update stage');
      console.error(error);
    }
  };

  const handleDeleteClient = async (clientId: string) => {
    if (!confirm('Remove this client from the journey?')) return;
    const previous = clients;
    setClients(prev => prev.filter(c => c.id !== clientId));

    const { error } = await supabase.from('client_journey').delete().eq('id', clientId);
    if (error) {
      setClients(previous);
      toast.error('Failed to remove client');
      console.error(error);
    } else {
      toast.success('Client removed');
    }
  };

  const handleDrop = (stageId: string) => {
    setDragOverStage(null);
    if (!draggedId) return;
    const card = clients.find(c => c.id === draggedId);
    setDraggedId(null);
    if (!card || card.stage === stageId) return;
    handleMoveStage(card.id, stageId);
  };

  if (authLoading || loading) return null;

  const activeCount = clients.filter(c => c.stage === 'active').length;
  const inFlight = clients.length - activeCount;
  const inputCls = "w-full px-3.5 py-2.5 bg-input/60 border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/40 transition-all";

  return (
    <PageLayout>
      {/* Header */}
      <div className="mb-6 sm:mb-8">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-5">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center shadow-lg shadow-primary/20">
                <Compass className="w-4 h-4 text-primary-foreground" />
              </div>
              <span className="text-[11px] font-semibold tracking-[0.18em] uppercase text-muted-foreground">Onboarding</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold text-foreground italic tracking-tight">Client Journey</h1>
            <p className="text-sm text-muted-foreground mt-1.5 max-w-md">
              Every signed client from payment through to active coaching — drag cards between stages as they progress.
            </p>
          </div>
          {!showNewForm && (
            <button
              onClick={() => setShowNewForm(true)}
              className="flex items-center justify-center gap-2 px-5 py-2.5 bg-gradient-to-r from-primary to-primary/80 text-primary-foreground rounded-lg text-sm font-semibold hover:shadow-lg hover:shadow-primary/30 transition-all w-full sm:w-auto shrink-0"
            >
              <Plus className="w-4 h-4" /> Add New Client
            </button>
          )}
        </div>

        {/* Summary stats */}
        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          <div className="bg-card/60 backdrop-blur-sm border border-border rounded-xl p-3 sm:p-4">
            <p className="text-[10px] sm:text-xs uppercase tracking-wider text-muted-foreground font-semibold">Total Clients</p>
            <p className="text-xl sm:text-2xl font-bold text-foreground mt-1">{clients.length}</p>
          </div>
          <div className="bg-card/60 backdrop-blur-sm border border-border rounded-xl p-3 sm:p-4">
            <p className="text-[10px] sm:text-xs uppercase tracking-wider text-muted-foreground font-semibold">Onboarding</p>
            <p className="text-xl sm:text-2xl font-bold text-foreground mt-1">{inFlight}</p>
          </div>
          <div className="bg-gradient-to-br from-primary/15 to-primary/5 border border-primary/30 rounded-xl p-3 sm:p-4">
            <p className="text-[10px] sm:text-xs uppercase tracking-wider text-primary/80 font-semibold">Active</p>
            <p className="text-xl sm:text-2xl font-bold text-primary mt-1">{activeCount}</p>
          </div>
        </div>
      </div>

      {/* Add client form */}
      {showNewForm && (
        <div className="mb-6 bg-card border border-border rounded-2xl p-4 sm:p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-foreground">New client</h2>
            <button
              onClick={() => { setShowNewForm(false); setNewClient(emptyForm); }}
              className="text-muted-foreground hover:text-foreground p-1 rounded hover:bg-muted/60"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <input
              className={inputCls}
              placeholder="Client name"
              value={newClient.name}
              onChange={(e) => setNewClient({ ...newClient, name: e.target.value })}
            />
            <input
              className={inputCls}
              placeholder="Phone number"
              value={newClient.phone}
              onChange={(e) => setNewClient({ ...newClient, phone: e.target.value })}
            />
            <input
              className={inputCls}
              placeholder="Email (optional)"
              type="email"
              value={newClient.email}
              onChange={(e) => setNewClient({ ...newClient, email: e.target.value })}
            />
          </div>
          <div className="flex gap-2 mt-3">
            <button
              onClick={handleAddClient}
              disabled={saving}
              className="px-5 py-2.5 bg-gradient-to-r from-primary to-primary/80 text-primary-foreground rounded-lg text-sm font-semibold hover:shadow-lg hover:shadow-primary/30 transition-all disabled:opacity-60"
            >
              {saving ? 'Adding…' : 'Add Client'}
            </button>
            <button
              onClick={() => { setShowNewForm(false); setNewClient(emptyForm); }}
              className="px-5 py-2.5 border border-border rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-all"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Kanban */}
      <div className="flex gap-3 sm:gap-4 overflow-x-auto pb-4 -mx-4 sm:-mx-6 px-4 sm:px-6 snap-x snap-mandatory">
        {STAGES.map((stage, stageIndex) => {
          const stageClients = clients.filter(c => c.stage === stage.id);
          const isDragOver = dragOverStage === stage.id;
          return (
            <div
              key={stage.id}
              onDragOver={e => { e.preventDefault(); setDragOverStage(stage.id); }}
              onDragLeave={() => setDragOverStage(null)}
              onDrop={() => handleDrop(stage.id)}
              className={`flex-shrink-0 w-[280px] sm:w-[300px] rounded-2xl p-3 transition-all snap-start ${
                isDragOver
                  ? 'bg-primary/10 ring-2 ring-primary/60'
                  : 'bg-card/40 backdrop-blur-sm border border-border'
              }`}
            >
              {/* Stage header */}
              <div className="mb-3 px-1">
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ background: stage.accent, boxShadow: `0 0 8px ${stage.accent}` }}
                    />
                    <span className="text-sm font-semibold text-foreground">
                      {stage.emoji} {stage.label}
                    </span>
                  </div>
                  <span className="text-[11px] font-semibold text-muted-foreground bg-muted/60 px-2 py-0.5 rounded-full min-w-[22px] text-center">
                    {stageClients.length}
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground pl-4">{stage.description}</p>
              </div>

              {/* Cards */}
              <div className="space-y-2">
                {stageClients.map(client => (
                  <div
                    key={client.id}
                    draggable
                    onDragStart={() => setDraggedId(client.id)}
                    onDragEnd={() => setDraggedId(null)}
                    className="group relative bg-card border border-border rounded-xl p-3.5 cursor-grab active:cursor-grabbing shadow-sm hover:shadow-xl hover:border-border/60 hover:-translate-y-0.5 transition-all overflow-hidden"
                  >
                    <div
                      className="absolute left-0 top-0 bottom-0 w-1"
                      style={{ background: stage.accent }}
                    />

                    <div className="flex justify-between items-start mb-1.5 pl-1">
                      <h3 className="font-semibold text-sm text-foreground truncate min-w-0 flex-1">{client.name}</h3>
                      <button
                        onClick={() => handleDeleteClient(client.id)}
                        className="text-muted-foreground hover:text-destructive p-1 rounded hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-2"
                        aria-label="Remove"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="space-y-0.5 pl-1 mb-2">
                      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                        <Phone className="w-3 h-3 shrink-0" />
                        <span className="truncate">{client.phone}</span>
                      </div>
                      {client.email && (
                        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                          <Mail className="w-3 h-3 shrink-0" />
                          <span className="truncate">{client.email}</span>
                        </div>
                      )}
                    </div>

                    {stageIndex < STAGES.length - 1 && (
                      <button
                        onClick={() => handleMoveStage(client.id, STAGES[stageIndex + 1].id)}
                        className="flex items-center justify-center gap-1 w-full text-[11px] font-medium px-2 py-1.5 rounded-lg text-muted-foreground border border-dashed border-border hover:text-foreground hover:bg-muted/40 hover:border-primary/40 transition-all"
                      >
                        Move to {STAGES[stageIndex + 1].label}
                        <ChevronRight className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {stageClients.length === 0 && (
                <p className="text-[11px] text-muted-foreground/70 text-center py-6">No clients here</p>
              )}
            </div>
          );
        })}
      </div>

      {clients.length === 0 && (
        <div className="text-center py-12">
          <p className="text-muted-foreground">No clients in the journey yet</p>
          <button
            onClick={() => setShowNewForm(true)}
            className="mt-3 text-sm font-semibold text-primary hover:underline"
          >
            Add your first client
          </button>
        </div>
      )}
    </PageLayout>
  );
}

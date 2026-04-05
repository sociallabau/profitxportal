import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import PageLayout from '@/components/PageLayout';
import { supabase } from '@/lib/supabase';
import { useRequireAuth } from '@/hooks/useAuth';

type HealthStatus = 'green' | 'amber' | 'red';

function autoStatus(row: any): HealthStatus {
  const daysSince = row.days_since_submission ?? 999;
  const nps = row.last_nps ?? 5;
  const conf = row.last_confidence ?? 5;
  if (daysSince > 45 || nps <= 3 || conf <= 3) return 'red';
  if (daysSince > 25 || nps <= 5 || conf <= 5) return 'amber';
  return 'green';
}

function StatusDot({ status }: { status: HealthStatus }) {
  const map = { green: 'bg-green-500', amber: 'bg-amber-400', red: 'bg-red-500' };
  return <span className={`inline-block w-3 h-3 rounded-full ${map[status]} flex-shrink-0`} />;
}

export default function ClientHealth() {
  const { user, loading } = useRequireAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [noteText, setNoteText] = useState('');
  const [statusOverride, setStatusOverride] = useState<HealthStatus | 'auto'>('auto');

  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ['profile', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('is_admin').eq('id', user!.id).single();
      return data;
    },
  });

  const { data: clients = [], isLoading } = useQuery({
    queryKey: ['admin-client-overview'],
    enabled: !!user && !!profile?.is_admin,
    queryFn: async () => {
      const { data } = await supabase.from('admin_client_overview').select('*').order('full_name');
      return data ?? [];
    },
  });

  const saveHealth = useMutation({
    mutationFn: async ({ clientId, status, notes }: { clientId: string; status: HealthStatus | 'auto'; notes: string }) => {
      const finalStatus = status === 'auto' ? autoStatus(clients.find((c: any) => c.id === clientId)) : status;
      const { error } = await supabase.from('client_health').upsert(
        { client_user_id: clientId, health_status: finalStatus, notes, updated_at: new Date().toISOString() },
        { onConflict: 'client_user_id' }
      );
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-client-overview'] });
      setEditingId(null);
    },
  });

  if (loading || profileLoading) return null;
  if (!profile?.is_admin) {
    navigate('/dashboard');
    return null;
  }

  const green  = (clients as any[]).filter(c => (c.manual_status ?? autoStatus(c)) === 'green').length;
  const amber  = (clients as any[]).filter(c => (c.manual_status ?? autoStatus(c)) === 'amber').length;
  const red    = (clients as any[]).filter(c => (c.manual_status ?? autoStatus(c)) === 'red').length;

  return (
    <PageLayout>
      <h1 className="text-2xl font-bold mb-1">Client Health</h1>
      <p className="text-sm text-muted-foreground mb-6">
        Auto-calculated from monthly submissions, NPS, and confidence scores. Override manually where needed.
      </p>

      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-card border border-green-500/20 rounded-xl p-4 text-center">
          <p className="text-xs text-muted-foreground mb-1">On Track</p>
          <p className="text-2xl font-bold text-green-500">{green}</p>
        </div>
        <div className="bg-card border border-amber-400/20 rounded-xl p-4 text-center">
          <p className="text-xs text-muted-foreground mb-1">Check In</p>
          <p className="text-2xl font-bold text-amber-400">{amber}</p>
        </div>
        <div className="bg-card border border-red-500/20 rounded-xl p-4 text-center">
          <p className="text-xs text-muted-foreground mb-1">At Risk</p>
          <p className="text-2xl font-bold text-red-500">{red}</p>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1,2,3].map(i => <div key={i} className="bg-card border border-border rounded-xl h-20 animate-pulse" />)}
        </div>
      ) : (
        <div className="space-y-2">
          {(clients as any[]).map((client: any) => {
            const computed = autoStatus(client);
            const display: HealthStatus = (client.manual_status as HealthStatus) ?? computed;
            const isEditing = editingId === client.id;

            return (
              <div key={client.id} className={`bg-card border rounded-xl p-4 transition-all ${
                display === 'red' ? 'border-red-500/30' : display === 'amber' ? 'border-amber-400/30' : 'border-green-500/20'
              }`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <StatusDot status={display} />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">{client.full_name ?? 'Unnamed'}</p>
                      <p className="text-xs text-muted-foreground capitalize">{client.tier ?? 'onramp'}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 text-xs text-muted-foreground flex-shrink-0">
                    <div className="text-center hidden sm:block">
                      <p className="font-semibold text-foreground">{client.days_since_submission != null ? `${client.days_since_submission}d` : '—'}</p>
                      <p>last sub</p>
                    </div>
                    <div className="text-center hidden sm:block">
                      <p className="font-semibold text-foreground">{client.last_nps ?? '—'}</p>
                      <p>NPS</p>
                    </div>
                    <div className="text-center hidden sm:block">
                      <p className="font-semibold text-foreground">{client.last_confidence ?? '—'}</p>
                      <p>conf</p>
                    </div>
                    <div className="text-center hidden sm:block">
                      <p className="font-semibold text-foreground">{client.last_mrr ? `$${Number(client.last_mrr).toLocaleString()}` : '—'}</p>
                      <p>MRR</p>
                    </div>
                    <button onClick={() => {
                      setEditingId(isEditing ? null : client.id);
                      setNoteText(client.health_notes ?? '');
                      setStatusOverride((client.manual_status as HealthStatus) ?? 'auto');
                    }}
                      className="text-xs text-primary hover:underline flex-shrink-0">
                      {isEditing ? 'Cancel' : 'Edit'}
                    </button>
                  </div>
                </div>

                {(client.last_needs || client.last_biggest_win) && (
                  <div className="mt-3 pl-6 space-y-1">
                    {client.last_biggest_win && (
                      <p className="text-xs text-foreground"><span className="text-muted-foreground">Win: </span>{client.last_biggest_win}</p>
                    )}
                    {client.last_needs && (
                      <p className="text-xs text-amber-400"><span className="text-muted-foreground">Needs: </span>{client.last_needs}</p>
                    )}
                  </div>
                )}

                {client.health_notes && !isEditing && (
                  <p className="mt-2 pl-6 text-xs text-muted-foreground italic">"{client.health_notes}"</p>
                )}

                {isEditing && (
                  <div className="mt-4 pl-6 space-y-3 border-t border-border pt-4">
                    <div>
                      <label className="text-xs font-semibold text-foreground mb-1 block">Override status</label>
                      <div className="flex gap-2">
                        {(['auto', 'green', 'amber', 'red'] as const).map(s => (
                          <button key={s} onClick={() => setStatusOverride(s)}
                            className={`px-3 py-1 rounded-full text-xs font-semibold border transition-all ${statusOverride === s ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground'}`}>
                            {s === 'auto' ? `Auto (${computed})` : s}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-foreground mb-1 block">Your notes</label>
                      <textarea value={noteText} onChange={e => setNoteText(e.target.value)} rows={2}
                        placeholder="e.g. Needs push on outreach, great momentum this month..."
                        className="w-full px-3 py-2 bg-input border border-border rounded-lg text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 transition resize-none" />
                    </div>
                    <button
                      onClick={() => saveHealth.mutate({ clientId: client.id, status: statusOverride, notes: noteText })}
                      disabled={saveHealth.isPending}
                      className="px-4 py-1.5 bg-primary text-primary-foreground text-xs font-semibold rounded-lg hover:bg-primary/90 transition disabled:opacity-50"
                    >
                      {saveHealth.isPending ? 'Saving...' : 'Save'}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </PageLayout>
  );
}

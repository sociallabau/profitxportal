import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import PageLayout from '@/components/PageLayout';
import { supabase } from '@/lib/supabase';
import { useRequireAuth } from '@/hooks/useAuth';

export default function NewClients() {
  const { user } = useRequireAuth();
  const qc = useQueryClient();
  const [form, setForm] = useState({ client_name: '', monthly_value: '', notes: '' });
  const [saved, setSaved] = useState(false);

  const { data: clients } = useQuery({
    queryKey: ['new-clients', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from('new_clients')
        .select('*')
        .eq('user_id', user!.id)
        .order('signed_date', { ascending: false });
      return data ?? [];
    },
  });

  const addClient = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('new_clients').insert({
        user_id: user!.id,
        client_name: form.client_name,
        monthly_value: parseFloat(form.monthly_value),
        signed_date: new Date().toISOString().split('T')[0],
        notes: form.notes,
      });
      if (error) throw error;

      await supabase.from('weekly_wins').insert({
        user_id: user!.id,
        win_text: `New retainer client signed: ${form.client_name} — $${parseFloat(form.monthly_value).toLocaleString()}/mo 🎉`,
        week_ending: new Date().toISOString().split('T')[0],
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['new-clients'] });
      qc.invalidateQueries({ queryKey: ['recent-clients'] });
      qc.invalidateQueries({ queryKey: ['wins-wall'] });
      qc.invalidateQueries({ queryKey: ['retainer-clients-mrr'] });
      setForm({ client_name: '', monthly_value: '', notes: '' });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    },
  });

  const totalMRR = clients?.reduce((sum, c) => sum + Number(c.monthly_value), 0) ?? 0;

  return (
    <PageLayout>
      <h1 className="text-2xl mb-1">New Clients</h1>
      <p className="text-sm text-muted-foreground mb-6">
        Log a new retainer client. This updates your contracted MRR and posts to the Wins Wall.
      </p>

      <div className="bg-card border border-border rounded-xl p-5 mb-6 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-foreground mb-1.5">Client Name</label>
            <input
              value={form.client_name}
              onChange={(e) => setForm({ ...form, client_name: e.target.value })}
              placeholder="Studio Bloom"
              className="w-full px-4 py-2.5 bg-input border border-border rounded-lg text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 transition"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-foreground mb-1.5">Monthly Value ($)</label>
            <input
              type="number"
              value={form.monthly_value}
              onChange={(e) => setForm({ ...form, monthly_value: e.target.value })}
              placeholder="2500"
              className="w-full px-4 py-2.5 bg-input border border-border rounded-lg text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 transition"
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-semibold text-foreground mb-1.5">Notes (optional)</label>
          <input
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            placeholder="e.g. 3-month contract, social media content..."
            className="w-full px-4 py-2.5 bg-input border border-border rounded-lg text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 transition"
          />
        </div>
        <div className="flex items-center justify-between pt-1">
          {saved ? (
            <span className="text-sm text-success">✓ Client saved and posted to Wins Wall!</span>
          ) : (
            <span className="text-xs text-muted-foreground">Logging a client auto-updates your MRR and Wins Wall.</span>
          )}
          <button
            onClick={() => addClient.mutate()}
            disabled={!form.client_name || !form.monthly_value || addClient.isPending}
            className="px-5 py-2 bg-primary text-primary-foreground font-semibold rounded-lg text-sm hover:bg-primary/90 transition-all disabled:opacity-50"
          >
            {addClient.isPending ? 'Saving...' : 'Add Client →'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-card border border-border rounded-xl p-4 text-center">
          <p className="text-xs text-muted-foreground mb-1">Total Clients Logged</p>
          <p className="text-2xl font-bold text-foreground">{clients?.length ?? 0}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4 text-center">
          <p className="text-xs text-muted-foreground mb-1">Contracted MRR</p>
          <p className="text-2xl font-bold text-primary">${totalMRR.toLocaleString()}</p>
        </div>
      </div>

      {clients && clients.length > 0 && (
        <div className="space-y-2">
          {clients.map(c => (
            <div key={c.id} className="flex items-center justify-between bg-card border border-border rounded-lg px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-foreground">{c.client_name}</p>
                {c.notes && <p className="text-xs text-muted-foreground mt-0.5">{c.notes}</p>}
              </div>
              <div className="text-right">
                <p className="text-sm font-bold text-primary">${Number(c.monthly_value).toLocaleString()}/mo</p>
                <p className="text-xs text-muted-foreground">{new Date(c.signed_date).toLocaleDateString()}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </PageLayout>
  );
}

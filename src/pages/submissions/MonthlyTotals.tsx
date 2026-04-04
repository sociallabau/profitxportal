import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import PageLayout from '@/components/PageLayout';
import { supabase } from '@/lib/supabase';
import { useRequireAuth } from '@/hooks/useAuth';

export default function MonthlyTotals() {
  const { user } = useRequireAuth();
  const qc = useQueryClient();
  const currentMonth = new Date().toISOString().slice(0, 7);
  const [form, setForm] = useState({
    oneoff_revenue: '', expenses: '',
    new_clients: '', leads_generated: '', content_posts: '',
  });
  const [saved, setSaved] = useState(false);

  const { data: retainerClients = [] } = useQuery({
    queryKey: ['retainer-clients-mrr', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from('new_clients')
        .select('monthly_value')
        .eq('user_id', user!.id);
      return data ?? [];
    },
  });

  const calculatedMRR = retainerClients.reduce(
    (sum: number, client: any) => sum + Number(client.monthly_value),
    0
  );

  const { data: history } = useQuery({
    queryKey: ['monthly-totals-history', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from('monthly_totals')
        .select('*')
        .eq('user_id', user!.id)
        .order('month', { ascending: false });
      return data ?? [];
    },
  });

  const submitMonth = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('monthly_totals').upsert({
        user_id: user!.id,
        month: `${currentMonth}-01`,
        mrr: calculatedMRR,
        oneoff_revenue: parseFloat(form.oneoff_revenue) || 0,
        expenses: parseFloat(form.expenses) || 0,
        new_clients: parseInt(form.new_clients) || 0,
        leads_generated: parseInt(form.leads_generated) || 0,
        content_posts: parseInt(form.content_posts) || 0,
      }, { onConflict: 'user_id,month' });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['monthly-totals'] });
      qc.invalidateQueries({ queryKey: ['monthly-totals-history'] });
      setForm({ oneoff_revenue: '', expenses: '', new_clients: '', leads_generated: '', content_posts: '' });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    },
  });

  const manualFields = [
    { key: 'oneoff_revenue', label: 'One-Off Shoots ($)', placeholder: '2000' },
    { key: 'expenses', label: 'Expenses ($)', placeholder: '3200' },
  ];

  const kpiFields = [
    { key: 'new_clients', label: 'New Clients Signed', placeholder: '2' },
    { key: 'leads_generated', label: 'Leads Generated', placeholder: '12' },
    { key: 'content_posts', label: 'Content Posts Published', placeholder: '20' },
  ];

  return (
    <PageLayout>
      <h1 className="text-2xl mb-1">Monthly Totals</h1>
      <p className="text-sm text-muted-foreground mb-6">
        Submit your numbers for {new Date().toLocaleString('default', { month: 'long', year: 'numeric' })}.
        This automatically updates your dashboard and financials.
      </p>

      <div className="bg-card border border-border rounded-xl p-5 mb-6">
        <h3 className="text-xs uppercase tracking-wider text-muted-foreground mb-3">
          Retainer MRR — auto-calculated from your clients
        </h3>
        <div className="flex items-center gap-3 mb-5 px-4 py-3 bg-primary/5 border border-primary/20 rounded-lg">
          <div>
            <p className="text-xs text-muted-foreground mb-0.5">Current Retainer MRR</p>
            <p className="text-2xl font-bold text-primary">${calculatedMRR.toLocaleString()}</p>
          </div>
          <p className="text-xs text-muted-foreground ml-auto max-w-[200px] text-right">
            Sum of all retainer clients logged in New Clients.
            To update this, add or remove clients there.
          </p>
        </div>

        <h3 className="text-xs uppercase tracking-wider text-muted-foreground mb-3">Revenue &amp; Expenses</h3>
        <p className="text-xs text-muted-foreground mb-4">
          One-off shoots add to your total revenue this month but do not count toward MRR.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          {manualFields.map((f) => (
            <div key={f.key}>
              <label className="block text-sm font-semibold text-foreground mb-1.5">{f.label}</label>
              <input
                type="number"
                value={form[f.key as keyof typeof form]}
                onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                placeholder={f.placeholder}
                className="w-full px-4 py-2.5 bg-input border border-border rounded-lg text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 transition"
              />
            </div>
          ))}
        </div>

        {/* KPI section */}
        <h3 className="text-xs uppercase tracking-wider text-muted-foreground mb-3">Growth KPIs</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
          {kpiFields.map((f) => (
            <div key={f.key}>
              <label className="block text-sm font-semibold text-foreground mb-1.5">{f.label}</label>
              <input
                type="number"
                value={form[f.key as keyof typeof form]}
                onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                placeholder={f.placeholder}
                className="w-full px-4 py-2.5 bg-input border border-border rounded-lg text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 transition"
              />
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between pt-1">
          {saved ? (
            <span className="text-sm text-success">✓ Saved! Dashboard and financials updated.</span>
          ) : <span className="text-xs text-muted-foreground">MRR snapshot: ${calculatedMRR.toLocaleString()} · One-offs logged separately</span>}
          <button
            onClick={() => submitMonth.mutate()}
            disabled={submitMonth.isPending}
            className="px-5 py-2 bg-primary text-primary-foreground font-semibold rounded-lg text-sm hover:bg-primary/90 transition-all disabled:opacity-50"
          >
            {submitMonth.isPending ? 'Saving...' : 'Submit Month →'}
          </button>
        </div>
      </div>

      {history && history.length > 0 && (
        <>
          <h2 className="text-base font-semibold text-foreground mb-3">Submission History</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="pb-2 text-xs font-semibold text-muted-foreground">Month</th>
                  <th className="pb-2 text-xs font-semibold text-muted-foreground">Retainer MRR</th>
                  <th className="pb-2 text-xs font-semibold text-muted-foreground">One-Offs</th>
                  <th className="pb-2 text-xs font-semibold text-muted-foreground">Total Revenue</th>
                  <th className="pb-2 text-xs font-semibold text-muted-foreground">Expenses</th>
                  <th className="pb-2 text-xs font-semibold text-muted-foreground">Profit</th>
                </tr>
              </thead>
              <tbody>
                {history.map((row: any) => {
                  const mrr = Number(row.mrr) || 0;
                  const oneoffs = Number(row.oneoff_revenue) || 0;
                  const expenses = Number(row.expenses) || 0;
                  const totalRevenue = mrr + oneoffs;
                  const profit = totalRevenue - expenses;
                  return (
                    <tr key={row.id} className="border-b border-border/50">
                      <td className="py-2.5 text-foreground">{new Date(row.month).toLocaleString('default', { month: 'short', year: 'numeric' })}</td>
                      <td className="py-2.5 font-semibold text-primary">${mrr.toLocaleString()}</td>
                      <td className="py-2.5 text-foreground">${oneoffs.toLocaleString()}</td>
                      <td className="py-2.5 text-foreground">${totalRevenue.toLocaleString()}</td>
                      <td className="py-2.5 text-muted-foreground">${expenses.toLocaleString()}</td>
                      <td className={`py-2.5 font-semibold ${profit >= 0 ? 'text-success' : 'text-destructive'}`}>${profit.toLocaleString()}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </PageLayout>
  );
}

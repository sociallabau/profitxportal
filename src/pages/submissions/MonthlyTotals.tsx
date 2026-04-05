import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import PageLayout from '@/components/PageLayout';
import { supabase } from '@/lib/supabase';
import { useRequireAuth } from '@/hooks/useAuth';

function ScoreSlider({ label, sublabel, value, onChange }: {
  label: string; sublabel?: string; value: string; onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="block text-sm font-semibold text-foreground mb-0.5">{label}</label>
      {sublabel && <p className="text-xs text-muted-foreground mb-2">{sublabel}</p>}
      <div className="flex items-center gap-3">
        <input
          type="range" min="1" max="10" value={value || 5}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 accent-primary"
        />
        <span className="text-lg font-bold text-primary w-6 text-center">{value || '–'}</span>
      </div>
      <div className="flex justify-between text-xs text-muted-foreground mt-1">
        <span>1 — Struggling</span><span>10 — Crushing it</span>
      </div>
    </div>
  );
}

export default function MonthlyTotals() {
  const { user } = useRequireAuth();
  const qc = useQueryClient();
  const currentMonth = new Date().toISOString().slice(0, 7);

  const [form, setForm] = useState({
    oneoff_revenue: '', expenses: '', new_clients: '',
    leads_generated: '', content_posts: '',
    business_confidence: '5', nps: '5',
    biggest_win: '', needs_this_month: '',
    offers_made: '', booked_calls: '', calls_showed: '',
  });
  const [saved, setSaved] = useState(false);

  const { data: retainerClients = [] } = useQuery({
    queryKey: ['retainer-clients-mrr', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from('new_clients').select('monthly_value').eq('user_id', user!.id);
      return data ?? [];
    },
  });
  const calculatedMRR = retainerClients.reduce((sum: number, c: any) => sum + Number(c.monthly_value), 0);

  const { data: history } = useQuery({
    queryKey: ['monthly-totals-history', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from('monthly_totals').select('*').eq('user_id', user!.id).order('month', { ascending: false });
      return data ?? [];
    },
  });

  const submit = useMutation({
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
        business_confidence: parseInt(form.business_confidence) || null,
        nps: parseInt(form.nps) || null,
        biggest_win: form.biggest_win || null,
        needs_this_month: form.needs_this_month || null,
        offers_made: parseInt(form.offers_made) || 0,
        booked_calls: parseInt(form.booked_calls) || 0,
        calls_showed: parseInt(form.calls_showed) || 0,
      }, { onConflict: 'user_id,month' });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['monthly-totals'] });
      qc.invalidateQueries({ queryKey: ['monthly-totals-history'] });
      setForm({ oneoff_revenue: '', expenses: '', new_clients: '', leads_generated: '', content_posts: '', business_confidence: '5', nps: '5', biggest_win: '', needs_this_month: '', offers_made: '', booked_calls: '', calls_showed: '' });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    },
  });

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  return (
    <PageLayout>
      <h1 className="text-2xl mb-1">Monthly Check-In</h1>
      <p className="text-sm text-muted-foreground mb-6">
        {new Date().toLocaleString('default', { month: 'long', year: 'numeric' })} — takes 3 minutes. Updates your dashboard and lets Dan prep for your next call.
      </p>

      <div className="flex items-center gap-3 mb-5 px-4 py-3 bg-primary/5 border border-primary/20 rounded-lg">
        <div>
          <p className="text-xs text-muted-foreground mb-0.5">Contracted MRR (auto)</p>
          <p className="text-2xl font-bold text-primary">${calculatedMRR.toLocaleString()}</p>
        </div>
        <p className="text-xs text-muted-foreground ml-auto max-w-[200px] text-right">
          Pulled from your logged retainer clients. Update in New Clients to change this.
        </p>
      </div>

      <div className="space-y-5">
        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="text-xs uppercase tracking-wider text-muted-foreground mb-4">Revenue & Expenses</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              { k: 'oneoff_revenue', l: 'One-Off Shoots ($)', p: '2000' },
              { k: 'expenses', l: 'Total Expenses ($)', p: '1500' },
            ].map(f => (
              <div key={f.k}>
                <label className="block text-sm font-semibold text-foreground mb-1.5">{f.l}</label>
                <input type="number" value={form[f.k as keyof typeof form]} onChange={e => set(f.k, e.target.value)} placeholder={f.p}
                  className="w-full px-4 py-2.5 bg-input border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 transition" />
              </div>
            ))}
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="text-xs uppercase tracking-wider text-muted-foreground mb-4">Sales & Calls</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {[
              { k: 'offers_made', l: 'Offers / Proposals Sent', p: '8' },
              { k: 'booked_calls', l: 'Calls Booked', p: '5' },
              { k: 'calls_showed', l: 'Calls Showed Up', p: '4' },
              { k: 'leads_generated', l: 'Leads Generated', p: '20' },
              { k: 'new_clients', l: 'New Clients Signed', p: '2' },
              { k: 'content_posts', l: 'Content Posts', p: '16' },
            ].map(f => (
              <div key={f.k}>
                <label className="block text-sm font-semibold text-foreground mb-1.5">{f.l}</label>
                <input type="number" value={form[f.k as keyof typeof form]} onChange={e => set(f.k, e.target.value)} placeholder={f.p}
                  className="w-full px-4 py-2.5 bg-input border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 transition" />
              </div>
            ))}
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-5 space-y-4">
          <h3 className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Wins & Focus</h3>
          <div>
            <label className="block text-sm font-semibold text-foreground mb-1.5">Biggest win this month</label>
            <textarea value={form.biggest_win} onChange={e => set('biggest_win', e.target.value)} rows={2}
              placeholder="e.g. Signed a £4k/mo retainer, hit 10k followers, closed my first discovery call..."
              className="w-full px-4 py-2.5 bg-input border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 transition resize-none" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-foreground mb-1.5">What do you need from Dan this month?</label>
            <textarea value={form.needs_this_month} onChange={e => set('needs_this_month', e.target.value)} rows={2}
              placeholder="e.g. Help structuring my offer, accountability on posting, reviewing my ad..."
              className="w-full px-4 py-2.5 bg-input border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 transition resize-none" />
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-5 space-y-6">
          <h3 className="text-xs uppercase tracking-wider text-muted-foreground">How are you feeling?</h3>
          <ScoreSlider label="Business confidence" sublabel="How confident are you about the direction of your business right now?" value={form.business_confidence} onChange={v => set('business_confidence', v)} />
          <ScoreSlider label="Coaching satisfaction (NPS)" sublabel="How likely are you to recommend ProfitX to another videographer?" value={form.nps} onChange={v => set('nps', v)} />
        </div>

        <div className="flex items-center justify-between">
          {saved
            ? <span className="text-sm text-success">✓ Submitted! Dan can see this now.</span>
            : <span className="text-xs text-muted-foreground">MRR snapshot: ${calculatedMRR.toLocaleString()} · One-offs separate</span>
          }
          <button onClick={() => submit.mutate()} disabled={submit.isPending}
            className="px-5 py-2 bg-primary text-primary-foreground font-semibold rounded-lg text-sm hover:bg-primary/90 transition-all disabled:opacity-50">
            {submit.isPending ? 'Saving...' : 'Submit Month →'}
          </button>
        </div>
      </div>

      {history && history.length > 0 && (
        <div className="mt-8">
          <h2 className="text-base font-semibold text-foreground mb-3">Submission History</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  {['Month','MRR','One-Offs','Revenue','Profit','Confidence','NPS'].map(h => (
                    <th key={h} className="pb-2 text-xs font-semibold text-muted-foreground pr-4">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {history.map((row: any) => {
                  const mrr = Number(row.mrr) || 0;
                  const oneoffs = Number(row.oneoff_revenue) || 0;
                  const expenses = Number(row.expenses) || 0;
                  const revenue = mrr + oneoffs;
                  const profit = revenue - expenses;
                  return (
                    <tr key={row.id} className="border-b border-border/50">
                      <td className="py-2.5 text-foreground pr-4">{new Date(row.month).toLocaleString('default', { month: 'short', year: 'numeric' })}</td>
                      <td className="py-2.5 font-semibold text-primary pr-4">${mrr.toLocaleString()}</td>
                      <td className="py-2.5 text-foreground pr-4">${oneoffs.toLocaleString()}</td>
                      <td className="py-2.5 text-foreground pr-4">${revenue.toLocaleString()}</td>
                      <td className={`py-2.5 font-semibold pr-4 ${profit >= 0 ? 'text-success' : 'text-destructive'}`}>${profit.toLocaleString()}</td>
                      <td className="py-2.5 text-foreground pr-4">{row.business_confidence ? `${row.business_confidence}/10` : '—'}</td>
                      <td className="py-2.5 text-foreground">{row.nps ? `${row.nps}/10` : '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </PageLayout>
  );
}

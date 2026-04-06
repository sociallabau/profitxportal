import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import PageLayout from '@/components/PageLayout';
import { supabase } from '@/lib/supabase';
import { useRequireAuth } from '@/hooks/useAuth';
import { usePageTracking } from '@/hooks/usePageTracking';

function ScoreSlider({ label, sublabel, value, onChange }: {
  label: string; sublabel?: string; value: string; onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="block text-sm font-semibold text-foreground mb-0.5">{label}</label>
      {sublabel && <p className="text-xs text-muted-foreground mb-2">{sublabel}</p>}
      <div className="flex items-center gap-3">
        <input type="range" min="1" max="10" value={value || 5} onChange={(e) => onChange(e.target.value)} className="flex-1 accent-primary" />
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
  usePageTracking('monthly-totals');
  const qc = useQueryClient();
  const currentMonth = new Date().toISOString().slice(0, 7);

  const [form, setForm] = useState({
    oneoff_revenue: '', mrr_manual: '', total_revenue: '', expenses: '',
    ad_spend: '', content_posts: '', leads_generated: '', meetings: '',
    new_clients: '', new_clients_total_value: '', new_clients_is_mrr: 'false',
    business_confidence: '5', nps: '5',
    biggest_win: '', needs_this_month: '',
  });
  const [saved, setSaved] = useState(false);
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const { data: history } = useQuery({
    queryKey: ['monthly-totals-history', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from('monthly_totals').select('*').eq('user_id', user!.id).order('month', { ascending: false });
      return (data ?? []) as any[];
    },
  });

  const submit = useMutation({
    mutationFn: async () => {
      const mrr = parseFloat(form.mrr_manual) || 0;
      const oneoffs = parseFloat(form.oneoff_revenue) || 0;
      const total = parseFloat(form.total_revenue) || (mrr + oneoffs);

      const { error } = await supabase.from('monthly_totals').upsert({
        user_id: user!.id,
        month: `${currentMonth}-01`,
        mrr_manual: mrr,
        mrr: mrr,
        oneoff_revenue: oneoffs,
        total_revenue: total,
        expenses: parseFloat(form.expenses) || 0,
        ad_spend: parseFloat(form.ad_spend) || 0,
        content_posts: parseInt(form.content_posts) || 0,
        leads_generated: parseInt(form.leads_generated) || 0,
        meetings: parseInt(form.meetings) || 0,
        new_clients: parseInt(form.new_clients) || 0,
        new_clients_total_value: parseFloat(form.new_clients_total_value) || 0,
        new_clients_is_mrr: form.new_clients_is_mrr === 'true',
        business_confidence: parseInt(form.business_confidence),
        nps: parseInt(form.nps),
        biggest_win: form.biggest_win || null,
        needs_this_month: form.needs_this_month || null,
      }, { onConflict: 'user_id,month' });
      if (error) throw error;

      if (form.biggest_win.trim()) {
        await supabase.from('weekly_wins').insert({
          user_id: user!.id,
          win_text: form.biggest_win,
          source: 'monthly',
          week_ending: new Date().toISOString().split('T')[0],
        });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['monthly-totals-history'] });
      qc.invalidateQueries({ queryKey: ['monthly-history'] });
      qc.invalidateQueries({ queryKey: ['wins-wall'] });
      setForm({
        oneoff_revenue: '', mrr_manual: '', total_revenue: '', expenses: '',
        ad_spend: '', content_posts: '', leads_generated: '', meetings: '',
        new_clients: '', new_clients_total_value: '', new_clients_is_mrr: 'false',
        business_confidence: '5', nps: '5',
        biggest_win: '', needs_this_month: '',
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 4000);
    },
  });

  const monthLabel = new Date().toLocaleString('default', { month: 'long', year: 'numeric' });

  return (
    <PageLayout>
      <h1 className="text-2xl font-bold mb-1">Monthly Check-In</h1>
      <p className="text-sm text-muted-foreground mb-6">
        {monthLabel} — takes 3 minutes. Updates your dashboard and lets Dan prep for your next call.
      </p>

      <div className="space-y-5">
        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="text-xs uppercase tracking-wider text-muted-foreground mb-4">Revenue</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-semibold text-foreground mb-1.5">One-Off Shoots ($)</label>
              <input type="number" value={form.oneoff_revenue} onChange={e => set('oneoff_revenue', e.target.value)}
                placeholder="2000"
                className="w-full px-4 py-2.5 bg-input border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 transition" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-foreground mb-1.5">MRR — Retainers ($)</label>
              <input type="number" value={form.mrr_manual} onChange={e => set('mrr_manual', e.target.value)}
                placeholder="3500"
                className="w-full px-4 py-2.5 bg-input border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 transition" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-foreground mb-1.5">Total Revenue ($)</label>
              <input type="number" value={form.total_revenue} onChange={e => set('total_revenue', e.target.value)}
                placeholder="5500"
                className="w-full px-4 py-2.5 bg-input border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 transition" />
              <p className="text-xs text-muted-foreground mt-1">Enter manually — cross-check one-offs + MRR</p>
            </div>
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="text-xs uppercase tracking-wider text-muted-foreground mb-4">Costs</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-foreground mb-1.5">Rough Expenses ($)</label>
              <input type="number" value={form.expenses} onChange={e => set('expenses', e.target.value)}
                placeholder="2000"
                className="w-full px-4 py-2.5 bg-input border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 transition" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-foreground mb-1.5">Ad Spend ($)</label>
              <input type="number" value={form.ad_spend} onChange={e => set('ad_spend', e.target.value)}
                placeholder="500"
                className="w-full px-4 py-2.5 bg-input border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 transition" />
            </div>
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="text-xs uppercase tracking-wider text-muted-foreground mb-4">Activity & Funnel</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {[
              { k: 'content_posts', l: 'Content Pieces Posted', p: '20' },
              { k: 'leads_generated', l: 'Convos / Leads', p: '15' },
              { k: 'meetings', l: 'Meetings', p: '5' },
              { k: 'new_clients', l: 'New Clients Signed', p: '2' },
            ].map(f => (
              <div key={f.k}>
                <label className="block text-sm font-semibold text-foreground mb-1.5">{f.l}</label>
                <input type="number" value={form[f.k as keyof typeof form]} onChange={e => set(f.k, e.target.value)}
                  placeholder={f.p}
                  className="w-full px-4 py-2.5 bg-input border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 transition" />
              </div>
            ))}
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-5 space-y-4">
          <h3 className="text-xs uppercase tracking-wider text-muted-foreground">Wins & Focus</h3>
          <div>
            <label className="block text-sm font-semibold text-foreground mb-1.5">Biggest win this month</label>
            <textarea value={form.biggest_win} onChange={e => set('biggest_win', e.target.value)} rows={2}
              placeholder="e.g. Signed a £4k/mo retainer, hit 10k followers, closed my first discovery call..."
              className="w-full px-4 py-2.5 bg-input border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 transition resize-none" />
            <p className="text-xs text-muted-foreground mt-1">This will be posted to the Wins Wall automatically 🏆</p>
          </div>
          <div>
            <label className="block text-sm font-semibold text-foreground mb-1.5">What do you need from Dan this month?</label>
            <textarea value={form.needs_this_month} onChange={e => set('needs_this_month', e.target.value)} rows={2}
              placeholder="e.g. Help structuring my offer, accountability on posting, reviewing my ad creative..."
              className="w-full px-4 py-2.5 bg-input border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 transition resize-none" />
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-5 space-y-6">
          <h3 className="text-xs uppercase tracking-wider text-muted-foreground">How are you feeling?</h3>
          <ScoreSlider label="Business confidence" sublabel="How confident are you about the direction of your business right now?" value={form.business_confidence} onChange={v => set('business_confidence', v)} />
          <ScoreSlider label="Coaching satisfaction" sublabel="How much value are you getting from ProfitX?" value={form.nps} onChange={v => set('nps', v)} />
        </div>

        <div className="flex items-center justify-between">
          {saved
            ? <span className="text-sm text-green-400 font-semibold">✓ Submitted! Dan can see this now. Your win has been posted to the Wins Wall.</span>
            : <span className="text-xs text-muted-foreground">All fields are optional — fill in what you know.</span>}
          <button onClick={() => submit.mutate()} disabled={submit.isPending}
            className="px-6 py-2.5 bg-primary text-primary-foreground font-semibold rounded-lg text-sm hover:bg-primary/90 transition disabled:opacity-50">
            {submit.isPending ? 'Submitting...' : 'Submit Month →'}
          </button>
        </div>
      </div>

      {history && history.length > 0 && (
        <div className="mt-10">
          <h2 className="text-base font-semibold text-foreground mb-3">Submission History</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  {['Month','MRR','One-Offs','Revenue','Expenses','Profit','Content','Leads','Meetings','New Clients','Confidence','Satisfaction'].map(h => (
                    <th key={h} className="pb-2 text-xs font-semibold text-muted-foreground pr-4 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {history.map((row: any) => {
                  const mrr = Number(row.mrr_manual || row.mrr) || 0;
                  const oneoffs = Number(row.oneoff_revenue) || 0;
                  const revenue = Number(row.total_revenue) || (mrr + oneoffs);
                  const expenses = Number(row.expenses) || 0;
                  const profit = revenue - expenses;
                  return (
                    <tr key={row.id} className="border-b border-border/50">
                      <td className="py-2.5 text-foreground pr-4 whitespace-nowrap">{new Date(row.month).toLocaleString('default', { month: 'short', year: 'numeric' })}</td>
                      <td className="py-2.5 font-semibold text-primary pr-4">${mrr.toLocaleString()}</td>
                      <td className="py-2.5 text-foreground pr-4">${oneoffs.toLocaleString()}</td>
                      <td className="py-2.5 text-foreground pr-4">${revenue.toLocaleString()}</td>
                      <td className="py-2.5 text-orange-400 pr-4">${expenses.toLocaleString()}</td>
                      <td className={`py-2.5 font-semibold pr-4 ${profit >= 0 ? 'text-green-400' : 'text-destructive'}`}>${profit.toLocaleString()}</td>
                      <td className="py-2.5 text-foreground pr-4">{row.content_posts ?? '—'}</td>
                      <td className="py-2.5 text-foreground pr-4">{row.leads_generated ?? '—'}</td>
                      <td className="py-2.5 text-foreground pr-4">{row.meetings ?? '—'}</td>
                      <td className="py-2.5 text-foreground pr-4">{row.new_clients ?? '—'}</td>
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

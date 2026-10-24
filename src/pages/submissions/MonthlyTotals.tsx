import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import PageLayout from '@/components/PageLayout';
import { supabase } from '@/lib/supabase';
import { useRequireAuth } from '@/hooks/useAuth';
import { usePageTracking } from '@/hooks/usePageTracking';
import { useProfile } from '@/hooks/useProfile';
import { Link } from 'react-router-dom';
import { useGateBuild } from '@/hooks/useGrowthHub';
import { ROMAN, buildProgress, gateNumber } from '@/lib/growthHub';
import { CHECK_IN_SECTIONS, checkInValues, visibleSections } from '@/lib/checkIn';

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

const blankForm: Record<string, string> = {
  oneoff_revenue: '', mrr_manual: '', total_revenue: '', expenses: '', expense_contractors: '', expense_software: '', expense_owner_pay: '', expense_other: '',
  ...Object.fromEntries(CHECK_IN_SECTIONS.flatMap(s => s.fields.map(f => [f.key, '']))),
  new_clients_total_value: '', new_clients_is_mrr: 'false',
  business_confidence: '5', nps: '5',
  biggest_win: '', needs_this_month: '',
};

export default function MonthlyTotals() {
  const { user } = useRequireAuth();
  usePageTracking('monthly-totals');
  const qc = useQueryClient();
  const [currentMonth, setCurrentMonth] = useState(new Date().toISOString().slice(0, 7));

  const monthOptions = Array.from({ length: 12 }, (_, i) => {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - i);
    return {
      value: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      label: d.toLocaleString('default', { month: 'long', year: 'numeric' }),
    };
  });

  const [form, setForm] = useState<Record<string, string>>(blankForm);
  const [saved, setSaved] = useState(false);
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));
  const { data: profile } = useProfile();
  const gate = gateNumber(profile?.gate);
  const { tasks } = useGateBuild(user?.id, gate, currentMonth);
  const build = buildProgress(tasks);

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
        expense_contractors: form.expense_contractors ? parseFloat(form.expense_contractors) : null,
        expense_software: form.expense_software ? parseFloat(form.expense_software) : null,
        expense_owner_pay: form.expense_owner_pay ? parseFloat(form.expense_owner_pay) : null,
        expense_other: form.expense_other ? parseFloat(form.expense_other) : null,
        ...checkInValues(form, gate),
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
      // Fire and forget: the client gets their confirmation straight away,
      // and the round-up appears on Financials once the model responds.
      supabase.functions.invoke('monthly-review', { body: {} }).catch(() => {});

      qc.invalidateQueries({ queryKey: ['monthly-totals-history'] });
      qc.invalidateQueries({ queryKey: ['monthly-history'] });
      qc.invalidateQueries({ queryKey: ['wins-wall'] });
      setForm(blankForm);
      setSaved(true);
      setTimeout(() => setSaved(false), 4000);
    },
  });

  const monthLabel = monthOptions.find(m => m.value === currentMonth)?.label ?? currentMonth;

  return (
    <PageLayout>
      <h1 className="text-2xl font-bold mb-1">Monthly Check-In</h1>
      <p className="text-sm text-muted-foreground mb-4">
        {monthLabel} — takes 3 minutes. Updates your dashboard and lets Dan prep for your next call.
      </p>

      <div className="mb-6">
        <label className="block text-sm font-semibold text-foreground mb-1.5">Which month are you submitting for?</label>
        <select
          value={currentMonth}
          onChange={e => setCurrentMonth(e.target.value)}
          className="px-4 py-2.5 bg-input border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 transition"
        >
          {monthOptions.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
        </select>
      </div>

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
          </div>

          <div className="mt-5 pt-5 border-t border-border">
            <p className="text-xs text-muted-foreground mb-3">
              Optional, but this is how Dan spots what's actually eating your margin. A 10% margin caused
              by editor costs needs a completely different fix to one caused by what you pay yourself.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-foreground mb-1.5">Editors &amp; contractors ($)</label>
                <input type="number" value={form.expense_contractors} onChange={e => set('expense_contractors', e.target.value)}
                  placeholder="1200"
                  className="w-full px-4 py-2.5 bg-input border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 transition" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-foreground mb-1.5">Software &amp; subscriptions ($)</label>
                <input type="number" value={form.expense_software} onChange={e => set('expense_software', e.target.value)}
                  placeholder="300"
                  className="w-full px-4 py-2.5 bg-input border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 transition" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-foreground mb-1.5">What you paid yourself ($)</label>
                <input type="number" value={form.expense_owner_pay} onChange={e => set('expense_owner_pay', e.target.value)}
                  placeholder="4000"
                  className="w-full px-4 py-2.5 bg-input border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 transition" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-foreground mb-1.5">Everything else ($)</label>
                <input type="number" value={form.expense_other} onChange={e => set('expense_other', e.target.value)}
                  placeholder="400"
                  className="w-full px-4 py-2.5 bg-input border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 transition" />
              </div>
            </div>
          </div>
        </div>

        {visibleSections(gate).map(section => (
          <div key={section.title} className="bg-card border border-border rounded-xl p-5">
            <h3 className="text-xs uppercase tracking-wider text-muted-foreground mb-4">{section.title}</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {section.fields.map(f => (
                <div key={f.key}>
                  <label className="block text-sm font-semibold text-foreground mb-1.5">{f.label}</label>
                  <input type="number" min="0" step={f.money ? 'any' : '1'} value={form[f.key]} onChange={e => set(f.key, e.target.value)}
                    placeholder={f.placeholder}
                    className="w-full px-4 py-2.5 bg-input border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 transition" />
                  {f.hint && <p className="text-xs text-muted-foreground mt-1">{f.hint}</p>}
                </div>
              ))}
            </div>
          </div>
        ))}
        {gate && <p className="text-xs text-muted-foreground -mt-2">Showing the numbers for Gate {ROMAN[gate]} and the gate above it.</p>}

        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="text-xs uppercase tracking-wider text-muted-foreground mb-4">New Client Value</h3>
          <p className="text-xs text-muted-foreground mb-4">If you signed new clients this month, what's the total value? This powers your growth funnel analysis.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-foreground mb-1.5">New clients total value ($)</label>
              <input type="number" value={form.new_clients_total_value} onChange={e => set('new_clients_total_value', e.target.value)} placeholder="6000" className="w-full px-4 py-2.5 bg-input border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 transition" />
              <p className="text-xs text-muted-foreground mt-1">e.g. 3 clients at $2k each = $6,000</p>
            </div>
            <div className="flex flex-col justify-center">
              <label className="flex items-start gap-3 cursor-pointer">
                <input type="checkbox" checked={form.new_clients_is_mrr === 'true'} onChange={e => set('new_clients_is_mrr', String(e.target.checked))} className="w-4 h-4 accent-primary mt-0.5" />
                <div>
                  <span className="text-sm font-semibold text-foreground">These are retainer clients (MRR)</span>
                  <p className="text-xs text-muted-foreground mt-0.5">Check this if they pay monthly — their actual LTV will be much higher</p>
                </div>
              </label>
            </div>
          </div>
        </div>

        {gate && build.total > 0 && (
          <Link to="/growth-hub" className="block bg-card border border-border rounded-xl p-5 hover:border-primary/40 transition-colors">
            <h3 className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Your Gate {ROMAN[gate]} build list</h3>
            <p className="text-sm"><span className="font-semibold">{build.done}/{build.total} ticked.</span> Tick off what you've built on your Growth Hub →</p>
          </Link>
        )}

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
            <label className="block text-sm font-semibold text-foreground mb-1.5">What's your next important task?</label>
            <textarea value={form.needs_this_month} onChange={e => set('needs_this_month', e.target.value)} rows={2}
              placeholder="e.g. Launch new offer page, book 5 discovery calls, ship 10 pieces of content..."
              className="w-full px-4 py-2.5 bg-input border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 transition resize-none" />
          </div>
        </div>

        <div className="flex items-center justify-between">
          {saved
            ? <span className="text-sm text-success font-semibold">✓ Submitted! Dan can see this now. Your win has been posted to the Wins Wall.</span>
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
                  {['Month','MRR','One-Offs','Revenue','Expenses','Profit','Content','Convos + leads','Meetings','New Clients','Confidence','Satisfaction'].map(h => (
                    <th key={h} className="pb-2 text-xs font-semibold text-muted-foreground pr-4 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {history.map(row => {
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
                      <td className="py-2.5 text-orange-600 pr-4">${expenses.toLocaleString()}</td>
                      <td className={`py-2.5 font-semibold pr-4 ${profit >= 0 ? 'text-success' : 'text-destructive'}`}>${profit.toLocaleString()}</td>
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

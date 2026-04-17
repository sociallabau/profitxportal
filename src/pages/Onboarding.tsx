import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { useGoal } from '@/hooks/useGoal';
import { Loader2, Check, ArrowRight, Sparkles, Target, FileText, Compass } from 'lucide-react';

type Step = 0 | 1 | 2 | 3;

export default function Onboarding() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user, loading: authLoading } = useAuth();
  const { data: profile, isLoading: profileLoading } = useProfile();
  const { setGoal } = useGoal();

  const [step, setStep] = useState<Step>(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Step 1 — Profile
  const [fullName, setFullName] = useState('');
  const [businessOverview, setBusinessOverview] = useState('');

  // Step 2 — Goal
  const [startingMrr, setStartingMrr] = useState('');
  const [targetMrr, setTargetMrr] = useState('');
  const defaultTargetDate = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 90);
    return d.toISOString().slice(0, 10);
  }, []);
  const [targetDate, setTargetDate] = useState(defaultTargetDate);

  // Step 3 — Baseline last-month report
  const lastMonthDate = useMemo(() => {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - 1);
    return d;
  }, []);
  const lastMonthLabel = lastMonthDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const lastMonthIso = lastMonthDate.toISOString().slice(0, 10);
  const [mrr, setMrr] = useState('');
  const [revenue, setRevenue] = useState('');
  const [expenses, setExpenses] = useState('');

  // Hydrate from profile when ready
  useMemo(() => {
    if (profile && fullName === '' && (profile.full_name || '') !== '') {
      setFullName(profile.full_name ?? '');
    }
    if (profile && businessOverview === '' && (profile.business_overview || '') !== '') {
      setBusinessOverview(profile.business_overview ?? '');
    }
  }, [profile]);

  if (authLoading || profileLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    navigate('/auth', { replace: true });
    return null;
  }

  // Already onboarded? Skip.
  if (profile?.onboarded) {
    navigate('/dashboard', { replace: true });
    return null;
  }

  const steps = [
    { icon: Sparkles, label: 'Welcome' },
    { icon: FileText, label: 'About you' },
    { icon: Target, label: '90-day goal' },
    { icon: Compass, label: 'Baseline' },
  ];

  const next = () => setStep((s) => (Math.min(3, s + 1) as Step));
  const back = () => setStep((s) => (Math.max(0, s - 1) as Step));

  const finishStep1 = async () => {
    if (!fullName.trim()) { setError('Please enter your full name.'); return; }
    setError(''); setSaving(true);
    const { error: e } = await supabase
      .from('profiles')
      .update({ full_name: fullName.trim(), business_overview: businessOverview.trim() || null })
      .eq('id', user.id);
    setSaving(false);
    if (e) { setError(e.message); return; }
    qc.invalidateQueries({ queryKey: ['profile'] });
    next();
  };

  const finishStep2 = async () => {
    const tm = Number(targetMrr);
    const sm = Number(startingMrr || 0);
    if (!tm || tm <= 0) { setError('Enter a target MRR greater than 0.'); return; }
    if (!targetDate) { setError('Pick a target date.'); return; }
    setError(''); setSaving(true);
    try {
      await setGoal.mutateAsync({ target_mrr: tm, starting_mrr: sm, target_date: targetDate });
      next();
    } catch (e: any) {
      setError(e?.message ?? 'Could not save goal.');
    } finally {
      setSaving(false);
    }
  };

  const finishStep3 = async () => {
    const m = Number(mrr || 0);
    const r = Number(revenue || 0);
    const ex = Number(expenses || 0);
    setError(''); setSaving(true);
    // Upsert baseline monthly_totals row
    const { error: insErr } = await supabase
      .from('monthly_totals')
      .upsert(
        {
          user_id: user.id,
          month: lastMonthIso,
          mrr: m,
          mrr_manual: m,
          total_revenue: r,
          oneoff_revenue: Math.max(0, r - m),
          expenses: ex,
        } as any,
        { onConflict: 'user_id,month' as any }
      );
    if (insErr) {
      // Fallback: plain insert if no unique constraint exists
      await supabase.from('monthly_totals').insert({
        user_id: user.id,
        month: lastMonthIso,
        mrr: m,
        mrr_manual: m,
        total_revenue: r,
        oneoff_revenue: Math.max(0, r - m),
        expenses: ex,
      } as any);
    }
    // Mark onboarded
    const { error: profErr } = await supabase
      .from('profiles')
      .update({ onboarded: true })
      .eq('id', user.id);
    setSaving(false);
    if (profErr) { setError(profErr.message); return; }
    qc.invalidateQueries({ queryKey: ['profile'] });
    qc.invalidateQueries({ queryKey: ['monthly-history'] });
    qc.invalidateQueries({ queryKey: ['monthly-totals-history'] });
    navigate('/dashboard', { replace: true });
  };

  return (
    <div className="min-h-screen bg-background px-4 py-10 flex items-start justify-center">
      <div className="w-full max-w-2xl">
        {/* Stepper */}
        <div className="flex items-center justify-between mb-8">
          {steps.map((s, i) => {
            const active = i === step;
            const done = i < step;
            const Icon = s.icon;
            return (
              <div key={s.label} className="flex-1 flex items-center">
                <div className="flex flex-col items-center flex-1">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition ${
                    done ? 'bg-primary border-primary text-primary-foreground'
                    : active ? 'border-primary text-primary bg-primary/10'
                    : 'border-border text-muted-foreground'
                  }`}>
                    {done ? <Check className="w-5 h-5" /> : <Icon className="w-5 h-5" />}
                  </div>
                  <span className={`text-xs mt-2 font-medium ${active || done ? 'text-foreground' : 'text-muted-foreground'}`}>
                    {s.label}
                  </span>
                </div>
                {i < steps.length - 1 && (
                  <div className={`h-0.5 flex-1 -mt-6 ${i < step ? 'bg-primary' : 'bg-border'}`} />
                )}
              </div>
            );
          })}
        </div>

        <div className="bg-card border border-border rounded-2xl p-8 shadow-xl">
          {step === 0 && (
            <div>
              <h2 className="text-2xl font-bold text-foreground mb-2">Welcome to ProfitX 👋</h2>
              <p className="text-muted-foreground mb-6">
                Let's get you set up in 3 quick steps. We'll grab your business info, lock in a 90-day goal,
                then capture last month's numbers as your starting baseline.
              </p>
              <ul className="space-y-3 mb-8">
                {[
                  ['About you', 'Name & a short business overview so your coach has context.'],
                  ['90-day MRR goal', "Where you're starting and where you want to be in 90 days."],
                  [`Baseline report (${lastMonthLabel})`, 'Quick MRR / revenue / expenses so we can track from day one.'],
                ].map(([t, d]) => (
                  <li key={t} className="flex gap-3">
                    <div className="w-2 h-2 rounded-full bg-primary mt-2 shrink-0" />
                    <div>
                      <div className="font-semibold text-foreground text-sm">{t}</div>
                      <div className="text-sm text-muted-foreground">{d}</div>
                    </div>
                  </li>
                ))}
              </ul>
              <button
                onClick={next}
                className="w-full py-3 bg-primary text-primary-foreground font-semibold rounded-lg hover:bg-primary/90 transition flex items-center justify-center gap-2"
              >
                Let's go <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {step === 1 && (
            <div>
              <h2 className="text-xl font-bold text-foreground mb-1">About you</h2>
              <p className="text-sm text-muted-foreground mb-6">Your coach will see this in the client portal.</p>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-foreground mb-1.5">Full Name *</label>
                  <input
                    value={fullName}
                    onChange={e => setFullName(e.target.value)}
                    maxLength={100}
                    placeholder="Jane Smith"
                    className="w-full px-4 py-2.5 bg-input border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-foreground mb-1.5">About my business</label>
                  <textarea
                    value={businessOverview}
                    onChange={e => setBusinessOverview(e.target.value)}
                    maxLength={2000}
                    rows={5}
                    placeholder="What you do, who you serve, current offer / pricing, biggest challenge right now..."
                    className="w-full px-4 py-2.5 bg-input border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none"
                  />
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div>
              <h2 className="text-xl font-bold text-foreground mb-1">Your 90-day MRR goal</h2>
              <p className="text-sm text-muted-foreground mb-6">Pick a target you're committed to hitting.</p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-foreground mb-1.5">Starting MRR</label>
                  <input
                    type="number" min="0" step="100"
                    value={startingMrr}
                    onChange={e => setStartingMrr(e.target.value)}
                    placeholder="0"
                    className="w-full px-4 py-2.5 bg-input border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-foreground mb-1.5">Target MRR *</label>
                  <input
                    type="number" min="0" step="100"
                    value={targetMrr}
                    onChange={e => setTargetMrr(e.target.value)}
                    placeholder="10000"
                    className="w-full px-4 py-2.5 bg-input border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-semibold text-foreground mb-1.5">Target Date</label>
                  <input
                    type="date"
                    value={targetDate}
                    onChange={e => setTargetDate(e.target.value)}
                    className="w-full px-4 py-2.5 bg-input border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div>
              <h2 className="text-xl font-bold text-foreground mb-1">Baseline: {lastMonthLabel}</h2>
              <p className="text-sm text-muted-foreground mb-6">
                Quick numbers from last month so we have a starting point. You can do full monthly reports later in Submissions.
              </p>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-foreground mb-1.5">MRR (£/$)</label>
                  <input
                    type="number" min="0" step="100"
                    value={mrr}
                    onChange={e => setMrr(e.target.value)}
                    placeholder="0"
                    className="w-full px-4 py-2.5 bg-input border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-foreground mb-1.5">Total Revenue</label>
                  <input
                    type="number" min="0" step="100"
                    value={revenue}
                    onChange={e => setRevenue(e.target.value)}
                    placeholder="0"
                    className="w-full px-4 py-2.5 bg-input border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-foreground mb-1.5">Expenses</label>
                  <input
                    type="number" min="0" step="100"
                    value={expenses}
                    onChange={e => setExpenses(e.target.value)}
                    placeholder="0"
                    className="w-full px-4 py-2.5 bg-input border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="mt-4 px-4 py-3 bg-destructive/10 border border-destructive/30 rounded-lg">
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}

          {step > 0 && (
            <div className="flex gap-3 mt-8">
              <button
                onClick={back}
                disabled={saving}
                className="px-5 py-2.5 border border-border text-foreground font-semibold rounded-lg hover:bg-muted transition disabled:opacity-50"
              >
                Back
              </button>
              <button
                onClick={step === 1 ? finishStep1 : step === 2 ? finishStep2 : finishStep3}
                disabled={saving}
                className="flex-1 py-2.5 bg-primary text-primary-foreground font-semibold rounded-lg hover:bg-primary/90 transition flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                {step === 3 ? 'Finish & Enter ProfitX' : 'Continue'}
                {!saving && <ArrowRight className="w-4 h-4" />}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

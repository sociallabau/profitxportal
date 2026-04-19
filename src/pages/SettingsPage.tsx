import PageLayout from "@/components/PageLayout";
import { useState, useEffect } from "react";
import { useRequireAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { useGoal } from '@/hooks/useGoal';

const tabs = ["Profile", "Integrations", "Notifications"];

export default function SettingsPage() {
  const { user, loading } = useRequireAuth();
  const { data: profile } = useProfile();
  const { goal: { data: goalData }, setGoal } = useGoal();
  const [fullName, setFullName] = useState('');
  const [businessOverview, setBusinessOverview] = useState('');
  const [saving, setSaving] = useState(false);
  const [savingBiz, setSavingBiz] = useState(false);
  const [targetMrr, setTargetMrr] = useState('');
  const [startingMrr, setStartingMrr] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [tier1, setTier1] = useState('');
  const [tier2, setTier2] = useState('');
  const [tier3, setTier3] = useState('');

  useEffect(() => {
    if (profile?.full_name) setFullName(profile.full_name);
    if ((profile as any)?.business_overview) setBusinessOverview((profile as any).business_overview);
  }, [profile?.full_name, (profile as any)?.business_overview]);

  useEffect(() => {
    if (goalData) {
      const g = goalData as any;
      setTargetMrr(String(g.target_mrr ?? ''));
      setStartingMrr(String(g.starting_mrr ?? ''));
      setTargetDate(g.target_date ?? '');
      setTier1(g.retainer_tier_1 != null ? String(g.retainer_tier_1) : '');
      setTier2(g.retainer_tier_2 != null ? String(g.retainer_tier_2) : '');
      setTier3(g.retainer_tier_3 != null ? String(g.retainer_tier_3) : '');
    }
  }, [goalData]);

  const [activeTab, setActiveTab] = useState("Profile");
  if (loading) return null;

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase
      .from('profiles')
      .upsert({ id: user.id, full_name: fullName }, { onConflict: 'id' });
    setSaving(false);
    if (error) {
      toast.error('Failed to save profile');
    } else {
      toast.success('Profile saved');
    }
  };

  return (
    <PageLayout>
      <h1 className="text-2xl font-bold text-foreground mb-6">Settings</h1>

      <div className="flex gap-2 mb-6">
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === tab ? "bg-primary text-primary-foreground" : "bg-card border border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === "Profile" && (
        <>
          {/* About My Business */}
          <div className="bg-card border border-border rounded-xl p-5 mb-4">
            <h2 className="text-base font-semibold mb-1">About My Business</h2>
            <p className="text-xs text-muted-foreground mb-3">
              This helps personalise your Content Studio suggestions. Tell us what you do, who you help, and what makes you different from others in your space.
            </p>
            <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Business Overview</label>
            <textarea
              value={businessOverview}
              onChange={e => setBusinessOverview(e.target.value)}
              rows={6}
              placeholder="e.g. I run a construction company in Sydney specialising in residential renovations. We help homeowners transform their properties with high-quality builds delivered on time. Our edge is transparent pricing and weekly progress updates that keep clients confident throughout the build."
              className="w-full px-3 py-2 bg-input border border-border rounded-lg text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none"
            />
            <button
              onClick={async () => {
                if (!user) return;
                setSavingBiz(true);
                const { error } = await supabase
                  .from('profiles')
                  .update({ business_overview: businessOverview } as any)
                  .eq('id', user.id);
                setSavingBiz(false);
                if (error) toast.error('Failed to save');
                else toast.success('Business overview saved!');
              }}
              disabled={savingBiz}
              className="mt-3 h-10 px-5 bg-primary text-primary-foreground font-semibold rounded-lg hover:bg-primary/90 transition-colors text-sm disabled:opacity-50"
            >
              {savingBiz ? 'Saving...' : 'Save'}
            </button>
          </div>

          <div className="bg-card border border-border rounded-xl p-5 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-muted-foreground mb-1.5">Full Name</label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Your name"
                  className="w-full h-10 px-4 rounded-lg bg-secondary border border-border text-black placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1.5">Email</label>
                <input
                  type="email"
                  value={profile?.email ?? user?.email ?? ''}
                  disabled
                  className="w-full h-10 px-4 rounded-lg bg-secondary border border-border text-black placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50"
                />
              </div>
            </div>
            <div>
              <span className="block text-xs text-muted-foreground mb-1.5">Revenue Tier</span>
              <span className="inline-flex items-center px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-sm font-medium capitalize">
                {profile?.tier ?? 'onramp'}
              </span>
            </div>
            <button
              onClick={handleSave}
              disabled={saving}
              className="h-10 px-5 bg-primary text-primary-foreground font-semibold rounded-lg hover:bg-primary/90 transition-colors text-sm disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>

          {/* 90-Day MRR Goal */}
          <div className="bg-card border border-border rounded-xl p-5 mt-4">
            <h2 className="text-base font-semibold mb-4">90-Day MRR Goal</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">Starting MRR ($)</label>
                <input type="number" value={startingMrr} onChange={e => setStartingMrr(e.target.value)}
                  placeholder="0"
                  className="w-full px-3 py-2 bg-input border border-border rounded-lg text-foreground text-sm focus:ring-2 focus:ring-primary/40 focus:outline-none" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">Target MRR ($)</label>
                <input type="number" value={targetMrr} onChange={e => setTargetMrr(e.target.value)}
                  placeholder="20000"
                  className="w-full px-3 py-2 bg-input border border-border rounded-lg text-foreground text-sm focus:ring-2 focus:ring-primary/40 focus:outline-none" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">Target Date</label>
                <input type="date" value={targetDate} onChange={e => setTargetDate(e.target.value)}
                  className="w-full px-3 py-2 bg-input border border-border rounded-lg text-foreground text-sm focus:ring-2 focus:ring-primary/40 focus:outline-none" />
              </div>
            </div>
            <div className="mb-3">
              <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Your Retainer Prices ($ / month)</label>
              <p className="text-xs text-muted-foreground mb-2">Add 2–3 retainer tiers you actually offer. We use these to show how many clients you need to close to hit your goal.</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <input type="number" value={tier1} onChange={e => setTier1(e.target.value)}
                  placeholder="Tier 1 e.g. 1500"
                  className="w-full px-3 py-2 bg-input border border-border rounded-lg text-foreground text-sm focus:ring-2 focus:ring-primary/40 focus:outline-none" />
                <input type="number" value={tier2} onChange={e => setTier2(e.target.value)}
                  placeholder="Tier 2 e.g. 3000"
                  className="w-full px-3 py-2 bg-input border border-border rounded-lg text-foreground text-sm focus:ring-2 focus:ring-primary/40 focus:outline-none" />
                <input type="number" value={tier3} onChange={e => setTier3(e.target.value)}
                  placeholder="Tier 3 (optional)"
                  className="w-full px-3 py-2 bg-input border border-border rounded-lg text-foreground text-sm focus:ring-2 focus:ring-primary/40 focus:outline-none" />
              </div>
            </div>
            <div className="flex justify-end">
              <button
                onClick={() => setGoal.mutate({
                  target_mrr: parseFloat(targetMrr),
                  starting_mrr: parseFloat(startingMrr) || 0,
                  target_date: targetDate,
                  retainer_tier_1: tier1 ? parseFloat(tier1) : null,
                  retainer_tier_2: tier2 ? parseFloat(tier2) : null,
                  retainer_tier_3: tier3 ? parseFloat(tier3) : null,
                })}
                disabled={!targetMrr || setGoal.isPending}
                className="px-5 py-2 bg-primary text-primary-foreground font-semibold rounded-lg text-sm hover:bg-primary/90 transition-all disabled:opacity-50"
              >
                {setGoal.isPending ? 'Saving...' : 'Save Goal →'}
              </button>
            </div>
          </div>
        </>
      )}

      {activeTab === "Integrations" && (
        <div className="bg-card border border-border rounded-xl p-5">
          <p className="text-sm text-muted-foreground">Integrations coming soon — Instagram Analytics, YouTube Analytics, and more.</p>
        </div>
      )}

      {activeTab === "Notifications" && (
        <div className="bg-card border border-border rounded-xl p-5 space-y-4">
          {["Weekly win submission reminder", "Monthly data submission reminder"].map((label) => (
            <div key={label} className="flex items-center justify-between py-2">
              <span className="text-sm text-foreground">{label}</span>
              <input type="checkbox" defaultChecked className="h-4 w-4 accent-primary" />
            </div>
          ))}
        </div>
      )}
    </PageLayout>
  );
}

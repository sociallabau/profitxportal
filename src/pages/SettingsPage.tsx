import PageLayout from "@/components/PageLayout";
import { useState, useEffect } from "react";
import { useRequireAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

const tabs = ["Profile", "Integrations", "Notifications"];

export default function SettingsPage() {
  const { user, loading } = useRequireAuth();
  const { data: profile } = useProfile();
  const [fullName, setFullName] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (profile?.full_name) setFullName(profile.full_name);
  }, [profile?.full_name]);

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
        <div className="bg-card border border-border rounded-xl p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-muted-foreground mb-1.5">Full Name</label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Your name"
                className="w-full h-10 px-4 rounded-lg bg-secondary border border-border text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1.5">Email</label>
              <input
                type="email"
                value={profile?.email ?? user?.email ?? ''}
                disabled
                className="w-full h-10 px-4 rounded-lg bg-secondary border border-border text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50"
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

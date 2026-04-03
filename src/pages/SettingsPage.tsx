import PageLayout from "@/components/PageLayout";
import { useState } from "react";
import { useRequireAuth } from '@/hooks/useAuth';

const tabs = ["Profile", "Integrations", "Notifications"];

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState("Profile");

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
            {[
              { label: "Full Name", placeholder: "Test Client", type: "text" },
              { label: "Email", placeholder: "testclient@videoOS.com", type: "email", disabled: true },
              { label: "Instagram Handle", placeholder: "@yourbiz", type: "text" },
              { label: "YouTube Channel URL", placeholder: "https://youtube.com/...", type: "url" },
              { label: "LinkedIn URL", placeholder: "https://linkedin.com/in/...", type: "url" },
              { label: "Skool Community URL", placeholder: "https://skool.com/...", type: "url" },
            ].map((f) => (
              <div key={f.label}>
                <label className="block text-xs text-muted-foreground mb-1.5">{f.label}</label>
                <input
                  type={f.type}
                  placeholder={f.placeholder}
                  disabled={f.disabled}
                  className="w-full h-10 px-4 rounded-lg bg-secondary border border-border text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50"
                />
              </div>
            ))}
          </div>
          <div>
            <span className="block text-xs text-muted-foreground mb-1.5">Revenue Tier</span>
            <span className="inline-flex items-center px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-sm font-medium">Growth</span>
          </div>
          <button className="h-10 px-5 bg-primary text-primary-foreground font-semibold rounded-lg hover:bg-primary/90 transition-colors text-sm">
            Save Changes
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

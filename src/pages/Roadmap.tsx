import PageLayout from "@/components/PageLayout";
import { Map } from "lucide-react";

const pillars = [
  { name: "BUILD", color: "text-pillar-build", modules: ["Define Your Retainer Offer", "Price Your Package", "Build Your Delivery Roadmap", "Get Your First 3 Results", "Create Case Study Assets", "Referral & Renewal System"] },
  { name: "TRAFFIC", color: "text-pillar-traffic", modules: ["Define Your Ideal Client", "Your Content Strategy", "Short Form Content System", "Long Form / YouTube Authority", "Warm Outreach System", "Lead Magnet & Email List"] },
  { name: "SALES", color: "text-pillar-sales", modules: ["Your Offer Document", "The Discovery Call Framework", "Chat-to-Close Process", "Objection Handling Scripts", "Follow-Up Sequence", "Sales Metrics & Tracking"] },
  { name: "SCALE", color: "text-pillar-scale", modules: ["Document Your SOPs", "Hire Your First Editor", "Client Onboarding Automation", "Project Management System", "Finance & Profit System", "Team Expansion & Delegation"] },
];

const scores = ["green", "green", "amber", "red", "red", "red", "green", "amber", "amber", "green", "red", "amber", "green", "green", "amber", "amber", "red", "green", "green", "amber", "amber", "red", "red", "red"];

const scoreColor: Record<string, string> = {
  green: "bg-success",
  amber: "bg-warning",
  red: "bg-destructive",
};

export default function Roadmap() {
  let idx = 0;
  return (
    <PageLayout>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-foreground">The Growth Engine Roadmap</h1>
          <p className="text-sm text-muted-foreground mt-1">Last audit: 5 days ago</p>
        </div>
        <button className="inline-flex items-center gap-2 h-10 px-5 bg-primary text-primary-foreground font-semibold rounded-lg hover:bg-primary/90 transition-colors text-sm shrink-0">
          <Map className="h-4 w-4" />
          Take Growth Engine Audit
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {pillars.map((pillar) => (
          <div key={pillar.name} className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-border">
              <h3 className={`text-sm font-bold ${pillar.color}`}>{pillar.name}</h3>
            </div>
            <div className="p-3 space-y-2">
              {pillar.modules.map((mod, i) => {
                const score = scores[idx++] || "red";
                return (
                  <div key={i} className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-secondary/50">
                    <div className={`h-2.5 w-2.5 rounded-full ${scoreColor[score]} traffic-dot shrink-0`} />
                    <span className="text-sm text-foreground flex-1">{mod}</span>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </PageLayout>
  );
}

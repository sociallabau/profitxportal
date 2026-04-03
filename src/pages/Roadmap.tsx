import PageLayout from "@/components/PageLayout";
import { Map, ExternalLink } from "lucide-react";

const CIRCLE_URL = "https://app.circle.so/sign_in";

const pillars = [
  {
    name: "BUILD",
    subtitle: "Retainer Offer",
    color: "text-pillar-build",
    modules: [
      "Build Your Offer",
      "Get Client Results",
      "Offer Optimisation",
      "Case Study System",
      "Premium Positioning",
      "Offer to Agency",
    ],
  },
  {
    name: "TRAFFIC",
    subtitle: "Growth Engine",
    color: "text-pillar-traffic",
    modules: [
      "Content Foundation",
      "First 1k Followers",
      "Ads Foundations",
      "Paid Traffic System",
      "Content to Leads Machine",
      "Full Funnel",
    ],
  },
  {
    name: "SALES",
    subtitle: "Sales System",
    color: "text-pillar-sales",
    modules: [
      "Discovery Call Framework",
      "Objection Handling",
      "Close Rate Optimisation",
      "Sales CRM Setup",
      "Sales Script Mastery",
      "Hire a Setter",
    ],
  },
  {
    name: "SCALE",
    subtitle: "Scale System",
    color: "text-pillar-scale",
    modules: [
      "Remove Yourself from Delivery",
      "SOP Library",
      "First Hire",
      "Team Systems",
      "Agency Model",
      "Operator Handoff",
    ],
  },
];

const scores = [
  "green", "green", "amber", "red", "red", "red",
  "green", "amber", "amber", "green", "red", "amber",
  "green", "green", "amber", "amber", "red", "green",
  "green", "amber", "amber", "red", "red", "red",
];

const scoreColor: Record<string, string> = {
  green: "bg-success",
  amber: "bg-warning",
  red: "bg-destructive",
};

const tierLabels = ["Onramp", "Onramp", "Growth", "Growth", "Scale", "Scale"];

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
              <p className="text-xs text-muted-foreground">{pillar.subtitle}</p>
            </div>
            <div className="p-3 space-y-2">
              {pillar.modules.map((mod, i) => {
                const score = scores[idx++] || "red";
                const tier = tierLabels[i];
                return (
                  <div key={i} className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-muted/50">
                    <div className={`h-2.5 w-2.5 rounded-full ${scoreColor[score]} traffic-dot shrink-0`} />
                    <div className="flex-1 min-w-0">
                      <span className="text-sm text-foreground block">{mod}</span>
                      <span className="text-[10px] text-muted-foreground">{tier}</span>
                    </div>
                  </div>
                );
              })}
              <a
                href={CIRCLE_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-primary hover:text-primary/80 transition-colors px-3"
              >
                Open in Circle <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        ))}
      </div>
    </PageLayout>
  );
}

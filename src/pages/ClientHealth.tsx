import PageLayout from "@/components/PageLayout";
import { Search } from "lucide-react";

const clients = [
  { name: "Test Client", initials: "TC", tier: "Growth", revenue: "$11,800", activeClients: 6, lastSubmission: "3 days ago", red: 3, amber: 4, green: 5, health: "green" },
  { name: "Sarah M.", initials: "SM", tier: "Onramp", revenue: "$2,400", activeClients: 2, lastSubmission: "1 week ago", red: 5, amber: 4, green: 3, health: "amber" },
  { name: "James K.", initials: "JK", tier: "Scale", revenue: "$28,500", activeClients: 12, lastSubmission: "2 days ago", red: 1, amber: 3, green: 8, health: "green" },
  { name: "Emily R.", initials: "ER", tier: "Onramp", revenue: "$800", activeClients: 1, lastSubmission: "3 weeks ago", red: 8, amber: 3, green: 1, health: "red" },
];

const healthBorder: Record<string, string> = {
  green: "border-success/30",
  amber: "border-warning/30",
  red: "border-destructive/30",
};

const tierColor: Record<string, string> = {
  Onramp: "bg-warning/10 text-warning",
  Growth: "bg-primary/10 text-primary",
  Scale: "bg-pillar-sales/10 text-pillar-sales",
};

export default function ClientHealth() {
  return (
    <PageLayout>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold text-foreground">Client Health Dashboard</h1>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input placeholder="Search clients..." className="h-10 pl-10 pr-4 rounded-lg bg-card border border-border text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 w-64" />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {clients.map((c) => (
          <div key={c.name} className={`bg-card border-2 ${healthBorder[c.health]} rounded-xl p-5 animate-fade-in`}>
            <div className="flex items-center gap-3 mb-4">
              <div className="h-10 w-10 rounded-full bg-secondary flex items-center justify-center text-sm font-bold text-foreground">
                {c.initials}
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">{c.name}</p>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${tierColor[c.tier]}`}>{c.tier}</span>
              </div>
            </div>
            <div className="space-y-2 mb-4">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Revenue</span>
                <span className="text-foreground font-medium">{c.revenue}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Active Clients</span>
                <span className="text-foreground font-medium">{c.activeClients}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Last Submission</span>
                <span className="text-foreground">{c.lastSubmission}</span>
              </div>
            </div>
            <div className="flex items-center gap-4 mb-4">
              <div className="flex items-center gap-1.5">
                <div className="h-2.5 w-2.5 rounded-full bg-destructive" />
                <span className="text-xs text-muted-foreground">{c.red}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="h-2.5 w-2.5 rounded-full bg-warning" />
                <span className="text-xs text-muted-foreground">{c.amber}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="h-2.5 w-2.5 rounded-full bg-success" />
                <span className="text-xs text-muted-foreground">{c.green}</span>
              </div>
            </div>
            <button className="w-full h-9 bg-secondary text-foreground text-sm font-medium rounded-lg hover:bg-secondary/80 transition-colors">
              View Profile
            </button>
          </div>
        ))}
      </div>
    </PageLayout>
  );
}

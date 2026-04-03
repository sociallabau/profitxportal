import PageLayout from "@/components/PageLayout";
import { Plus } from "lucide-react";

const content = [
  { title: "How I Sign $3k Retainers", platform: "Instagram", type: "Short Form Video", aim: "Lead Generation", date: "Mar 26", views: 3420, leads: 3, perf: "Positive Outlier" },
  { title: "Day in the Life of a Video Business Owner", platform: "YouTube", type: "Long Form Video", aim: "Authority", date: "Mar 22", views: 1850, leads: 1, perf: "Average" },
  { title: "5 Mistakes New Videographers Make", platform: "Instagram", type: "Carousel", aim: "Education", date: "Mar 19", views: 980, leads: 0, perf: "Below Average" },
  { title: "Client Case Study: Studio Bloom", platform: "LinkedIn", type: "Short Form Video", aim: "Case Study", date: "Mar 15", views: 620, leads: 2, perf: "Average" },
];

const perfColor: Record<string, string> = {
  "Positive Outlier": "text-success bg-success/10",
  Average: "text-warning bg-warning/10",
  "Below Average": "text-destructive bg-destructive/10",
};

export default function ContentTracker() {
  return (
    <PageLayout>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold text-foreground">Content Tracker</h1>
        <button className="inline-flex items-center gap-2 h-10 px-5 bg-primary text-primary-foreground font-semibold rounded-lg hover:bg-primary/90 transition-colors text-sm">
          <Plus className="h-4 w-4" /> Add Content
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        {[
          { label: "Posts this month", value: "12" },
          { label: "Avg views/post", value: "1,240" },
          { label: "Leads from content", value: "6" },
          { label: "Top platform", value: "Instagram" },
        ].map((s) => (
          <div key={s.label} className="bg-card border border-border rounded-xl p-4">
            <p className="text-xs text-muted-foreground">{s.label}</p>
            <p className="text-lg font-bold text-foreground mt-1">{s.value}</p>
          </div>
        ))}
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                {["Title", "Platform", "Type", "Aim", "Date", "Views", "Leads", "Performance"].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {content.map((c, i) => (
                <tr key={i} className="border-b border-border last:border-0 hover:bg-secondary/30 transition-colors">
                  <td className="px-4 py-3 text-sm text-foreground font-medium">{c.title}</td>
                  <td className="px-4 py-3">
                    <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">{c.platform}</span>
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">{c.type}</td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">{c.aim}</td>
                  <td className="px-4 py-3 text-sm text-muted-foreground whitespace-nowrap">{c.date}</td>
                  <td className="px-4 py-3 text-sm text-foreground">{c.views.toLocaleString()}</td>
                  <td className="px-4 py-3 text-sm text-foreground">{c.leads}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${perfColor[c.perf]}`}>{c.perf}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </PageLayout>
  );
}

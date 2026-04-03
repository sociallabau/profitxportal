import PageLayout from "@/components/PageLayout";

const fields = [
  { section: "Revenue", items: [{ label: "Total Revenue ($)", key: "revenue" }, { label: "Cash Collected ($)", key: "cash" }, { label: "Expenses ($)", key: "expenses" }] },
  { section: "Clients", items: [{ label: "Active Retainer Clients", key: "active" }, { label: "New Clients Signed", key: "new" }, { label: "Client Retention Rate (%)", key: "retention" }, { label: "Sales Calls Booked", key: "booked" }, { label: "Sales Calls Closed", key: "closed" }] },
  { section: "Content & Traffic", items: [{ label: "Content Pieces Posted", key: "posts" }, { label: "Avg Views Per Post", key: "views" }, { label: "Leads Generated", key: "leads" }, { label: "Instagram Followers", key: "ig" }, { label: "YouTube Subscribers", key: "yt" }, { label: "Email List Size", key: "email" }] },
];

export default function MonthlyTotals() {
  const now = new Date();
  const monthName = now.toLocaleDateString("en-US", { month: "long" });

  return (
    <PageLayout>
      <h1 className="text-2xl font-bold text-foreground mb-2">Submit {monthName} {now.getFullYear()} Data</h1>
      <p className="text-sm text-muted-foreground mb-8">Enter your key metrics for this month.</p>

      <div className="space-y-8">
        {fields.map((group) => (
          <div key={group.section} className="bg-card border border-border rounded-xl p-5">
            <h3 className="text-sm font-semibold text-foreground mb-4">{group.section}</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {group.items.map((item) => (
                <div key={item.key}>
                  <label className="block text-xs text-muted-foreground mb-1.5">{item.label}</label>
                  <input
                    type="number"
                    className="w-full h-10 px-4 rounded-lg bg-secondary border border-border text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                </div>
              ))}
            </div>
          </div>
        ))}

        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="text-sm font-semibold text-foreground mb-4">Notes</h3>
          <textarea
            placeholder="Any context on this month..."
            className="w-full h-24 px-4 py-3 rounded-lg bg-secondary border border-border text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
          />
        </div>

        <button className="h-11 px-6 bg-primary text-primary-foreground font-semibold rounded-lg hover:bg-primary/90 transition-colors text-sm">
          Submit Monthly Data
        </button>
      </div>
    </PageLayout>
  );
}

import PageLayout from "@/components/PageLayout";

const clients = [
  { date: "Mar 25", name: "Studio Bloom", package: "3-month retainer", value: 2500, start: "Apr 1" },
  { date: "Mar 10", name: "FreshCut Media", package: "Monthly retainer", value: 1800, start: "Mar 15" },
  { date: "Feb 22", name: "Pixel Perfect Co", package: "6-month retainer", value: 3200, start: "Mar 1" },
];

export default function NewClients() {
  return (
    <PageLayout>
      <h1 className="text-2xl font-bold text-foreground mb-6">New Clients</h1>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs text-muted-foreground">New clients this month</p>
          <p className="text-2xl font-bold text-foreground mt-1">2</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs text-muted-foreground">Total value</p>
          <p className="text-2xl font-bold text-foreground mt-1">$4,300</p>
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl p-5 mb-6">
        <h3 className="text-sm font-semibold text-foreground mb-4">Log a New Client</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <input placeholder="Client name" className="h-10 px-4 rounded-lg bg-secondary border border-border text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
          <input placeholder="Package sold" className="h-10 px-4 rounded-lg bg-secondary border border-border text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
          <input placeholder="Deal value ($)" type="number" className="h-10 px-4 rounded-lg bg-secondary border border-border text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
          <input type="date" className="h-10 px-4 rounded-lg bg-secondary border border-border text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
        </div>
        <button className="mt-4 h-10 px-5 bg-primary text-primary-foreground font-semibold rounded-lg hover:bg-primary/90 transition-colors text-sm">
          Log New Client 🎉
        </button>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              {["Date", "Client", "Package", "Deal Value", "Start Date"].map((h) => (
                <th key={h} className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {clients.map((c, i) => (
              <tr key={i} className="border-b border-border last:border-0">
                <td className="px-4 py-3 text-sm text-muted-foreground">{c.date}</td>
                <td className="px-4 py-3 text-sm text-foreground font-medium">{c.name}</td>
                <td className="px-4 py-3 text-sm text-muted-foreground">{c.package}</td>
                <td className="px-4 py-3 text-sm text-foreground">${c.value.toLocaleString()}</td>
                <td className="px-4 py-3 text-sm text-muted-foreground">{c.start}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </PageLayout>
  );
}

import { DollarSign, Users, UserPlus, Target, TrendingUp } from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { Link } from "react-router-dom";
import PageLayout from "@/components/PageLayout";
import StatCard from "@/components/StatCard";

const revenueData = [
  { month: "Oct", revenue: 3200 },
  { month: "Nov", revenue: 4800 },
  { month: "Dec", revenue: 6100 },
  { month: "Jan", revenue: 7500 },
  { month: "Feb", revenue: 9200 },
  { month: "Mar", revenue: 11800 },
];

const recentSubmissions = [
  { date: "Mar 28", type: "Weekly Win", title: "Signed 2nd retainer client this month!" },
  { date: "Mar 25", type: "New Client", title: "Studio Bloom — $2,500/mo retainer" },
  { date: "Mar 21", type: "Weekly Win", title: "Hit 5k followers on Instagram" },
  { date: "Mar 18", type: "New Client", title: "FreshCut Media — $1,800/mo retainer" },
  { date: "Mar 14", type: "Weekly Win", title: "First YouTube video got 2.4k views" },
];

export default function Dashboard() {
  const now = new Date();
  const greeting =
    now.getHours() < 12 ? "Good morning" : now.getHours() < 18 ? "Good afternoon" : "Good evening";

  return (
    <PageLayout>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {greeting}, Test Client 👋
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
          </p>
        </div>
        <Link
          to="/submissions/monthly"
          className="inline-flex items-center gap-2 h-10 px-5 bg-primary text-primary-foreground font-semibold rounded-lg hover:bg-primary/90 transition-colors text-sm shrink-0"
        >
          Submit this month's data →
        </Link>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard title="Revenue This Month" value="$11,800" change={28} icon={DollarSign} />
        <StatCard title="Active Retainer Clients" value="6" change={20} icon={Users} />
        <StatCard title="New Clients Signed" value="2" change={100} icon={UserPlus} />
        <StatCard title="Leads Generated" value="14" change={-7} icon={Target} />
      </div>

      {/* Revenue chart + Quick Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 mb-6">
        <div className="lg:col-span-3 bg-card border border-border rounded-xl p-5 animate-fade-in">
          <h3 className="text-sm font-semibold text-foreground mb-4">Revenue — Last 6 Months</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={revenueData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(0 0% 12%)" />
                <XAxis dataKey="month" stroke="hsl(220 9% 46%)" fontSize={12} />
                <YAxis stroke="hsl(220 9% 46%)" fontSize={12} tickFormatter={(v) => `$${v / 1000}k`} />
                <Tooltip
                  contentStyle={{
                    background: "hsl(0 0% 5.9%)",
                    border: "1px solid hsl(0 0% 12%)",
                    borderRadius: "0.5rem",
                    color: "white",
                    fontSize: 13,
                  }}
                  formatter={(value: number) => [`$${value.toLocaleString()}`, "Revenue"]}
                />
                <Line
                  type="monotone"
                  dataKey="revenue"
                  stroke="hsl(46 91% 57%)"
                  strokeWidth={2.5}
                  dot={{ fill: "hsl(46 91% 57%)", r: 4 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="lg:col-span-2 bg-card border border-border rounded-xl p-5 animate-fade-in">
          <h3 className="text-sm font-semibold text-foreground mb-4">Quick Stats</h3>
          <div className="space-y-4">
            {[
              { label: "Cash Collected", value: "$10,600" },
              { label: "Expenses", value: "$3,200" },
              { label: "Profit Margin", value: "73%" },
              { label: "Sales Call Close Rate", value: "40%" },
              { label: "Client Retention Rate", value: "83%" },
            ].map((stat) => (
              <div key={stat.label} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                <span className="text-sm text-muted-foreground">{stat.label}</span>
                <span className="text-sm font-semibold text-foreground">{stat.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Third row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-card border border-border rounded-xl p-5 animate-fade-in">
          <h3 className="text-sm font-semibold text-foreground mb-3">Content Performance</h3>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Posts this month</span>
              <span className="text-sm font-semibold text-foreground">12</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Avg views/post</span>
              <span className="text-sm font-semibold text-foreground">1,240</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Top platform</span>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">
                Instagram
              </span>
            </div>
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-5 animate-fade-in">
          <h3 className="text-sm font-semibold text-foreground mb-3">Growth Metrics</h3>
          <div className="space-y-3">
            {[
              { label: "Instagram Followers", value: "5,120", change: "+340" },
              { label: "YouTube Subscribers", value: "892", change: "+78" },
              { label: "Email List", value: "1,450", change: "+112" },
            ].map((m) => (
              <div key={m.label} className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{m.label}</span>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-foreground">{m.value}</span>
                  <span className="text-xs text-success">{m.change}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-5 animate-fade-in">
          <h3 className="text-sm font-semibold text-foreground mb-3">Roadmap Progress</h3>
          <div className="flex items-center gap-6 mb-4">
            <div className="flex items-center gap-1.5">
              <div className="h-3 w-3 rounded-full bg-destructive traffic-dot" />
              <span className="text-sm text-muted-foreground">3</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-3 w-3 rounded-full bg-warning traffic-dot" />
              <span className="text-sm text-muted-foreground">4</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-3 w-3 rounded-full bg-success traffic-dot" />
              <span className="text-sm text-muted-foreground">5</span>
            </div>
          </div>
          <Link
            to="/roadmap"
            className="text-sm text-primary hover:underline font-medium"
          >
            View Roadmap →
          </Link>
        </div>
      </div>

      {/* Recent Submissions */}
      <div className="bg-card border border-border rounded-xl p-5 animate-fade-in">
        <h3 className="text-sm font-semibold text-foreground mb-4">Recent Submissions</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2 text-xs font-medium text-muted-foreground">Date</th>
                <th className="text-left py-2 text-xs font-medium text-muted-foreground">Type</th>
                <th className="text-left py-2 text-xs font-medium text-muted-foreground">Title</th>
              </tr>
            </thead>
            <tbody>
              {recentSubmissions.map((s, i) => (
                <tr key={i} className="border-b border-border last:border-0">
                  <td className="py-3 text-sm text-muted-foreground whitespace-nowrap">{s.date}</td>
                  <td className="py-3">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        s.type === "Weekly Win"
                          ? "bg-primary/10 text-primary"
                          : "bg-success/10 text-success"
                      }`}
                    >
                      {s.type}
                    </span>
                  </td>
                  <td className="py-3 text-sm text-foreground">{s.title}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </PageLayout>
  );
}

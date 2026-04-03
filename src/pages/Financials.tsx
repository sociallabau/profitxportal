import PageLayout from "@/components/PageLayout";
import StatCard from "@/components/StatCard";
import { DollarSign, TrendingUp, Receipt, PiggyBank } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line,
} from "recharts";

const barData = [
  { month: "Oct", revenue: 3200, expenses: 1200 },
  { month: "Nov", revenue: 4800, expenses: 1800 },
  { month: "Dec", revenue: 6100, expenses: 2100 },
  { month: "Jan", revenue: 7500, expenses: 2400 },
  { month: "Feb", revenue: 9200, expenses: 2800 },
  { month: "Mar", revenue: 11800, expenses: 3200 },
];

const mrrData = [
  { month: "Oct", mrr: 2800 },
  { month: "Nov", mrr: 3600 },
  { month: "Dec", mrr: 5200 },
  { month: "Jan", mrr: 6800 },
  { month: "Feb", mrr: 8400 },
  { month: "Mar", mrr: 10200 },
];

const monthlyBreakdown = [
  { month: "March", revenue: 11800, expenses: 3200, profit: 8600, margin: "73%" },
  { month: "February", revenue: 9200, expenses: 2800, profit: 6400, margin: "70%" },
  { month: "January", revenue: 7500, expenses: 2400, profit: 5100, margin: "68%" },
  { month: "December", revenue: 6100, expenses: 2100, profit: 4000, margin: "66%" },
  { month: "November", revenue: 4800, expenses: 1800, profit: 3000, margin: "63%" },
  { month: "October", revenue: 3200, expenses: 1200, profit: 2000, margin: "63%" },
];

export default function Financials() {
  return (
    <PageLayout>
      <h1 className="text-2xl font-bold text-foreground mb-8">Financials</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard title="MRR" value="$10,200" change={21} icon={TrendingUp} />
        <StatCard title="Revenue (YTD)" value="$42,600" icon={DollarSign} />
        <StatCard title="Expenses (YTD)" value="$13,500" icon={Receipt} />
        <StatCard title="Net Profit (YTD)" value="$29,100" icon={PiggyBank} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="text-sm font-semibold text-foreground mb-4">Revenue vs Expenses</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(0 0% 12%)" />
                <XAxis dataKey="month" stroke="hsl(220 9% 46%)" fontSize={12} />
                <YAxis stroke="hsl(220 9% 46%)" fontSize={12} tickFormatter={(v) => `$${v / 1000}k`} />
                <Tooltip contentStyle={{ background: "hsl(0 0% 5.9%)", border: "1px solid hsl(0 0% 12%)", borderRadius: "0.5rem", color: "white", fontSize: 13 }} />
                <Bar dataKey="revenue" fill="hsl(46 91% 57%)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="expenses" fill="hsl(220 9% 46%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="text-sm font-semibold text-foreground mb-4">MRR Growth</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={mrrData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(0 0% 12%)" />
                <XAxis dataKey="month" stroke="hsl(220 9% 46%)" fontSize={12} />
                <YAxis stroke="hsl(220 9% 46%)" fontSize={12} tickFormatter={(v) => `$${v / 1000}k`} />
                <Tooltip contentStyle={{ background: "hsl(0 0% 5.9%)", border: "1px solid hsl(0 0% 12%)", borderRadius: "0.5rem", color: "white", fontSize: 13 }} />
                <Line type="monotone" dataKey="mrr" stroke="hsl(46 91% 57%)" strokeWidth={2.5} dot={{ fill: "hsl(46 91% 57%)", r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h3 className="text-sm font-semibold text-foreground">Monthly Breakdown</h3>
        </div>
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              {["Month", "Revenue", "Expenses", "Profit", "Margin"].map((h) => (
                <th key={h} className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {monthlyBreakdown.map((r) => (
              <tr key={r.month} className="border-b border-border last:border-0">
                <td className="px-4 py-3 text-sm text-foreground font-medium">{r.month}</td>
                <td className="px-4 py-3 text-sm text-foreground">${r.revenue.toLocaleString()}</td>
                <td className="px-4 py-3 text-sm text-muted-foreground">${r.expenses.toLocaleString()}</td>
                <td className="px-4 py-3 text-sm text-success">${r.profit.toLocaleString()}</td>
                <td className="px-4 py-3 text-sm text-foreground">{r.margin}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </PageLayout>
  );
}

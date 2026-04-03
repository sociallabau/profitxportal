import PageLayout from "@/components/PageLayout";
import StatCard from "@/components/StatCard";
import { useRequireAuth } from '@/hooks/useAuth';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { DollarSign, TrendingUp, Receipt, PiggyBank } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line,
} from "recharts";

export default function Financials() {
  const { user, loading } = useRequireAuth();

  const { data: monthlyData } = useQuery({
    queryKey: ['financials', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from('monthly_totals')
        .select('month, mrr, oneoff_revenue, expenses')
        .eq('user_id', user!.id)
        .order('month', { ascending: true });
      return (data ?? []).map((r: any) => {
        const retainers = Number(r.mrr) || 0;
        const oneoffs = Number(r.oneoff_revenue) || 0;
        const expenses = Number(r.expenses) || 0;
        const revenue = retainers + oneoffs;
        const profit = revenue - expenses;
        const margin = revenue > 0 ? Math.round((profit / revenue) * 100) : 0;
        return {
          month: new Date(r.month).toLocaleString('default', { month: 'short' }),
          retainers,
          oneoffs,
          revenue,
          expenses,
          profit,
          margin: `${margin}%`,
          monthFull: new Date(r.month).toLocaleString('default', { month: 'long' }),
        };
      });
    },
  });

  if (loading) return null;

  const rows = monthlyData ?? [];
  const latest = rows[rows.length - 1];
  const prev = rows.length >= 2 ? rows[rows.length - 2] : null;
  const mrrChange = latest && prev && prev.retainers > 0
    ? Math.round(((latest.retainers - prev.retainers) / prev.retainers) * 100)
    : undefined;

  const ytdRevenue = rows.reduce((s, r) => s + r.revenue, 0);
  const ytdExpenses = rows.reduce((s, r) => s + r.expenses, 0);
  const ytdProfit = ytdRevenue - ytdExpenses;

  const barData = rows.map((r) => ({ month: r.month, revenue: r.revenue, expenses: r.expenses }));
  const mrrData = rows.map((r) => ({ month: r.month, mrr: r.retainers }));
  const breakdown = [...rows].reverse();

  return (
    <PageLayout>
      <h1 className="text-2xl font-bold text-foreground mb-8">Financials</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard title="MRR (Retainers)" value={`$${(latest?.retainers ?? 0).toLocaleString()}`} change={mrrChange} icon={TrendingUp} />
        <StatCard title="Revenue (YTD)" value={`$${ytdRevenue.toLocaleString()}`} icon={DollarSign} />
        <StatCard title="Expenses (YTD)" value={`$${ytdExpenses.toLocaleString()}`} icon={Receipt} />
        <StatCard title="Net Profit (YTD)" value={`$${ytdProfit.toLocaleString()}`} icon={PiggyBank} />
      </div>

      {rows.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-8 text-center">
          <p className="text-muted-foreground text-sm">No financial data yet. Submit your monthly totals to see your charts here.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
            <div className="bg-card border border-border rounded-xl p-5">
              <h3 className="text-sm font-semibold text-foreground mb-4">Revenue vs Expenses</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={barData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(0 0% 18%)" />
                    <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickFormatter={(v) => `$${v / 1000}k`} />
                    <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "0.5rem", color: "hsl(var(--foreground))", fontSize: 13 }} />
                    <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="expenses" fill="hsl(var(--muted-foreground))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-card border border-border rounded-xl p-5">
              <h3 className="text-sm font-semibold text-foreground mb-4">MRR Growth (Retainers)</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={mrrData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(0 0% 18%)" />
                    <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickFormatter={(v) => `$${v / 1000}k`} />
                    <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "0.5rem", color: "hsl(var(--foreground))", fontSize: 13 }} />
                    <Line type="monotone" dataKey="mrr" stroke="hsl(var(--primary))" strokeWidth={2.5} dot={{ fill: "hsl(var(--primary))", r: 4 }} />
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
                  {["Month", "Retainers", "One-Offs", "Revenue", "Expenses", "Profit", "Margin"].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {breakdown.map((r) => (
                  <tr key={r.monthFull} className="border-b border-border last:border-0">
                    <td className="px-4 py-3 text-sm text-foreground font-medium">{r.monthFull}</td>
                    <td className="px-4 py-3 text-sm text-primary font-semibold">${r.retainers.toLocaleString()}</td>
                    <td className="px-4 py-3 text-sm text-foreground">${r.oneoffs.toLocaleString()}</td>
                    <td className="px-4 py-3 text-sm text-foreground">${r.revenue.toLocaleString()}</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">${r.expenses.toLocaleString()}</td>
                    <td className={`px-4 py-3 text-sm font-semibold ${r.profit >= 0 ? 'text-success' : 'text-destructive'}`}>${r.profit.toLocaleString()}</td>
                    <td className="px-4 py-3 text-sm text-foreground">{r.margin}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </PageLayout>
  );
}

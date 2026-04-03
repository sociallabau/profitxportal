import { ArrowUp, ArrowDown } from "lucide-react";
import { LucideIcon } from "lucide-react";

interface StatCardProps {
  title: string;
  value: string;
  change?: number;
  icon?: LucideIcon;
}

export default function StatCard({ title, value, change, icon: Icon }: StatCardProps) {
  const isPositive = change !== undefined && change >= 0;

  return (
    <div className="bg-card border border-border rounded-xl p-5 animate-fade-in">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm text-muted-foreground">{title}</span>
        {Icon && (
          <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Icon className="h-4 w-4 text-primary" />
          </div>
        )}
      </div>
      <p className="text-2xl font-bold text-foreground">{value}</p>
      {change !== undefined && (
        <div className="flex items-center gap-1 mt-2">
          {isPositive ? (
            <ArrowUp className="h-3.5 w-3.5 text-success" />
          ) : (
            <ArrowDown className="h-3.5 w-3.5 text-destructive" />
          )}
          <span className={`text-xs font-medium ${isPositive ? "text-success" : "text-destructive"}`}>
            {Math.abs(change)}%
          </span>
          <span className="text-xs text-muted-foreground">vs last month</span>
        </div>
      )}
    </div>
  );
}

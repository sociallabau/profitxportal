import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Map,
  FileText,
  Trophy,
  DollarSign,
  Sparkles,
  Users,
  Settings,
  LogOut,
  Menu,
  X,
  ExternalLink,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

const navItems = [
  { label: "Dashboard", path: "/dashboard", icon: LayoutDashboard },
  { label: "Roadmap", path: "/roadmap", icon: Map },
  { label: "Content Tracker", path: "/content", icon: FileText },
  {
    label: "Submissions",
    icon: Trophy,
    children: [
      { label: "Weekly Wins", path: "/submissions/wins" },
      { label: "New Clients", path: "/submissions/clients" },
      { label: "Monthly Totals", path: "/submissions/monthly" },
      { label: "Checklist", path: "/submissions/checklist" },
    ],
  },
  { label: "Financials", path: "/financials", icon: DollarSign },
  { label: "AI Toolkit", path: "/ai-tools", icon: Sparkles },
  { label: "Settings", path: "/settings", icon: Settings },
];

const adminItems = [
  { label: "Client Health", path: "/admin/clients", icon: Users },
];

const CIRCLE_MODULES_URL = "https://app.circle.so/sign_in";

export default function AppSidebar() {
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [submissionsOpen, setSubmissionsOpen] = useState(
    location.pathname.startsWith("/submissions")
  );

  const isActive = (path: string) => location.pathname === path;
  const isSubmissionsActive = location.pathname.startsWith("/submissions");

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="px-5 py-6 border-b border-border">
        <Link to="/dashboard" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <span className="text-primary-foreground font-bold text-sm">P</span>
          </div>
          <span className="font-bold text-lg text-foreground tracking-tight">ProfitX</span>
        </Link>
      </div>

      {/* Circle Modules CTA */}
      <div className="px-4 py-3 border-b border-border">
        <a
          href={CIRCLE_MODULES_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-between w-full px-3 py-2.5 rounded-lg bg-primary/10 border border-primary/20 hover:bg-primary/20 transition-colors group"
        >
          <span className="text-sm font-semibold text-primary">Course Modules</span>
          <ExternalLink className="w-3.5 h-3.5 text-primary/70 group-hover:text-primary transition-colors" />
        </a>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {navItems.map((item) => {
          if (item.children) {
            return (
              <div key={item.label}>
                <button
                  onClick={() => setSubmissionsOpen(!submissionsOpen)}
                  className={cn(
                    "flex items-center w-full gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                    isSubmissionsActive
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent/10"
                  )}
                >
                  <item.icon className="w-4 h-4 shrink-0" />
                  <span className="flex-1 text-left">{item.label}</span>
                  <span className="text-xs opacity-60">{submissionsOpen ? "▴" : "▾"}</span>
                </button>
                {submissionsOpen && (
                  <div className="ml-7 mt-0.5 space-y-0.5 border-l border-border pl-3">
                    {item.children.map((child) => (
                      <Link
                        key={child.path}
                        to={child.path}
                        onClick={() => setMobileOpen(false)}
                        className={cn(
                          "block px-3 py-2 rounded-lg text-sm transition-colors",
                          isActive(child.path)
                            ? "text-primary font-semibold"
                            : "text-muted-foreground hover:text-foreground"
                        )}
                      >
                        {child.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            );
          }
          return (
            <Link
              key={item.path}
              to={item.path!}
              onClick={() => setMobileOpen(false)}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                isActive(item.path!)
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              )}
            >
              <item.icon className="w-4 h-4 shrink-0" />
              {item.label}
            </Link>
          );
        })}

        {/* Admin section */}
        <div className="pt-4 mt-2 border-t border-border">
          <p className="px-3 mb-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Admin
          </p>
          {adminItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              onClick={() => setMobileOpen(false)}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                isActive(item.path)
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              )}
            >
              <item.icon className="w-4 h-4 shrink-0" />
              {item.label}
            </Link>
          ))}
        </div>
      </nav>

      {/* Footer */}
      <div className="px-3 py-4 border-t border-border">
        <Link
          to="/"
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Sign out
        </Link>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-col w-60 shrink-0 h-screen sticky top-0 bg-card border-r border-border">
        <SidebarContent />
      </aside>

      {/* Mobile hamburger */}
      <button
        onClick={() => setMobileOpen(true)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 bg-card border border-border rounded-lg text-foreground"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Mobile drawer */}
      {mobileOpen && (
        <>
          <div
            className="lg:hidden fixed inset-0 z-40 bg-background/80 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="lg:hidden fixed left-0 top-0 z-50 w-60 h-screen bg-card border-r border-border">
            <button
              onClick={() => setMobileOpen(false)}
              className="absolute top-4 right-4 p-1.5 text-muted-foreground hover:text-foreground"
            >
              <X className="w-4 h-4" />
            </button>
            <SidebarContent />
          </aside>
        </>
      )}
    </>
  );
}

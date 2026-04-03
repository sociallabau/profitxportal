import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  BarChart3,
  Map,
  FileText,
  Trophy,
  UserPlus,
  CalendarCheck,
  CheckSquare,
  DollarSign,
  HeartPulse,
  Bot,
  Settings,
  LogOut,
  Video,
  Menu,
  X,
  ChevronDown,
} from "lucide-react";

const navItems = [
  { label: "Dashboard", icon: BarChart3, path: "/dashboard" },
  { label: "The Roadmap", icon: Map, path: "/roadmap" },
  { label: "Content Tracker", icon: FileText, path: "/content" },
  {
    label: "Submissions",
    icon: CalendarCheck,
    path: "/submissions",
    children: [
      { label: "Weekly Wins", icon: Trophy, path: "/submissions/wins" },
      { label: "New Clients", icon: UserPlus, path: "/submissions/clients" },
      { label: "Monthly Totals", icon: CalendarCheck, path: "/submissions/monthly" },
      { label: "Checklist", icon: CheckSquare, path: "/submissions/checklist" },
    ],
  },
  { label: "Financials", icon: DollarSign, path: "/financials" },
  { label: "AI Toolkit", icon: Bot, path: "/ai-tools" },
  { label: "Settings", icon: Settings, path: "/settings" },
];

const adminItems = [
  { label: "Client Health", icon: HeartPulse, path: "/admin/clients" },
];

export default function AppSidebar() {
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [submissionsOpen, setSubmissionsOpen] = useState(
    location.pathname.startsWith("/submissions")
  );

  const isActive = (path: string) =>
    location.pathname === path || location.pathname.startsWith(path + "/");

  const renderNav = () => (
    <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
      {navItems.map((item) =>
        item.children ? (
          <div key={item.label}>
            <button
              onClick={() => setSubmissionsOpen(!submissionsOpen)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive(item.path)
                  ? "text-primary border-l-2 border-primary bg-primary/5"
                  : "text-sidebar-foreground hover:text-foreground hover:bg-sidebar-accent"
              }`}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              <span className="flex-1 text-left">{item.label}</span>
              <ChevronDown
                className={`h-3.5 w-3.5 transition-transform ${submissionsOpen ? "rotate-180" : ""}`}
              />
            </button>
            {submissionsOpen && (
              <div className="ml-4 mt-1 space-y-0.5">
                {item.children.map((child) => (
                  <Link
                    key={child.path}
                    to={child.path}
                    onClick={() => setMobileOpen(false)}
                    className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                      isActive(child.path)
                        ? "text-primary border-l-2 border-primary bg-primary/5"
                        : "text-sidebar-foreground hover:text-foreground hover:bg-sidebar-accent"
                    }`}
                  >
                    <child.icon className="h-3.5 w-3.5 shrink-0" />
                    <span>{child.label}</span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        ) : (
          <Link
            key={item.path}
            to={item.path}
            onClick={() => setMobileOpen(false)}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              isActive(item.path)
                ? "text-primary border-l-2 border-primary bg-primary/5"
                : "text-sidebar-foreground hover:text-foreground hover:bg-sidebar-accent"
            }`}
          >
            <item.icon className="h-4 w-4 shrink-0" />
            <span>{item.label}</span>
          </Link>
        )
      )}

      <div className="pt-2 border-t border-border mt-2">
        {adminItems.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            onClick={() => setMobileOpen(false)}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              isActive(item.path)
                ? "text-primary border-l-2 border-primary bg-primary/5"
                : "text-sidebar-foreground hover:text-foreground hover:bg-sidebar-accent"
            }`}
          >
            <item.icon className="h-4 w-4 shrink-0" />
            <span>{item.label}</span>
          </Link>
        ))}
      </div>
    </nav>
  );

  const sidebarContent = (
    <>
      {/* Logo */}
      <div className="px-5 py-5 border-b border-border">
        <Link to="/dashboard" className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
            <Video className="h-4 w-4 text-primary-foreground" />
          </div>
          <span className="text-lg font-bold text-foreground tracking-tight">
            VideoOS
          </span>
        </Link>
      </div>

      {renderNav()}

      {/* User section */}
      <div className="border-t border-border px-4 py-4">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-full bg-secondary flex items-center justify-center text-xs font-semibold text-foreground">
            TC
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate">Test Client</p>
            <p className="text-xs text-muted-foreground truncate">testclient@videoOS.com</p>
          </div>
        </div>
        <button className="mt-3 flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors w-full">
          <LogOut className="h-3.5 w-3.5" />
          Sign out
        </button>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile hamburger */}
      <button
        onClick={() => setMobileOpen(true)}
        className="lg:hidden fixed top-4 left-4 z-50 h-10 w-10 rounded-lg bg-card border border-border flex items-center justify-center"
      >
        <Menu className="h-5 w-5 text-foreground" />
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-background/80 backdrop-blur-sm"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile sidebar */}
      <aside
        className={`lg:hidden fixed inset-y-0 left-0 z-50 w-[250px] bg-card border-r border-border flex flex-col transform transition-transform duration-200 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <button
          onClick={() => setMobileOpen(false)}
          className="absolute top-4 right-4 text-muted-foreground hover:text-foreground"
        >
          <X className="h-5 w-5" />
        </button>
        {sidebarContent}
      </aside>

      {/* Desktop sidebar */}
      <aside className="hidden lg:flex fixed inset-y-0 left-0 z-30 w-[250px] bg-card border-r border-border flex-col">
        {sidebarContent}
      </aside>
    </>
  );
}

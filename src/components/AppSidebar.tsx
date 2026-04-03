import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Gauge, Route, BarChart3, BadgeCheck, Wallet, Cpu, HeartPulse,
  SlidersHorizontal, LogOut, Menu, X, ExternalLink, ChevronDown,
  ChevronRight, GraduationCap, BookOpen, Banknote,
} from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import { useProfile } from '@/hooks/useProfile';

export const CIRCLE_URLS = {
  modules: 'https://app.circle.so/sign_in',
  build: 'https://app.circle.so/sign_in',
  traffic: 'https://app.circle.so/sign_in',
  sales: 'https://app.circle.so/sign_in',
  scale: 'https://app.circle.so/sign_in',
  aiTools: 'https://app.circle.so/sign_in',
};

const navItems = [
  { label: 'Dashboard', path: '/dashboard', icon: Gauge },
  { label: 'Cash Menu', path: '/cash-menu', icon: Banknote },
  { label: 'Roadmap', path: '/roadmap', icon: Route },
  { label: 'Content Tracker', path: '/content', icon: BarChart3 },
  {
    label: 'Submissions', icon: BadgeCheck, children: [
      { label: 'Weekly Wins', path: '/submissions/wins' },
      { label: 'New Clients', path: '/submissions/clients' },
      { label: 'Monthly Totals', path: '/submissions/monthly' },
      { label: 'Checklist', path: '/submissions/checklist' },
    ],
  },
  { label: 'Financials', path: '/financials', icon: Wallet },
  { label: 'AI Toolkit', path: '/ai-tools', icon: Cpu },
  { label: 'Resources', path: '/resources', icon: BookOpen },
  { label: 'Settings', path: '/settings', icon: SlidersHorizontal },
];

const adminItems = [
  { label: 'Client Health', path: '/admin/clients', icon: HeartPulse },
];

function NavContent({ onClose }: { onClose?: () => void }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { data: profile } = useProfile();
  const [subOpen, setSubOpen] = useState(location.pathname.startsWith('/submissions'));

  const active = (path: string) => location.pathname === path;
  const subActive = location.pathname.startsWith('/submissions');

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

  return (
    <div className="flex flex-col h-full">
      <div className="px-5 py-5 border-b border-border">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shadow-md shadow-primary/30">
            <span className="text-primary-foreground font-bold text-sm">P</span>
          </div>
          <span className="font-bold italic text-lg text-foreground">ProfitX</span>
        </div>
        {profile?.full_name && (
          <p className="text-xs text-muted-foreground mt-2.5 truncate">
            👤 {profile.full_name}
          </p>
        )}
      </div>

      <div className="px-3 py-3 border-b border-border">
        <a
          href={CIRCLE_URLS.modules}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-between w-full px-3 py-2.5 rounded-lg bg-primary/10 border border-primary/20 hover:bg-primary/20 transition-colors group"
        >
          <GraduationCap className="w-4 h-4 text-primary" />
          <span className="text-sm font-semibold text-primary">Course Modules</span>
          <ExternalLink className="w-3.5 h-3.5 text-primary/60 group-hover:text-primary transition-colors" />
        </a>
      </div>

      <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto">
        {navItems.map((item) => {
          if (item.children) {
            return (
              <div key={item.label}>
                <button
                  onClick={() => setSubOpen(!subOpen)}
                  className={cn(
                    'flex items-center w-full gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                    subActive
                      ? 'bg-primary text-primary-foreground shadow-sm shadow-primary/20'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                  )}
                >
                  <item.icon className="w-4 h-4 shrink-0" />
                  <span className="flex-1 text-left">{item.label}</span>
                  {subOpen ? <ChevronDown className="w-3.5 h-3.5 opacity-60" /> : <ChevronRight className="w-3.5 h-3.5 opacity-60" />}
                </button>
                {subOpen && (
                  <div className="ml-7 mt-0.5 border-l border-border pl-3 space-y-0.5">
                    {item.children.map((child) => (
                      <Link
                        key={child.path}
                        to={child.path}
                        onClick={onClose}
                        className={cn(
                          'block px-3 py-2 rounded-lg text-sm transition-colors',
                          active(child.path)
                            ? 'text-primary font-semibold'
                            : 'text-muted-foreground hover:text-foreground'
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
              onClick={onClose}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                active(item.path!)
                  ? 'bg-primary text-primary-foreground shadow-sm shadow-primary/20'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
              )}
            >
              <item.icon className="w-4 h-4 shrink-0" />
              {item.label}
            </Link>
          );
        })}

        {profile?.is_admin && (
          <div className="pt-3 mt-2 border-t border-border">
            <p className="px-3 mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Admin</p>
            {adminItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                onClick={onClose}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                  active(item.path)
                    ? 'bg-primary text-primary-foreground shadow-sm shadow-primary/20'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                )}
              >
                <item.icon className="w-4 h-4 shrink-0" />
                {item.label}
              </Link>
            ))}
          </div>
        )}
      </nav>

      <div className="px-3 py-3 border-t border-border">
        <button
          onClick={handleSignOut}
          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Sign out
        </button>
      </div>
    </div>
  );
}

export default function AppSidebar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  return (
    <>
      <aside className="hidden lg:flex flex-col w-60 shrink-0 h-screen sticky top-0 bg-card border-r border-border">
        <NavContent />
      </aside>
      <button
        onClick={() => setMobileOpen(true)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 bg-card border border-border rounded-lg text-foreground"
      >
        <Menu className="w-5 h-5" />
      </button>
      {mobileOpen && (
        <>
          <div className="lg:hidden fixed inset-0 z-40 bg-background/70" onClick={() => setMobileOpen(false)} />
          <aside className="lg:hidden fixed left-0 top-0 z-50 w-60 h-screen bg-card border-r border-border">
            <button onClick={() => setMobileOpen(false)} className="absolute top-4 right-4 p-1.5 text-muted-foreground hover:text-foreground">
              <X className="w-4 h-4" />
            </button>
            <NavContent onClose={() => setMobileOpen(false)} />
          </aside>
        </>
      )}
    </>
  );
}

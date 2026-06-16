import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Gauge, Route, BarChart3, Wallet, HeartPulse,
  SlidersHorizontal, LogOut, Menu, X, ExternalLink,
  GraduationCap, Banknote, Trophy, Sparkles, Flame, Rocket, Lock, Video, Wand2, DollarSign,
  ChevronDown, Wrench,
} from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import { useProfile } from '@/hooks/useProfile';
import { OWNER_USER_ID } from '@/lib/owner';

export const CIRCLE_URLS = {
  modules: 'https://app.circle.so/sign_in',
};

const mainNavItems = [
  { label: 'Dashboard', path: '/dashboard', icon: Gauge },
  { label: 'Wins Wall', path: '/wins', icon: Trophy },
  { label: 'Roadmap', path: '/roadmap', icon: Route },
  { label: 'Financials', path: '/financials', icon: Wallet },
  { label: 'Vault', path: '/vault', icon: Lock },
  { label: 'Upcoming Calls', path: '/calls', icon: Video },
  { label: 'Settings', path: '/settings', icon: SlidersHorizontal },
];

const toolItems = [
  { label: 'Content Studio', path: '/content-studio', icon: Sparkles },
  { label: 'Hot List', path: '/hot-list', icon: Flame },
  { label: 'Launch HQ', path: '/launch', icon: Rocket },
  { label: 'Cash Menu', path: '/cash-menu', icon: Banknote },
];

const adminItems = [
  { label: 'Client Health', path: '/client-health', icon: HeartPulse },
];

const ownerItems = [
  { label: 'My Finances', path: '/admin/my-finances', icon: DollarSign },
];

function ToolsSection({ active, onClose }: { active: (path: string) => boolean; onClose?: () => void }) {
  const isToolActive = toolItems.some((item) => active(item.path));
  const [open, setOpen] = useState(isToolActive);

  return (
    <div className="space-y-0.5">
      <button
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'flex items-center justify-between w-full gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
          isToolActive
            ? 'bg-primary text-primary-foreground shadow-sm shadow-primary/20'
            : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
        )}
      >
        <span className="flex items-center gap-3">
          <Wrench className="w-4 h-4 shrink-0" />
          Tools
        </span>
        <ChevronDown
          className={cn('w-3.5 h-3.5 shrink-0 transition-transform', open && 'rotate-180')}
        />
      </button>
      {open && (
        <div className="pl-3 space-y-0.5">
          {toolItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              onClick={onClose}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
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
    </div>
  );
}

function NavContent({ onClose }: { onClose?: () => void }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { data: profile } = useProfile();

  const active = (path: string) => location.pathname === path;

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

      <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto">
        {mainNavItems.map((item) => (
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

        <ToolsSection active={active} onClose={onClose} />

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
            {profile?.id === OWNER_USER_ID && ownerItems.map((item) => (
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

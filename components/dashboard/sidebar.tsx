'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard, FolderGit2, FileSearch, History, BarChart3,
  User, Settings, Sparkles, X, ShieldCheck, Code2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/auth-context';
import { Button } from '@/components/ui/button';

const NAV = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/dashboard/projects', label: 'Projects', icon: FolderGit2 },
  { href: '/dashboard/reviews/new', label: 'New Review', icon: FileSearch },
  { href: '/dashboard/history', label: 'History', icon: History },
  { href: '/dashboard/analytics', label: 'Analytics', icon: BarChart3 },
  { href: '/dashboard/profile', label: 'Profile', icon: User },
  { href: '/dashboard/settings', label: 'Settings', icon: Settings },
];

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

export function DashboardSidebar({ open, onClose }: SidebarProps) {
  const pathname = usePathname();
  const { profile } = useAuth();

  return (
    <>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-background/60 backdrop-blur-sm lg:hidden"
          />
        )}
      </AnimatePresence>

      <aside
        className={cn(
          'fixed lg:sticky top-0 z-50 h-screen w-72 shrink-0 border-r border-border/60 bg-card/40 backdrop-blur-xl transition-transform lg:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex h-full flex-col">
          <div className="flex h-16 items-center justify-between px-6 border-b border-border/60">
            <Link href="/dashboard" className="flex items-center gap-2.5 group" onClick={onClose}>
              <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-accent text-white shadow-lg shadow-primary/30">
                <Code2 className="h-5 w-5" />
                <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-primary to-accent blur-md opacity-40 group-hover:opacity-70 transition-opacity" />
              </div>
              <div className="flex flex-col leading-none">
                <span className="font-semibold tracking-tight">CodeLens</span>
                <span className="text-[10px] text-muted-foreground uppercase tracking-widest">AI Review</span>
              </div>
            </Link>
            <Button variant="ghost" size="icon" className="lg:hidden" onClick={onClose}>
              <X className="h-5 w-5" />
            </Button>
          </div>

          <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
            {NAV.map((item) => {
              const active = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onClose}
                  className={cn(
                    'group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all',
                    active
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:bg-accent/10 hover:text-foreground'
                  )}
                >
                  {active && (
                    <motion.div
                      layoutId="sidebar-active"
                      className="absolute left-0 top-1/2 -translate-y-1/2 h-6 w-1 rounded-r-full bg-primary"
                      transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                    />
                  )}
                  <Icon className={cn('h-4.5 w-4.5 shrink-0', active && 'text-primary')} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="border-t border-border/60 p-3">
            <div className="rounded-lg bg-gradient-to-br from-primary/10 via-accent/10 to-transparent p-3.5">
              <div className="flex items-center gap-2 mb-1.5">
                <ShieldCheck className="h-4 w-4 text-success" />
                <span className="text-xs font-semibold">Pro Plan</span>
                <Sparkles className="h-3 w-3 text-warning ml-auto" />
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Unlimited AI reviews. {profile?.name ? `Welcome back, ${profile.name.split(' ')[0]}.` : 'Welcome.'}
              </p>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}

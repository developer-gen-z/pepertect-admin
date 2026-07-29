'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard, Users, CreditCard, ShoppingCart, Briefcase,
  LifeBuoy, BarChart3, Settings, Activity, ChevronLeft, ChevronRight,
  Zap, TrendingUp, X, Wifi,
} from 'lucide-react';

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/users', label: 'Users', icon: Users },
  { href: '/subscriptions', label: 'Subscriptions', icon: CreditCard },
  { href: '/orders', label: 'Orders', icon: ShoppingCart },
  { href: '/positions', label: 'Positions', icon: Briefcase },
  { href: '/tickets', label: 'Support', icon: LifeBuoy },
  { href: '/market', label: 'Market', icon: TrendingUp },
  { href: '/analytics', label: 'Analytics', icon: BarChart3 },
  { href: '/activity', label: 'Activity Logs', icon: Activity },
  { href: '/websocket-status', label: 'WebSocket Status', icon: Wifi },
  { href: '/settings', label: 'Settings', icon: Settings },
];

interface AdminSidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  mobileOpen: boolean;
  onMobileClose: () => void;
}

export function AdminSidebar({ collapsed, onToggle, mobileOpen, onMobileClose }: AdminSidebarProps) {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === '/dashboard') return pathname === '/dashboard';
    return pathname.startsWith(href);
  };

  return (
    <>
      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-black/40 lg:hidden" onClick={onMobileClose} />
      )}

      {/* Sidebar */}
      <aside className={cn(
        'fixed top-0 left-0 z-50 h-full bg-bg-surface border-r border-border flex flex-col transition-all duration-300',
        collapsed ? 'w-[72px]' : 'w-[250px]',
        mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
      )}>
        {/* Logo */}
        <div className={cn('flex items-center h-16 px-4 border-b border-border shrink-0', collapsed && 'justify-center')}>
          <Link href="/dashboard" className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-primary shrink-0">
              <Zap className="h-4.5 w-4.5 text-white" />
            </div>
            {!collapsed && (
              <div className="overflow-hidden">
                <h1 className="font-heading text-sm font-bold text-text-primary whitespace-nowrap">Pepertect</h1>
                <p className="text-[9px] text-text-tertiary font-medium -mt-0.5">Admin Panel</p>
              </div>
            )}
          </Link>
          {/* Mobile close */}
          <button onClick={onMobileClose} className="ml-auto lg:hidden text-text-secondary hover:text-text-primary">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Nav items */}
        <nav className="flex-1 overflow-y-auto py-3 px-3 space-y-0.5 custom-scrollbar">
          {NAV_ITEMS.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onMobileClose}
                className={cn(
                  'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-150 group',
                  active
                    ? 'bg-brand-primary text-white shadow-md shadow-brand-primary/20'
                    : 'text-text-secondary hover:bg-bg-surface-alt hover:text-text-primary',
                  collapsed && 'justify-center px-0',
                )}
                title={collapsed ? item.label : undefined}
              >
                <item.icon className={cn('h-[18px] w-[18px] shrink-0', active ? 'text-white' : 'text-text-tertiary group-hover:text-text-primary')} />
                {!collapsed && <span className="whitespace-nowrap">{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* Collapse toggle (desktop only) */}
        <div className="hidden lg:flex items-center justify-center h-12 border-t border-border">
          <button
            onClick={onToggle}
            className="flex h-8 w-8 items-center justify-center rounded-full text-text-tertiary hover:text-text-primary hover:bg-bg-surface-alt transition-colors"
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
        </div>
      </aside>
    </>
  );
}
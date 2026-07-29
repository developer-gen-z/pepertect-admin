'use client';

import { useState, useEffect } from 'react';
import { useAuthStore, useAuthHydration } from '@/stores/useAuthStore';
import { useRouter } from 'next/navigation';
import { AdminSidebar } from '@/components/layout/AdminSidebar';
import { AdminHeader } from '@/components/layout/AdminHeader';
import UpstoxReconnectBanner from '@/components/UpstoxReconnectBanner';
import { cn } from '@/lib/utils';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore();
  const hydrated = useAuthHydration();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Only redirect after hydration is complete
  useEffect(() => {
    if (hydrated && !isAuthenticated) {
      router.replace('/login');
    }
  }, [isAuthenticated, router, hydrated]);

  // Show loading while hydrating or if not authenticated (after hydration)
  if (!hydrated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg-base">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-primary border-t-transparent" />
          <p className="text-xs text-text-secondary">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg-base">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg-base">
      <AdminSidebar
        collapsed={collapsed}
        onToggle={() => setCollapsed(!collapsed)}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />
      <div className={cn('transition-all duration-300', collapsed ? 'lg:pl-[72px]' : 'lg:pl-[250px]')}>
        <AdminHeader onMenuToggle={() => setMobileOpen(true)} />
        <main className="p-4 sm:p-6 max-w-7xl mx-auto">
          <UpstoxReconnectBanner />
          {children}
        </main>
      </div>
    </div>
  );
}

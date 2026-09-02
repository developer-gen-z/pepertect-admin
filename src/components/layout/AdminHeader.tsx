'use client';

import Link from 'next/link';
import { useTheme } from 'next-themes';
import { useAuthStore } from '@/stores/useAuthStore';
import { useRouter } from 'next/navigation';
import { Sun, Moon, Menu, LogOut, Bell } from 'lucide-react';
import { useMounted } from '@/hooks/use-mounted';

interface AdminHeaderProps {
  onMenuToggle: () => void;
}

export function AdminHeader({ onMenuToggle }: AdminHeaderProps) {
  const { theme, setTheme } = useTheme();
  const { admin, logout } = useAuthStore();
  const router = useRouter();

  // Mounted check — `theme` is undefined during SSR/first paint, which caused
  // the wrong icon to flash for dark-theme users before correcting.
  const mounted = useMounted();

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  return (
    <header className="sticky top-0 z-30 h-16 bg-bg-surface border-b border-border flex items-center justify-between px-4 sm:px-6">
      {/* Left */}
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuToggle}
          aria-label="Open navigation menu"
          className="flex h-9 w-9 items-center justify-center rounded-lg text-text-secondary hover:bg-bg-surface-alt hover:text-text-primary transition-colors lg:hidden"
        >
          <Menu className="h-5 w-5" />
        </button>
        <div className="hidden sm:block">
          <p className="text-sm font-medium text-text-primary">
            Welcome back, <span className="font-semibold">{admin?.email?.split('@')[0] || 'Admin'}</span>
          </p>
          <p className="text-[11px] text-text-tertiary">Manage your platform</p>
        </div>
      </div>

      {/* Right */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-border text-text-secondary hover:text-text-primary hover:bg-bg-surface-alt transition-colors"
        >
          {/* Render a neutral placeholder until mounted to avoid icon flash */}
          {mounted ? (theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />) : <Moon className="h-4 w-4 invisible" />}
        </button>
        {/* Bell links to activity logs; the fake always-on red dot is removed */}
        <Link
          href="/activity"
          aria-label="View recent activity and notifications"
          title="Recent activity"
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-border text-text-secondary hover:text-text-primary hover:bg-bg-surface-alt transition-colors relative"
        >
          <Bell className="h-4 w-4" />
        </Link>
        <div className="h-6 w-px bg-border mx-1" />
        <button
          onClick={handleLogout}
          className="flex items-center gap-1.5 h-9 px-3 rounded-lg text-text-secondary hover:text-loss-red hover:bg-tint-red transition-colors text-sm"
        >
          <LogOut className="h-4 w-4" />
          <span className="hidden sm:inline">Logout</span>
        </button>
      </div>
    </header>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { useAuthStore } from '@/stores/useAuthStore';
import { adminFetch } from '@/lib/admin-fetch';
import { cn } from '@/lib/utils';
import { Users, UserCheck, UserPlus, TrendingUp, Star, MessageSquare, LifeBuoy } from 'lucide-react';

interface StatsData {
  totalUsers: number;
  activeUsers: number;
  todaySignups: number;
}

export default function AnalyticsPage() {
  const { token } = useAuthStore();
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    adminFetch('/api/admin/stats')
      .then((data) => { if (data.success) setStats(data.data); })
      .catch((e) => { if (e?.message !== 'Session expired') console.error(e); })
      .finally(() => setLoading(false));
  }, [token]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-heading text-2xl font-bold text-text-primary">Analytics</h1>
        <p className="text-sm text-text-secondary mt-0.5">Platform insights and metrics</p>
      </div>

      {loading ? (
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-3">
          {[1,2,3].map(i => <div key={i} className="h-32 animate-pulse rounded-2xl bg-bg-surface" />)}
        </div>
      ) : stats && (
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-3">
          <AnalyticsCard icon={Users} label="Total Users" value={stats.totalUsers.toLocaleString('en-IN')} description="Registered accounts" color="text-brand-primary" tint="bg-tint-blue" />
          <AnalyticsCard icon={UserCheck} label="Active Users" value={stats.activeUsers.toLocaleString('en-IN')} description={stats.totalUsers ? `${((stats.activeUsers / stats.totalUsers) * 100).toFixed(1)}% of total users` : 'No users yet'} color="text-profit-green" tint="bg-tint-green" />
          <AnalyticsCard icon={UserPlus} label="Today Signups" value={stats.todaySignups.toLocaleString('en-IN')} description="New registrations today" color="text-accent-gold" tint="bg-tint-yellow" />
        </div>
      )}

      {/* Platform Info */}
      <div className="card-soft p-5">
        <h2 className="font-heading text-base font-semibold text-text-primary mb-4">Platform Status</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <PlatformCard icon={Star} label="Reviews" description="User reviews and ratings" href="/reviews" />
          <PlatformCard icon={MessageSquare} label="Support Tickets" description="User support requests" href="/tickets" />
          <PlatformCard icon={TrendingUp} label="Market Data" description="Live market feed" href="/market" />
          <PlatformCard icon={LifeBuoy} label="Activity Logs" description="System audit trail" href="/activity" />
        </div>
      </div>
    </div>
  );
}

function AnalyticsCard({ icon: Icon, label, value, description, color, tint }: {
  icon: React.ElementType; label: string; value: string; description: string; color: string; tint: string;
}) {
  return (
    <div className="card-soft p-5">
      <div className="flex items-start justify-between mb-3">
        <p className="text-xs font-medium text-text-secondary">{label}</p>
        <div className={cn('icon-tile', tint)}><Icon className={cn('h-[18px] w-[18px]', color)} /></div>
      </div>
      <p className={cn('font-heading text-2xl font-bold tabular-nums', color)}>{value}</p>
      <p className="text-[11px] text-text-tertiary mt-1">{description}</p>
    </div>
  );
}

function PlatformCard({ icon: Icon, label, description, href }: { icon: React.ElementType; label: string; description: string; href: string }) {
  return (
    <a href={href} className="rounded-xl bg-bg-surface-alt p-4 hover:bg-bg-surface transition-colors group block">
      <Icon className="h-5 w-5 text-text-secondary group-hover:text-brand-primary transition-colors mb-2" />
      <p className="text-sm font-medium text-text-primary">{label}</p>
      <p className="text-[11px] text-text-secondary mt-0.5">{description}</p>
    </a>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { useAuthStore } from '@/stores/useAuthStore';
import { adminFetch } from '@/lib/admin-fetch';
import { cn, timeAgo } from '@/lib/utils';
import {
  Users, UserCheck, UserPlus, Star,
  Loader2, ArrowUpRight, AlertCircle, MessageSquare, TrendingUp,
} from 'lucide-react';

interface StatsData {
  totalUsers: number;
  activeUsers: number;
  todaySignups: number;
  recentUsers: { id: string; name: string | null; email: string; tier: string; createdAt: string; isActive: boolean }[];
}

export default function DashboardPage() {
  const { token } = useAuthStore();
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    setError(null);
    adminFetch('/api/admin/stats')
      .then((data: any) => {
        if (data.success) {
          setStats(data.data);
        } else {
          setError(data.error || 'Failed to load stats');
        }
      })
      .catch((e) => {
        if (e?.message !== 'Session expired') {
          setError(e?.message || 'Network error');
        }
      })
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) return <LoadingSkeleton />;

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <AlertCircle className="h-10 w-10 text-loss-red" />
        <p className="text-sm font-medium text-text-primary">Failed to load dashboard</p>
        <p className="text-xs text-text-secondary max-w-md text-center">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-2 px-4 py-2 rounded-lg bg-brand-primary text-white text-xs font-semibold hover:bg-brand-primary-hover"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold text-text-primary">Dashboard</h1>
        <p className="text-sm text-text-secondary mt-1">Platform overview and key metrics</p>
      </div>

      {/* KPI Grid */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-3">
        <KPICard icon={Users} label="Total Users" value={stats?.totalUsers ?? 0} tint="bg-tint-blue" color="text-brand-primary" />
        <KPICard icon={UserCheck} label="Active Users" value={stats?.activeUsers ?? 0} tint="bg-tint-green" color="text-profit-green" />
        <KPICard icon={UserPlus} label="Today Signups" value={stats?.todaySignups ?? 0} tint="bg-tint-yellow" color="text-accent-gold" />
      </div>

      {/* Bottom Row */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Recent Users */}
        <div className="card-soft p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-heading text-base font-semibold text-text-primary">Recent Users</h2>
            <a href="/users" className="text-xs font-semibold text-brand-primary hover:underline inline-flex items-center gap-1">
              View All <ArrowUpRight className="h-3 w-3" />
            </a>
          </div>
          <div className="space-y-2.5">
            {stats?.recentUsers.map((u) => (
              <div key={u.id} className="flex items-center gap-3 py-2 border-b border-border last:border-0">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-tint-blue text-brand-primary text-xs font-bold uppercase shrink-0">
                  {(u.name || u.email)[0]}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-text-primary truncate">{u.name || u.email}</p>
                  <p className="text-[11px] text-text-secondary truncate">{u.email}</p>
                </div>
                <div className="text-right shrink-0">
                  <span className={cn(
                    'pill',
                    u.isActive ? 'bg-tint-green text-profit-green' : 'bg-bg-surface-alt text-text-secondary',
                  )}>
                    {u.isActive ? 'Active' : 'Inactive'}
                  </span>
                  <p className="text-[10px] text-text-tertiary mt-1">{timeAgo(u.createdAt)}</p>
                </div>
              </div>
            ))}
            {(!stats?.recentUsers.length) && <p className="text-sm text-text-secondary text-center py-4">No users yet</p>}
          </div>
        </div>

        {/* Quick Links */}
        <div className="card-soft p-5">
          <h2 className="font-heading text-base font-semibold text-text-primary mb-4">Quick Actions</h2>
          <div className="grid gap-3">
            <QuickLink icon={Users} label="Manage Users" href="/users" description="View and manage all registered users" />
            <QuickLink icon={Star} label="Reviews" href="/reviews" description="Moderate user reviews and ratings" />
            <QuickLink icon={MessageSquare} label="Support Tickets" href="/tickets" description="Handle user support requests" />
            <QuickLink icon={TrendingUp} label="Analytics" href="/analytics" description="Platform insights and metrics" />
          </div>
        </div>
      </div>
    </div>
  );
}

function KPICard({ icon: Icon, label, value, tint, color }: {
  icon: React.ElementType; label: string; value: number; tint: string; color: string;
}) {
  return (
    <div className="card-soft p-4">
      <div className="flex items-start justify-between">
        <p className="text-xs font-medium text-text-secondary">{label}</p>
        <div className={cn('icon-tile', tint)}>
          <Icon className={cn('h-[18px] w-[18px]', color)} />
        </div>
      </div>
      <p className="mt-3 font-heading text-2xl font-bold tabular-nums text-text-primary">
        {value.toLocaleString('en-IN')}
      </p>
    </div>
  );
}

function QuickLink({ icon: Icon, label, href, description }: { icon: React.ElementType; label: string; href: string; description: string }) {
  return (
    <a href={href} className="flex items-center gap-3 rounded-xl p-3 bg-bg-surface-alt hover:bg-bg-surface transition-colors group">
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-primary/10 group-hover:bg-brand-primary/20 shrink-0">
        <Icon className="h-4 w-4 text-brand-primary" />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-medium text-text-primary">{label}</p>
        <p className="text-[11px] text-text-secondary">{description}</p>
      </div>
    </a>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div>
        <div className="h-8 w-40 animate-pulse rounded-lg bg-bg-surface" />
        <div className="h-4 w-60 animate-pulse rounded-lg bg-bg-surface mt-2" />
      </div>
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-3">
        {[1,2,3].map(i => <div key={i} className="h-28 animate-pulse rounded-2xl bg-bg-surface" />)}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="h-72 animate-pulse rounded-2xl bg-bg-surface" />
        <div className="h-72 animate-pulse rounded-2xl bg-bg-surface" />
      </div>
    </div>
  );
}

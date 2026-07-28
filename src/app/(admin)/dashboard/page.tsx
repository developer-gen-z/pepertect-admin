'use client';

import { useEffect, useState } from 'react';
import { useAuthStore } from '@/stores/useAuthStore';
import { cn, formatINR, formatNumber, timeAgo } from '@/lib/utils';
import {
  Users, UserCheck, Crown, ShoppingCart, Gift, Briefcase,
  UserPlus, TrendingUp, TrendingDown, DollarSign, Activity,
  Loader2, ArrowUpRight,
} from 'lucide-react';

interface StatsData {
  totalUsers: number;
  activeUsers: number;
  premiumUsers: number;
  trialActive: number;
  totalTrades: number;
  openPositions: number;
  todaySignups: number;
  totalOrders: number;
  totalPnl: number;
  realizedPnl: number;
  tierDistribution: { free: number; premium: number };
  recentUsers: { id: string; name: string | null; email: string; tier: string; createdAt: string; isActive: boolean }[];
}

export default function DashboardPage() {
  const { token } = useAuthStore();
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    fetch('/api/admin/stats', { headers: { Authorization: `Bearer ${token}` } })
      .then(res => res.json())
      .then(data => { if (data.success) setStats(data.data); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) return <LoadingSkeleton />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold text-text-primary">Dashboard</h1>
        <p className="text-sm text-text-secondary mt-1">Platform overview and key metrics</p>
      </div>

      {/* KPI Grid */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <KPICard icon={Users} label="Total Users" value={stats?.totalUsers ?? 0} tint="bg-tint-blue" color="text-brand-primary" />
        <KPICard icon={UserCheck} label="Active Users" value={stats?.activeUsers ?? 0} tint="bg-tint-green" color="text-profit-green" />
        <KPICard icon={Crown} label="Premium" value={stats?.premiumUsers ?? 0} tint="bg-tint-purple" color="text-info-purple" />
        <KPICard icon={ShoppingCart} label="Total Orders" value={stats?.totalOrders ?? 0} tint="bg-tint-yellow" color="text-accent-gold" />
      </div>

      {/* Secondary Stats */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <StatCard icon={Gift} label="Trial Active" value={String(stats?.trialActive ?? 0)} sub="30-day free trials" />
        <StatCard icon={Briefcase} label="Open Positions" value={String(stats?.openPositions ?? 0)} sub="Across all users" />
        <StatCard icon={UserPlus} label="Today Signups" value={String(stats?.todaySignups ?? 0)} sub="New registrations" />
        <StatCard
          icon={stats && stats.totalPnl >= 0 ? TrendingUp : TrendingDown}
          label="Platform P&L"
          value={formatINR(Math.abs(stats?.totalPnl ?? 0))}
          sub={`Realized: ${formatINR(Math.abs(stats?.realizedPnl ?? 0))}`}
          color={stats && stats.totalPnl >= 0 ? 'text-profit-green' : 'text-loss-red'}
        />
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
                    u.tier === 'PREMIUM' ? 'bg-tint-purple text-info-purple' : 'bg-bg-surface-alt text-text-secondary',
                  )}>
                    {u.tier}
                  </span>
                  <p className="text-[10px] text-text-tertiary mt-1">{timeAgo(u.createdAt)}</p>
                </div>
              </div>
            ))}
            {(!stats?.recentUsers.length) && <p className="text-sm text-text-secondary text-center py-4">No users yet</p>}
          </div>
        </div>

        {/* Tier Distribution */}
        <div className="card-soft p-5">
          <h2 className="font-heading text-base font-semibold text-text-primary mb-4">Tier Distribution</h2>
          {stats && (
            <div className="space-y-4">
              <TierBar label="FREE" count={stats.tierDistribution.free} total={stats.totalUsers} color="bg-text-tertiary" />
              <TierBar label="PREMIUM" count={stats.tierDistribution.premium} total={stats.totalUsers} color="bg-info-purple" />
            </div>
          )}

          {/* Quick Stats */}
          <div className="mt-6 grid grid-cols-2 gap-3">
            <QuickStat label="Total Trades" value={String(stats?.totalTrades ?? 0)} icon={Activity} />
            <QuickStat label="Trades/User" value={stats?.totalUsers ? (stats.totalTrades / stats.totalUsers).toFixed(1) : '0'} icon={DollarSign} />
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

function StatCard({ icon: Icon, label, value, sub, color }: {
  icon: React.ElementType; label: string; value: string; sub?: string; color?: string;
}) {
  return (
    <div className="card-soft p-4">
      <div className="flex items-center gap-2 mb-2">
        <Icon className={cn('h-4 w-4', color || 'text-text-secondary')} />
        <p className="text-xs font-medium text-text-secondary">{label}</p>
      </div>
      <p className={cn('font-heading text-xl font-bold tabular-nums', color || 'text-text-primary')}>{value}</p>
      {sub && <p className="text-[11px] text-text-tertiary mt-0.5">{sub}</p>}
    </div>
  );
}

function TierBar({ label, count, total, color }: { label: string; count: number; total: number; color: string }) {
  const pct = total > 0 ? (count / total) * 100 : 0;
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-sm font-medium text-text-primary">{label}</span>
        <span className="text-sm font-semibold tabular-nums text-text-primary">{count.toLocaleString('en-IN')} <span className="text-text-tertiary font-normal">({pct.toFixed(1)}%)</span></span>
      </div>
      <div className="h-2 w-full rounded-full bg-bg-surface-alt overflow-hidden">
        <div className={cn('h-full rounded-full', color)} style={{ width: `${pct}%`, transition: 'width 0.6s ease' }} />
      </div>
    </div>
  );
}

function QuickStat({ label, value, icon: Icon }: { label: string; value: string; icon: React.ElementType }) {
  return (
    <div className="rounded-xl bg-bg-surface-alt p-3">
      <div className="flex items-center gap-2 mb-1">
        <Icon className="h-3.5 w-3.5 text-text-tertiary" />
        <span className="text-[11px] text-text-secondary">{label}</span>
      </div>
      <p className="font-heading text-lg font-bold tabular-nums text-text-primary">{value}</p>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div>
        <div className="h-8 w-40 animate-pulse rounded-lg bg-bg-surface" />
        <div className="h-4 w-60 animate-pulse rounded-lg bg-bg-surface mt-2" />
      </div>
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        {[1,2,3,4].map(i => <div key={i} className="h-28 animate-pulse rounded-2xl bg-bg-surface" />)}
      </div>
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        {[1,2,3,4].map(i => <div key={i} className="h-24 animate-pulse rounded-2xl bg-bg-surface" />)}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="h-72 animate-pulse rounded-2xl bg-bg-surface" />
        <div className="h-72 animate-pulse rounded-2xl bg-bg-surface" />
      </div>
    </div>
  );
}

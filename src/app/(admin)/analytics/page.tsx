'use client';

import { useEffect, useState } from 'react';
import { useAuthStore } from '@/stores/useAuthStore';
import { cn, formatINR } from '@/lib/utils';
import { BarChart3, Users, Crown, ShoppingCart, TrendingUp, TrendingDown, DollarSign, Loader2 } from 'lucide-react';

interface StatsData {
  totalUsers: number; activeUsers: number; premiumUsers: number; totalTrades: number;
  totalPnl: number; realizedPnl: number; trialActive: number; openPositions: number;
  tierDistribution: { free: number; premium: number };
}

export default function AnalyticsPage() {
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

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-heading text-2xl font-bold text-text-primary">Analytics</h1>
        <p className="text-sm text-text-secondary mt-0.5">Platform insights and metrics</p>
      </div>

      {loading ? (
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-3">
          {[1,2,3,4,5,6].map(i => <div key={i} className="h-32 animate-pulse rounded-2xl bg-bg-surface" />)}
        </div>
      ) : stats && (
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-3">
          <AnalyticsCard icon={Users} label="Total Users" value={stats.totalUsers.toLocaleString('en-IN')} description="Registered accounts" color="text-brand-primary" tint="bg-tint-blue" />
          <AnalyticsCard icon={Crown} label="Premium Users" value={stats.premiumUsers.toLocaleString('en-IN')} description={`${((stats.premiumUsers / Math.max(1, stats.totalUsers)) * 100).toFixed(1)}% conversion rate`} color="text-info-purple" tint="bg-tint-purple" />
          <AnalyticsCard icon={ShoppingCart} label="Total Trades" value={stats.totalTrades.toLocaleString('en-IN')} description={`${stats.totalUsers ? (stats.totalTrades / stats.totalUsers).toFixed(1) : 0} trades per user`} color="text-accent-gold" tint="bg-tint-yellow" />
          <AnalyticsCard
            icon={stats.totalPnl >= 0 ? TrendingUp : TrendingDown}
            label="Platform P&L"
            value={formatINR(Math.abs(stats.totalPnl))}
            description={stats.totalPnl >= 0 ? 'Net positive across all users' : 'Net loss across all users'}
            color={stats.totalPnl >= 0 ? 'text-profit-green' : 'text-loss-red'}
            tint={stats.totalPnl >= 0 ? 'bg-tint-green' : 'bg-tint-red'}
          />
          <AnalyticsCard icon={DollarSign} label="Realized P&L" value={formatINR(Math.abs(stats.realizedPnl))} description="From closed positions" color={stats.realizedPnl >= 0 ? 'text-profit-green' : 'text-loss-red'} tint={stats.realizedPnl >= 0 ? 'bg-tint-green' : 'bg-tint-red'} />
          <AnalyticsCard icon={BarChart3} label="Active Trials" value={String(stats.trialActive)} description="30-day free PREMIUM trials running" color="text-brand-primary" tint="bg-tint-blue" />
        </div>
      )}

      {/* Tier breakdown */}
      {stats && (
        <div className="card-soft p-5">
          <h2 className="font-heading text-base font-semibold text-text-primary mb-4">Tier Breakdown</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl bg-bg-surface-alt p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-text-secondary">FREE</span>
                <span className="text-sm font-bold text-text-primary">{stats.tierDistribution.free.toLocaleString('en-IN')}</span>
              </div>
              <div className="h-2 w-full rounded-full bg-bg-surface overflow-hidden">
                <div className="h-full rounded-full bg-text-tertiary transition-all" style={{ width: `${(stats.tierDistribution.free / Math.max(1, stats.totalUsers)) * 100}%` }} />
              </div>
              <p className="text-[11px] text-text-tertiary mt-1">{((stats.tierDistribution.free / Math.max(1, stats.totalUsers)) * 100).toFixed(1)}% of total</p>
            </div>
            <div className="rounded-xl bg-bg-surface-alt p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-text-secondary">PREMIUM</span>
                <span className="text-sm font-bold text-info-purple">{stats.tierDistribution.premium.toLocaleString('en-IN')}</span>
              </div>
              <div className="h-2 w-full rounded-full bg-bg-surface overflow-hidden">
                <div className="h-full rounded-full bg-info-purple transition-all" style={{ width: `${(stats.tierDistribution.premium / Math.max(1, stats.totalUsers)) * 100}%` }} />
              </div>
              <p className="text-[11px] text-text-tertiary mt-1">{((stats.tierDistribution.premium / Math.max(1, stats.totalUsers)) * 100).toFixed(1)}% of total</p>
            </div>
          </div>
        </div>
      )}
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

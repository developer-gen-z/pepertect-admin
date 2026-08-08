'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/useAuthStore';
import { adminFetch } from '@/lib/admin-fetch';
import { cn, formatINR, formatNumber, formatDateTime, timeAgo } from '@/lib/utils';
import {
  ArrowLeft, User, Mail, Phone, Shield, Crown, Wallet,
  ShoppingCart, Briefcase, TrendingUp, Calendar, Clock,
  Loader2, Save, CheckCircle2, AlertCircle, Activity as ActivityIcon,
  MessageSquare, CreditCard, Settings,
} from 'lucide-react';

interface UserDetails {
  id: string; name: string | null; email: string; phone: string | null;
  role: string; tier: string; virtualCapital: number; isActive: boolean;
  twoFactorEnabled: boolean; language: string; createdAt: string; updatedAt: string;
  notifSettings: unknown;
  portfolio: { id: string; totalBalance: number; investedAmount: number; availableMargin: number; totalPnl: number; realizedPnl: number; unrealizedPnl: number; winRate: number; totalTrades: number; winningTrades: number } | null;
  subscriptions: { id: string; plan: string; status: string; startDate: string; endDate: string | null; razorpaySubId: string | null }[];
  positions: { id: string; symbol: string; side: string; quantity: number; avgPrice: number; pnl: number; status: string; segment: string; openedAt: string }[];
  activityLogs: { id: string; action: string; ip: string | null; createdAt: string }[];
  supportTickets: { id: string; subject: string; status: string; priority: string; createdAt: string }[];
  _count: { orders: number; trades: number; watchlist: number; notifications: number };
}

export default function UserDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { token } = useAuthStore();
  const [user, setUser] = useState<UserDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [editTier, setEditTier] = useState('');
  const [editActive, setEditActive] = useState(true);

  useEffect(() => {
    if (!token || !params.id) return;
    adminFetch(`/api/admin/users/${params.id}`)
      .then((data) => {
        if (data.success) {
          setUser(data.data);
          setEditTier(data.data.tier);
          setEditActive(data.data.isActive);
        }
      })
      .catch((e) => { if (e?.message !== 'Session expired') console.error(e); })
      .finally(() => setLoading(false));
  }, [token, params.id]);

  const handleSave = async () => {
    if (!token || !params.id) return;
    setSaving(true); setMsg(null);
    try {
      const data = await adminFetch(`/api/admin/users/${params.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier: editTier, isActive: editActive }),
      });
      if (data.success) {
        setUser(prev => prev ? { ...prev, tier: editTier, isActive: editActive } : prev);
        setMsg({ type: 'success', text: 'User updated successfully' });
      } else {
        setMsg({ type: 'error', text: data.error || 'Update failed' });
      }
    } catch (e) { if (!(e instanceof Error && e.message === 'Session expired')) setMsg({ type: 'error', text: 'Network error' }); }
    finally { setSaving(false); }
  };

  if (loading) return <div className="space-y-4"><div className="h-12 w-60 animate-pulse rounded-xl bg-bg-surface" /><div className="h-64 animate-pulse rounded-xl bg-bg-surface" /></div>;
  if (!user) return <div className="py-12 text-center"><p className="text-text-secondary">User not found</p></div>;

  return (
    <div className="space-y-5">
      {/* Back */}
      <button onClick={() => router.back()} className="flex items-center gap-1.5 text-sm font-medium text-text-secondary hover:text-text-primary transition-colors">
        <ArrowLeft className="h-4 w-4" /> Back to Users
      </button>

      {/* Header */}
      <div className="card-soft p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-tint-blue text-brand-primary text-xl font-bold uppercase">
              {(user.name || user.email)[0]}
            </div>
            <div>
              <h1 className="font-heading text-xl font-bold text-text-primary">{user.name || 'No Name'}</h1>
              <div className="flex items-center gap-3 mt-1">
                <span className="flex items-center gap-1 text-xs text-text-secondary"><Mail className="h-3 w-3" />{user.email}</span>
                {user.phone && <span className="flex items-center gap-1 text-xs text-text-secondary"><Phone className="h-3 w-3" />{user.phone}</span>}
              </div>
              <div className="flex items-center gap-2 mt-2">
                <span className={cn('pill', user.tier === 'PREMIUM' ? 'bg-tint-purple text-info-purple' : 'bg-bg-surface-alt text-text-secondary')}>{user.tier}</span>
                <span className={cn('pill', user.isActive ? 'bg-tint-green text-profit-green' : 'bg-tint-red text-loss-red')}>{user.isActive ? 'Active' : 'Inactive'}</span>
                {user.twoFactorEnabled && <span className="pill bg-tint-blue text-brand-primary">2FA</span>}
              </div>
            </div>
          </div>
          <div className="text-right text-xs text-text-tertiary">
            <p>Joined {formatDateTime(user.createdAt)}</p>
            <p className="mt-0.5">Updated {timeAgo(user.updatedAt)}</p>
          </div>
        </div>
      </div>

      {/* Edit Controls */}
      <div className="card-soft p-5">
        <h2 className="font-heading text-base font-semibold text-text-primary mb-4 flex items-center gap-2"><Settings className="h-4 w-4" /> Admin Controls</h2>
        <div className="flex flex-col sm:flex-row gap-4 items-end">
          <div className="flex-1">
            <label className="text-xs font-medium text-text-secondary block mb-1.5">Tier</label>
            <select value={editTier} onChange={e => setEditTier(e.target.value)}
              className="w-full h-10 rounded-lg border border-border bg-bg-surface px-3 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/30">
              <option value="FREE">FREE</option>
              <option value="PREMIUM">PREMIUM</option>
            </select>
          </div>
          <div className="flex-1">
            <label className="text-xs font-medium text-text-secondary block mb-1.5">Account Status</label>
            <select value={String(editActive)} onChange={e => setEditActive(e.target.value === 'true')}
              className="w-full h-10 rounded-lg border border-border bg-bg-surface px-3 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/30">
              <option value="true">Active</option>
              <option value="false">Inactive (Banned)</option>
            </select>
          </div>
          <button onClick={handleSave} disabled={saving}
            className="h-10 px-5 rounded-lg bg-brand-primary text-white text-sm font-semibold hover:bg-brand-primary-hover transition-colors disabled:opacity-60 flex items-center gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save
          </button>
        </div>
        {msg && (
          <div className={cn('mt-3 flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium', msg.type === 'success' ? 'bg-tint-green text-profit-green' : 'bg-tint-red text-loss-red')}>
            {msg.type === 'success' ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
            {msg.text}
          </div>
        )}
      </div>

      {/* Stats Grid */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <MiniStat icon={Wallet} label="Virtual Capital" value={formatINR(Number(user.virtualCapital))} />
        <MiniStat icon={ShoppingCart} label="Total Orders" value={String(user._count.orders)} />
        <MiniStat icon={Briefcase} label="Trades" value={String(user._count.trades)} />
        <MiniStat icon={MessageSquare} label="Notifications" value={String(user._count.notifications)} />
      </div>

      {/* Portfolio */}
      {user.portfolio && (
        <div className="card-soft p-5">
          <h2 className="font-heading text-base font-semibold text-text-primary mb-4 flex items-center gap-2"><TrendingUp className="h-4 w-4" /> Portfolio</h2>
          <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
            <div><p className="text-xs text-text-secondary">Balance</p><p className="font-mono text-sm font-bold text-text-primary">{formatINR(user.portfolio.totalBalance)}</p></div>
            <div><p className="text-xs text-text-secondary">Invested</p><p className="font-mono text-sm font-bold text-text-primary">{formatINR(user.portfolio.investedAmount)}</p></div>
            <div><p className="text-xs text-text-secondary">P&L</p><p className={cn('font-mono text-sm font-bold', user.portfolio.totalPnl >= 0 ? 'text-profit-green' : 'text-loss-red')}>{formatINR(user.portfolio.totalPnl)}</p></div>
            <div><p className="text-xs text-text-secondary">Win Rate</p><p className="font-mono text-sm font-bold text-brand-primary">{user.portfolio.winRate}%</p></div>
          </div>
        </div>
      )}

      {/* Subscriptions */}
      <div className="card-soft p-5">
        <h2 className="font-heading text-base font-semibold text-text-primary mb-4 flex items-center gap-2"><CreditCard className="h-4 w-4" /> Subscriptions</h2>
        {user.subscriptions.length === 0 ? <p className="text-sm text-text-secondary">No subscriptions</p> : (
          <div className="space-y-2">
            {user.subscriptions.map(s => (
              <div key={s.id} className="flex items-center justify-between p-3 rounded-xl bg-bg-surface-alt">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm text-text-primary">{s.plan}</span>
                    <span className={cn('pill', s.status === 'ACTIVE' ? 'bg-tint-green text-profit-green' : 'bg-tint-red text-loss-red')}>{s.status}</span>
                    {s.razorpaySubId === 'TRIAL' && <span className="pill bg-tint-blue text-brand-primary">Trial</span>}
                  </div>
                  <p className="text-[11px] text-text-secondary mt-1">{formatDateTime(s.startDate)} — {s.endDate ? formatDateTime(s.endDate) : 'Ongoing'}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Activity */}
      <div className="card-soft p-5">
        <h2 className="font-heading text-base font-semibold text-text-primary mb-4 flex items-center gap-2"><ActivityIcon className="h-4 w-4" /> Recent Activity</h2>
        {user.activityLogs.length === 0 ? <p className="text-sm text-text-secondary">No activity logged</p> : (
          <div className="space-y-2 max-h-64 overflow-y-auto custom-scrollbar">
            {user.activityLogs.map(log => (
              <div key={log.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                <span className="text-sm text-text-primary">{log.action}</span>
                <div className="flex items-center gap-2 text-[11px] text-text-tertiary">
                  {log.ip && <span>{log.ip}</span>}
                  <span>{timeAgo(log.createdAt)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function MiniStat({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="card-soft p-3">
      <div className="flex items-center gap-2 mb-1">
        <Icon className="h-3.5 w-3.5 text-text-tertiary" />
        <span className="text-[11px] text-text-secondary">{label}</span>
      </div>
      <p className="font-heading text-base font-bold text-text-primary">{value}</p>
    </div>
  );
}

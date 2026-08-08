'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuthStore } from '@/stores/useAuthStore';
import { adminFetch } from '@/lib/admin-fetch';
import { cn, formatDateTime, timeAgo } from '@/lib/utils';
import { CreditCard, Loader2, ChevronLeft, ChevronRight, Search, Gift, Crown } from 'lucide-react';

interface SubRow {
  id: string; userId: string; plan: string; status: string; startDate: string;
  endDate: string | null; razorpaySubId: string | null; createdAt: string;
  user: { id: string; name: string | null; email: string; tier: string } | null;
  payments: { amount: number; status: string; createdAt: string }[];
}

export default function SubscriptionsPage() {
  const { token } = useAuthStore();
  const [subs, setSubs] = useState<SubRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [planFilter, setPlanFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [trialFilter, setTrialFilter] = useState('');

  const fetchSubs = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (planFilter) params.set('plan', planFilter);
      if (statusFilter) params.set('status', statusFilter);
      if (trialFilter) params.set('trial', trialFilter);
      const data = await adminFetch(`/api/admin/subscriptions?${params}`);
      if (data.success) { setSubs(data.data.subscriptions); setTotalPages(data.data.pages); }
    } catch (err) { if (!(err instanceof Error && err.message === 'Session expired')) console.error(err); }
    finally { setLoading(false); }
  }, [token, page, planFilter, statusFilter, trialFilter]);

  useEffect(() => { fetchSubs(); }, [fetchSubs]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-heading text-2xl font-bold text-text-primary">Subscriptions</h1>
        <p className="text-sm text-text-secondary mt-0.5">Manage user plans and trials</p>
      </div>

      {/* Filters */}
      <div className="card-soft p-4">
        <div className="flex flex-wrap gap-2">
          <div className="flex rounded-lg border border-border overflow-hidden">
            {['', 'FREE', 'PREMIUM'].map(p => (
              <button key={p} onClick={() => { setPlanFilter(p); setPage(1); }}
                className={cn('px-3 py-1.5 text-xs font-medium transition-colors', planFilter === p ? 'bg-brand-primary text-white' : 'bg-bg-surface text-text-secondary hover:bg-bg-surface-alt')}>
                {p || 'All Plans'}
              </button>
            ))}
          </div>
          <div className="flex rounded-lg border border-border overflow-hidden">
            {['', 'ACTIVE', 'EXPIRED', 'CANCELLED'].map(s => (
              <button key={s} onClick={() => { setStatusFilter(s); setPage(1); }}
                className={cn('px-3 py-1.5 text-xs font-medium transition-colors', statusFilter === s ? 'bg-brand-primary text-white' : 'bg-bg-surface text-text-secondary hover:bg-bg-surface-alt')}>
                {s || 'All Status'}
              </button>
            ))}
          </div>
          <div className="flex rounded-lg border border-border overflow-hidden">
            {['', 'true', 'false'].map((t, i) => (
              <button key={t} onClick={() => { setTrialFilter(t); setPage(1); }}
                className={cn('px-3 py-1.5 text-xs font-medium transition-colors', trialFilter === t ? 'bg-brand-primary text-white' : 'bg-bg-surface text-text-secondary hover:bg-bg-surface-alt')}>
                {['All', 'Trial Only', 'Paid Only'][i]}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="card-soft overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-4 py-3 text-xs font-semibold text-text-secondary">User</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-text-secondary">Plan</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-text-secondary">Status</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-text-secondary hidden sm:table-cell">Type</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-text-secondary hidden md:table-cell">Start</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-text-secondary hidden md:table-cell">End</th>
              </tr>
            </thead>
            <tbody>
              {loading ? Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="border-b border-border">{Array.from({ length: 6 }).map((_, j) => <td key={j} className="px-4 py-3"><div className="h-4 w-24 animate-pulse rounded bg-bg-surface-alt" /></td>)}</tr>
              )) : subs.map(s => (
                <tr key={s.id} className="border-b border-border hover:bg-bg-surface-alt transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-medium text-text-primary text-xs">{s.user?.name || '—'}</p>
                    <p className="text-[11px] text-text-secondary">{s.user?.email}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn('pill', s.plan === 'PREMIUM' ? 'bg-tint-purple text-info-purple' : 'bg-bg-surface-alt text-text-secondary')}>{s.plan}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn('pill', s.status === 'ACTIVE' ? 'bg-tint-green text-profit-green' : s.status === 'EXPIRED' ? 'bg-tint-red text-loss-red' : 'bg-tint-yellow text-warning-amber')}>{s.status}</span>
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    {s.razorpaySubId === 'TRIAL' ? <span className="pill bg-tint-blue text-brand-primary flex w-fit gap-1"><Gift className="h-3 w-3" />Trial</span> : <span className="text-xs text-text-secondary">Paid</span>}
                  </td>
                  <td className="px-4 py-3 text-xs text-text-secondary hidden md:table-cell">{formatDateTime(s.startDate)}</td>
                  <td className="px-4 py-3 text-xs text-text-secondary hidden md:table-cell">{s.endDate ? formatDateTime(s.endDate) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-border">
            <p className="text-xs text-text-secondary">Page {page} of {totalPages}</p>
            <div className="flex gap-1">
              <button disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))} className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-text-secondary hover:bg-bg-surface-alt disabled:opacity-40"><ChevronLeft className="h-4 w-4" /></button>
              <button disabled={page >= totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))} className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-text-secondary hover:bg-bg-surface-alt disabled:opacity-40"><ChevronRight className="h-4 w-4" /></button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

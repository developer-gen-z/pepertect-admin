'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuthStore } from '@/stores/useAuthStore';
import { cn, formatNumber, formatDateTime, timeAgo } from '@/lib/utils';
import { ShoppingCart, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';

interface OrderRow {
  id: string; userId: string; symbol: string; side: string; orderType: string;
  quantity: number; price: number | null; filledPrice: number | null; filledQty: number;
  status: string; segment: string; optionType: string | null; strikePrice: number | null;
  createdAt: string;
  user: { id: string; name: string | null; email: string } | null;
}

export default function OrdersPage() {
  const { token } = useAuthStore();
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [sideFilter, setSideFilter] = useState('');

  const fetchOrders = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (statusFilter) params.set('status', statusFilter);
      if (sideFilter) params.set('side', sideFilter);
      const res = await fetch(`/api/admin/orders?${params}`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (data.success) { setOrders(data.data.orders); setTotalPages(data.data.pages); }
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [token, page, statusFilter, sideFilter]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-heading text-2xl font-bold text-text-primary">Orders</h1>
        <p className="text-sm text-text-secondary mt-0.5">Monitor all trading orders</p>
      </div>

      <div className="card-soft p-4">
        <div className="flex flex-wrap gap-2">
          <div className="flex rounded-lg border border-border overflow-hidden">
            {['', 'PENDING', 'FILLED', 'CANCELLED', 'REJECTED'].map(s => (
              <button key={s} onClick={() => { setStatusFilter(s); setPage(1); }}
                className={cn('px-3 py-1.5 text-xs font-medium transition-colors', statusFilter === s ? 'bg-brand-primary text-white' : 'bg-bg-surface text-text-secondary hover:bg-bg-surface-alt')}>
                {s || 'All Status'}
              </button>
            ))}
          </div>
          <div className="flex rounded-lg border border-border overflow-hidden">
            {['', 'BUY', 'SELL'].map(s => (
              <button key={s} onClick={() => { setSideFilter(s); setPage(1); }}
                className={cn('px-3 py-1.5 text-xs font-medium transition-colors', sideFilter === s ? 'bg-brand-primary text-white' : 'bg-bg-surface text-text-secondary hover:bg-bg-surface-alt')}>
                {s || 'All Sides'}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="card-soft overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-4 py-3 text-xs font-semibold text-text-secondary">User</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-text-secondary">Symbol</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-text-secondary">Side</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-text-secondary hidden sm:table-cell">Type</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-text-secondary">Qty</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-text-secondary hidden sm:table-cell">Price</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-text-secondary">Status</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-text-secondary hidden md:table-cell">Time</th>
              </tr>
            </thead>
            <tbody>
              {loading ? Array.from({ length: 5 }).map((_, i) => <tr key={i} className="border-b border-border">{Array.from({ length: 8 }).map((_, j) => <td key={j} className="px-4 py-3"><div className="h-4 w-20 animate-pulse rounded bg-bg-surface-alt" /></td>)}</tr>) : orders.map(o => (
                <tr key={o.id} className="border-b border-border hover:bg-bg-surface-alt transition-colors">
                  <td className="px-4 py-3"><p className="text-xs text-text-primary">{o.user?.name || '—'}</p><p className="text-[11px] text-text-secondary">{o.user?.email}</p></td>
                  <td className="px-4 py-3 font-mono text-xs font-semibold text-text-primary">{o.symbol}</td>
                  <td className="px-4 py-3"><span className={cn('pill', o.side === 'BUY' ? 'bg-tint-green text-profit-green' : 'bg-tint-red text-loss-red')}>{o.side}</span></td>
                  <td className="px-4 py-3 text-xs text-text-secondary hidden sm:table-cell">{o.orderType}</td>
                  <td className="px-4 py-3 font-mono text-xs text-text-primary">{o.quantity}</td>
                  <td className="px-4 py-3 font-mono text-xs text-text-primary hidden sm:table-cell">₹{formatNumber(o.filledPrice ?? o.price ?? 0)}</td>
                  <td className="px-4 py-3"><span className={cn('pill', o.status === 'FILLED' ? 'bg-tint-green text-profit-green' : o.status === 'CANCELLED' ? 'bg-tint-red text-loss-red' : o.status === 'PENDING' ? 'bg-tint-yellow text-warning-amber' : 'bg-bg-surface-alt text-text-secondary')}>{o.status}</span></td>
                  <td className="px-4 py-3 text-[11px] text-text-secondary hidden md:table-cell">{timeAgo(o.createdAt)}</td>
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

'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuthStore } from '@/stores/useAuthStore';
import { cn, formatNumber, timeAgo } from '@/lib/utils';
import { Briefcase, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';

interface PosRow {
  id: string; userId: string; symbol: string; side: string; quantity: number;
  avgPrice: number; currentPrice: number; pnl: number; pnlPct: number;
  status: string; segment: string; openedAt: string;
  user: { id: string; name: string | null; email: string } | null;
}

export default function PositionsPage() {
  const { token } = useAuthStore();
  const [positions, setPositions] = useState<PosRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState('OPEN');

  const fetchPositions = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20', status: statusFilter });
      const res = await fetch(`/api/admin/positions?${params}`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (data.success) { setPositions(data.data.positions); setTotalPages(data.data.pages); }
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [token, page, statusFilter]);

  useEffect(() => { fetchPositions(); }, [fetchPositions]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-heading text-2xl font-bold text-text-primary">Positions</h1>
        <p className="text-sm text-text-secondary mt-0.5">Monitor open and closed positions</p>
      </div>

      <div className="card-soft p-4">
        <div className="flex gap-2">
          {['OPEN', 'CLOSED', 'SQUAREDOFF'].map(s => (
            <button key={s} onClick={() => { setStatusFilter(s); setPage(1); }}
              className={cn('px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors', statusFilter === s ? 'bg-brand-primary text-white border-brand-primary' : 'bg-bg-surface text-text-secondary border-border hover:bg-bg-surface-alt')}>
              {s}
            </button>
          ))}
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
                <th className="text-left px-4 py-3 text-xs font-semibold text-text-secondary hidden sm:table-cell">Qty</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-text-secondary hidden sm:table-cell">Avg Price</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-text-secondary">P&L</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-text-secondary">Status</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-text-secondary hidden md:table-cell">Opened</th>
              </tr>
            </thead>
            <tbody>
              {loading ? Array.from({ length: 5 }).map((_, i) => <tr key={i} className="border-b border-border">{Array.from({ length: 8 }).map((_, j) => <td key={j} className="px-4 py-3"><div className="h-4 w-20 animate-pulse rounded bg-bg-surface-alt" /></td>)}</tr>) : positions.map(p => (
                <tr key={p.id} className="border-b border-border hover:bg-bg-surface-alt transition-colors">
                  <td className="px-4 py-3"><p className="text-xs text-text-primary">{p.user?.name || '—'}</p><p className="text-[11px] text-text-secondary">{p.user?.email}</p></td>
                  <td className="px-4 py-3 font-mono text-xs font-semibold text-text-primary">{p.symbol}</td>
                  <td className="px-4 py-3"><span className={cn('pill', p.side === 'LONG' ? 'bg-tint-green text-profit-green' : 'bg-tint-red text-loss-red')}>{p.side}</span></td>
                  <td className="px-4 py-3 font-mono text-xs text-text-primary hidden sm:table-cell">{p.quantity}</td>
                  <td className="px-4 py-3 font-mono text-xs text-text-primary hidden sm:table-cell">₹{formatNumber(p.avgPrice)}</td>
                  <td className={cn('px-4 py-3 font-mono text-xs font-semibold', p.pnl >= 0 ? 'text-profit-green' : 'text-loss-red')}>
                    {p.pnl >= 0 ? '+' : ''}₹{formatNumber(p.pnl)}
                  </td>
                  <td className="px-4 py-3"><span className={cn('pill', p.status === 'OPEN' ? 'bg-tint-green text-profit-green' : 'bg-bg-surface-alt text-text-secondary')}>{p.status}</span></td>
                  <td className="px-4 py-3 text-[11px] text-text-secondary hidden md:table-cell">{timeAgo(p.openedAt)}</td>
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

'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuthStore } from '@/stores/useAuthStore';
import { cn, formatNumber, timeAgo } from '@/lib/utils';
import { TrendingUp, Loader2, ChevronLeft, ChevronRight, Database } from 'lucide-react';

interface FutureRow {
  id: string;
  stockId: string;
  symbol: string;
  expiry: string;
  lotSize: number;
  lastPrice: number;
  change: number;
  changePct: number;
  volume: number;
  oi: number;
  marginPct: number;
  updatedAt: string;
  stock: { symbol: string; name: string; exchange: string; sector: string | null } | null;
}

export default function FuturesPage() {
  const { token } = useAuthStore();
  const [futures, setFutures] = useState<FutureRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const fetchFutures = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '50' });
      const res = await fetch(`/api/admin/futures?${params}`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (data.success) {
        setFutures(data.data.futures);
        setTotal(data.data.total);
        setTotalPages(data.data.pages);
      }
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [token, page]);

  useEffect(() => { fetchFutures(); }, [fetchFutures]);

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-bold text-text-primary">Futures</h1>
          <p className="text-sm text-text-secondary mt-0.5">View all futures contracts in database</p>
        </div>
        {total > 0 && (
          <div className="flex items-center gap-2 pill bg-tint-blue text-brand-primary">
            <Database className="h-3.5 w-3.5" />
            <span className="text-xs font-semibold">{total} contracts</span>
          </div>
        )}
      </div>

      <div className="card-soft overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-4 py-3 text-xs font-semibold text-text-secondary">Stock</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-text-secondary">Symbol</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-text-secondary hidden sm:table-cell">Expiry</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-text-secondary hidden md:table-cell">Lot Size</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-text-secondary">Last Price</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-text-secondary">Change</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-text-secondary hidden sm:table-cell">Volume</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-text-secondary hidden md:table-cell">OI</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-text-secondary hidden lg:table-cell">Margin</th>
              </tr>
            </thead>
            <tbody>
              {loading ? Array.from({ length: 8 }).map((_, i) => (
                <tr key={i} className="border-b border-border">
                  {Array.from({ length: 9 }).map((_, j) => (
                    <td key={j} className="px-4 py-3"><div className="h-4 w-20 animate-pulse rounded bg-bg-surface-alt" /></td>
                  ))}
                </tr>
              )) : futures.map((f) => (
                <tr key={f.id} className="border-b border-border hover:bg-bg-surface-alt transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-tint-blue text-brand-primary text-[10px] font-bold uppercase shrink-0">
                        {(f.stock?.symbol || f.symbol)[0]}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-text-primary truncate">{f.stock?.name || '—'}</p>
                        <p className="text-[10px] text-text-tertiary truncate">{f.stock?.sector || f.stock?.exchange}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs font-semibold text-text-primary">{f.symbol}</td>
                  <td className="px-4 py-3 text-xs text-text-secondary hidden sm:table-cell">
                    {new Date(f.expiry).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-text-primary hidden md:table-cell">{f.lotSize}</td>
                  <td className="px-4 py-3 font-mono text-xs text-text-primary text-right">₹{formatNumber(f.lastPrice)}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex flex-col items-end">
                      <span className={cn('font-mono text-xs font-semibold', f.changePct >= 0 ? 'text-profit-green' : 'text-loss-red')}>
                        {f.changePct >= 0 ? '+' : ''}{f.changePct.toFixed(2)}%
                      </span>
                      <span className={cn('font-mono text-[10px]', f.change >= 0 ? 'text-profit-green' : 'text-loss-red')}>
                        {f.change >= 0 ? '+' : ''}₹{formatNumber(f.change)}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-text-primary text-right hidden sm:table-cell">{formatNumber(f.volume)}</td>
                  <td className="px-4 py-3 font-mono text-xs text-text-primary text-right hidden md:table-cell">{formatNumber(f.oi)}</td>
                  <td className="px-4 py-3 text-xs text-text-secondary hidden lg:table-cell">{f.marginPct}%</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!loading && futures.length === 0 && (
            <div className="py-12 text-center">
              <TrendingUp className="h-10 w-10 text-text-tertiary mx-auto mb-3" />
              <p className="text-sm font-medium text-text-primary">No futures data</p>
              <p className="text-xs text-text-secondary mt-1">Futures contracts will appear here when users trade</p>
            </div>
          )}
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-border">
            <p className="text-xs text-text-secondary">Page {page} of {totalPages}</p>
            <div className="flex gap-1">
              <button disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))} className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-text-secondary hover:bg-bg-surface-alt disabled:opacity-40 disabled:pointer-events-none"><ChevronLeft className="h-4 w-4" /></button>
              <button disabled={page >= totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))} className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-text-secondary hover:bg-bg-surface-alt disabled:opacity-40 disabled:pointer-events-none"><ChevronRight className="h-4 w-4" /></button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

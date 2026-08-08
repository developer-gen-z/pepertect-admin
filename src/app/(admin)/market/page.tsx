'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuthStore } from '@/stores/useAuthStore';
import { adminFetch } from '@/lib/admin-fetch';
import { cn, formatNumber } from '@/lib/utils';
import { TrendingUp, Loader2, Search, ChevronLeft, ChevronRight } from 'lucide-react';

interface StockRow {
  id: string; symbol: string; name: string; exchange: string; segment: string;
  sector: string | null; lotSize: number; ltp: number | null; change: number | null;
  changePct: number | null; volume: number | null; updatedAt: string;
}

interface IndexRow {
  id: string; name: string; symbol: string; exchange: string;
  lastPrice: number | null; change: number | null; changePct: number | null;
  updatedAt: string;
}

export default function MarketPage() {
  const { token } = useAuthStore();
  const [items, setItems] = useState<(StockRow | IndexRow)[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<'stocks' | 'indices'>('stocks');

  const fetchMarket = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ type: tab, page: String(page), limit: '20' });
      if (search) params.set('search', search);
      const data = await adminFetch(`/api/admin/market?${params}`);
      if (data.success) { setItems(data.data.items); setTotalPages(data.data.pages); }
    } catch (err) { if (!(err instanceof Error && err.message === 'Session expired')) console.error(err); }
    finally { setLoading(false); }
  }, [token, page, search, tab]);

  useEffect(() => { fetchMarket(); }, [fetchMarket]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-heading text-2xl font-bold text-text-primary">Market Data</h1>
        <p className="text-sm text-text-secondary mt-0.5">View stocks and indices</p>
      </div>

      <div className="card-soft p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex gap-1">
            {(['stocks', 'indices'] as const).map(t => (
              <button key={t} onClick={() => { setTab(t); setPage(1); }}
                className={cn('px-4 py-2 rounded-lg text-sm font-medium transition-colors capitalize', tab === t ? 'bg-brand-primary text-white' : 'bg-bg-surface text-text-secondary hover:bg-bg-surface-alt')}>
                {t}
              </button>
            ))}
          </div>
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-tertiary" />
            <input type="text" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder={`Search ${tab}...`}
              className="w-full h-10 rounded-lg border border-border bg-bg-surface pl-10 pr-3 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-brand-primary/30" />
          </div>
        </div>
      </div>

      <div className="card-soft overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-4 py-3 text-xs font-semibold text-text-secondary">Symbol</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-text-secondary">Name</th>
                {tab === 'stocks' && <th className="text-left px-4 py-3 text-xs font-semibold text-text-secondary hidden sm:table-cell">Exchange</th>}
                {tab === 'stocks' && <th className="text-left px-4 py-3 text-xs font-semibold text-text-secondary hidden md:table-cell">Segment</th>}
                <th className="text-right px-4 py-3 text-xs font-semibold text-text-secondary">LTP</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-text-secondary">Change</th>
              </tr>
            </thead>
            <tbody>
              {loading ? Array.from({ length: 5 }).map((_, i) => <tr key={i} className="border-b border-border">{Array.from({ length: 6 }).map((_, j) => <td key={j} className="px-4 py-3"><div className="h-4 w-24 animate-pulse rounded bg-bg-surface-alt" /></td>)}</tr>) : items.map(item => {
                const change = (item as StockRow).change ?? (item as IndexRow).change ?? 0;
                const changePct = (item as StockRow).changePct ?? (item as IndexRow).changePct ?? 0;
                const positive = change >= 0;
                return (
                  <tr key={item.id} className="border-b border-border hover:bg-bg-surface-alt transition-colors">
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-text-primary">{item.symbol}</td>
                    <td className="px-4 py-3 text-xs text-text-primary">{item.name}</td>
                    {tab === 'stocks' && <td className="px-4 py-3 text-xs text-text-secondary hidden sm:table-cell">{(item as StockRow).exchange}</td>}
                    {tab === 'stocks' && <td className="px-4 py-3 text-xs text-text-secondary hidden md:table-cell">{(item as StockRow).segment}</td>}
                    <td className="px-4 py-3 font-mono text-xs text-right text-text-primary">{formatNumber((item as StockRow).ltp ?? (item as IndexRow).lastPrice ?? 0)}</td>
                    <td className={cn('px-4 py-3 font-mono text-xs text-right', positive ? 'text-profit-green' : 'text-loss-red')}>
                      {positive ? '+' : ''}{formatNumber(change)} ({positive ? '+' : ''}{changePct.toFixed(2)}%)
                    </td>
                  </tr>
                );
              })}
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

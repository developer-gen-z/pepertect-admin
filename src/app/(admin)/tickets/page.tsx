'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useAuthStore } from '@/stores/useAuthStore';
import { adminFetch } from '@/lib/admin-fetch';
import { cn, timeAgo } from '@/lib/utils';
import { LifeBuoy, Loader2, ChevronLeft, ChevronRight, MessageSquare, Clock, AlertTriangle } from 'lucide-react';

interface TicketRow {
  id: string; userId: string; subject: string; status: string; priority: string;
  createdAt: string; updatedAt: string;
  user: { id: string; name: string | null; email: string } | null;
  _count: { messages: number };
}

export default function TicketsPage() {
  const { token } = useAuthStore();
  const [tickets, setTickets] = useState<TicketRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');

  const fetchTickets = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (statusFilter) params.set('status', statusFilter);
      if (priorityFilter) params.set('priority', priorityFilter);
      const data = await adminFetch(`/api/admin/tickets?${params}`);
      if (data.success) { setTickets(data.data.tickets); setTotalPages(data.data.pages); }
    } catch (err) { if (!(err instanceof Error && err.message === 'Session expired')) console.error(err); }
    finally { setLoading(false); }
  }, [token, page, statusFilter, priorityFilter]);

  useEffect(() => { fetchTickets(); }, [fetchTickets]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-heading text-2xl font-bold text-text-primary">Support Tickets</h1>
        <p className="text-sm text-text-secondary mt-0.5">Manage user support requests</p>
      </div>

      <div className="card-soft p-4">
        <div className="flex flex-wrap gap-2">
          <div className="flex rounded-lg border border-border overflow-hidden">
            {['', 'OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'].map(s => (
              <button key={s} onClick={() => { setStatusFilter(s); setPage(1); }}
                className={cn('px-3 py-1.5 text-xs font-medium transition-colors', statusFilter === s ? 'bg-brand-primary text-white' : 'bg-bg-surface text-text-secondary hover:bg-bg-surface-alt')}>
                {s || 'All Status'}
              </button>
            ))}
          </div>
          <div className="flex rounded-lg border border-border overflow-hidden">
            {['', 'LOW', 'NORMAL', 'HIGH', 'URGENT'].map(p => (
              <button key={p} onClick={() => { setPriorityFilter(p); setPage(1); }}
                className={cn('px-3 py-1.5 text-xs font-medium transition-colors', priorityFilter === p ? 'bg-brand-primary text-white' : 'bg-bg-surface text-text-secondary hover:bg-bg-surface-alt')}>
                {p || 'All Priority'}
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
                <th className="text-left px-4 py-3 text-xs font-semibold text-text-secondary">Subject</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-text-secondary">User</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-text-secondary">Status</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-text-secondary hidden sm:table-cell">Priority</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-text-secondary hidden sm:table-cell">Messages</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-text-secondary">Created</th>
              </tr>
            </thead>
            <tbody>
              {loading ? Array.from({ length: 5 }).map((_, i) => <tr key={i} className="border-b border-border">{Array.from({ length: 6 }).map((_, j) => <td key={j} className="px-4 py-3"><div className="h-4 w-28 animate-pulse rounded bg-bg-surface-alt" /></td>)}</tr>) : tickets.map(t => (
                <tr key={t.id} className="border-b border-border hover:bg-bg-surface-alt transition-colors">
                  <td className="px-4 py-3">
                    <Link href={`/tickets/${t.id}`} className="font-medium text-sm text-brand-primary hover:underline">{t.subject}</Link>
                  </td>
                  <td className="px-4 py-3"><p className="text-xs text-text-primary">{t.user?.name || '—'}</p><p className="text-[11px] text-text-secondary">{t.user?.email}</p></td>
                  <td className="px-4 py-3"><span className={cn('pill', t.status === 'OPEN' ? 'bg-tint-red text-loss-red' : t.status === 'IN_PROGRESS' ? 'bg-tint-yellow text-warning-amber' : t.status === 'RESOLVED' ? 'bg-tint-green text-profit-green' : 'bg-bg-surface-alt text-text-secondary')}>{t.status}</span></td>
                  <td className="px-4 py-3 hidden sm:table-cell"><span className={cn('pill', t.priority === 'URGENT' ? 'bg-tint-red text-loss-red' : t.priority === 'HIGH' ? 'bg-tint-orange text-accent-gold' : 'bg-bg-surface-alt text-text-secondary')}>{t.priority}</span></td>
                  <td className="px-4 py-3 hidden sm:table-cell"><span className="flex items-center gap-1 text-xs text-text-secondary"><MessageSquare className="h-3 w-3" />{t._count.messages}</span></td>
                  <td className="px-4 py-3 text-[11px] text-text-secondary">{timeAgo(t.createdAt)}</td>
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

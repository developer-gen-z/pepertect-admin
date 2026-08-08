'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuthStore } from '@/stores/useAuthStore';
import { adminFetch } from '@/lib/admin-fetch';
import { Activity, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';

interface LogRow {
  id: string; userId: string; action: string; details: string | null;
  ip: string | null; userAgent: string | null; createdAt: string;
  user: { id: string; name: string | null; email: string } | null;
}

export default function ActivityPage() {
  const { token } = useAuthStore();
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchLogs = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const data = await adminFetch(`/api/admin/activity?page=${page}&limit=30`);
      if (data.success) { setLogs(data.data.logs); setTotalPages(data.data.pages); }
    } catch (err) { if (!(err instanceof Error && err.message === 'Session expired')) console.error(err); }
    finally { setLoading(false); }
  }, [token, page]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-heading text-2xl font-bold text-text-primary">Activity Logs</h1>
        <p className="text-sm text-text-secondary mt-0.5">Platform-wide user activity</p>
      </div>

      <div className="card-soft overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-4 py-3 text-xs font-semibold text-text-secondary">User</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-text-secondary">Action</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-text-secondary hidden sm:table-cell">IP</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-text-secondary">Time</th>
              </tr>
            </thead>
            <tbody>
              {loading ? Array.from({ length: 10 }).map((_, i) => <tr key={i} className="border-b border-border">{Array.from({ length: 4 }).map((_, j) => <td key={j} className="px-4 py-3"><div className="h-4 w-28 animate-pulse rounded bg-bg-surface-alt" /></td>)}</tr>) : logs.map(l => (
                <tr key={l.id} className="border-b border-border hover:bg-bg-surface-alt transition-colors">
                  <td className="px-4 py-3"><p className="text-xs text-text-primary">{l.user?.name || '—'}</p><p className="text-[11px] text-text-secondary">{l.user?.email}</p></td>
                  <td className="px-4 py-3"><span className="pill bg-bg-surface-alt text-text-secondary">{l.action}</span></td>
                  <td className="px-4 py-3 font-mono text-[11px] text-text-tertiary hidden sm:table-cell">{l.ip || '—'}</td>
                  <td className="px-4 py-3 text-[11px] text-text-secondary">{new Date(l.createdAt).toLocaleString('en-IN')}</td>
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

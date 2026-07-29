'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useAuthStore } from '@/stores/useAuthStore';
import { cn, timeAgo } from '@/lib/utils';
import { Search, Users as UsersIcon, Loader2, ChevronLeft, ChevronRight, Trash2, AlertTriangle, CheckSquare, Square } from 'lucide-react';

interface UserRow {
  id: string; name: string | null; email: string; phone: string | null;
  role: string; tier: string; virtualCapital: number; isActive: boolean;
  twoFactorEnabled: boolean; createdAt: string; updatedAt: string;
  _count: { orders: number; positions: number; trades: number; supportTickets: number };
}

export default function UsersPage() {
  const { token } = useAuthStore();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [tierFilter, setTierFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Selection & delete state
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const fetchUsers = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (search) params.set('search', search);
      if (tierFilter) params.set('tier', tierFilter);
      if (statusFilter) params.set('isActive', statusFilter);
      const res = await fetch(`/api/admin/users?${params}`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (data.success) {
        setUsers(data.data.users);
        setTotalPages(data.data.pages);
      }
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [token, page, search, tierFilter, statusFilter]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === users.length && users.length > 0) {
      setSelected(new Set());
    } else {
      setSelected(new Set(users.map(u => u.id)));
    }
  };

  const handleDelete = async () => {
    if (selected.size === 0) return;
    setDeleting(true);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ids: Array.from(selected) }),
      });
      const data = await res.json();
      if (data.success) {
        setSelected(new Set());
        setShowConfirm(false);
        fetchUsers();
      }
    } catch (err) { console.error(err); }
    finally { setDeleting(false); }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-bold text-text-primary">Users</h1>
          <p className="text-sm text-text-secondary mt-0.5">Manage platform users</p>
        </div>
        {selected.size > 0 && (
          <div className="flex items-center gap-3">
            <span className="text-xs font-medium text-text-secondary">{selected.size} selected</span>
            <button
              onClick={() => setShowConfirm(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-loss-red/10 border border-loss-red/20 text-loss-red text-xs font-semibold hover:bg-loss-red/20 transition-colors"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete {selected.size > 1 ? `(${selected.size})` : ''}
            </button>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="card-soft p-6 max-w-sm w-full border border-loss-red/20">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-loss-red/10">
                <AlertTriangle className="h-5 w-5 text-loss-red" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-text-primary">Delete Users</h3>
                <p className="text-xs text-text-secondary mt-0.5">This action cannot be undone</p>
              </div>
            </div>
            <p className="text-sm text-text-secondary mb-5">
              Are you sure you want to delete <strong className="text-text-primary">{selected.size} user(s)</strong>?
              All their orders, positions, trades, and related data will be permanently removed from the database.
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowConfirm(false)}
                disabled={deleting}
                className="px-4 py-2 rounded-lg border border-border text-sm font-medium text-text-secondary hover:bg-bg-surface-alt transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-loss-red text-white text-sm font-semibold hover:bg-loss-red/90 transition-colors disabled:opacity-60"
              >
                {deleting && <Loader2 className="h-4 w-4 animate-spin" />}
                {deleting ? 'Deleting...' : 'Delete Forever'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Search & Filters */}
      <div className="card-soft p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-tertiary" />
            <input
              type="text" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search by name or email..."
              className="w-full h-10 rounded-lg border border-border bg-bg-surface pl-10 pr-3 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary transition-all"
            />
          </div>
          <div className="flex gap-2">
            <div className="flex rounded-lg border border-border overflow-hidden">
              {['', 'FREE', 'PREMIUM'].map((t) => (
                <button key={t} onClick={() => { setTierFilter(t); setPage(1); }}
                  className={cn('px-3 py-1.5 text-xs font-medium transition-colors', tierFilter === t ? 'bg-brand-primary text-white' : 'bg-bg-surface text-text-secondary hover:bg-bg-surface-alt')}>
                  {t || 'All'}
                </button>
              ))}
            </div>
            <div className="flex rounded-lg border border-border overflow-hidden">
              {['', 'true', 'false'].map((s, i) => (
                <button key={s} onClick={() => { setStatusFilter(s); setPage(1); }}
                  className={cn('px-3 py-1.5 text-xs font-medium transition-colors', statusFilter === s ? 'bg-brand-primary text-white' : 'bg-bg-surface text-text-secondary hover:bg-bg-surface-alt')}>
                  {['All', 'Active', 'Inactive'][i]}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="card-soft overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="px-4 py-3 w-10">
                  <button onClick={toggleAll} className="flex items-center justify-center">
                    {selected.size === users.length && users.length > 0
                      ? <CheckSquare className="h-4 w-4 text-brand-primary" />
                      : <Square className="h-4 w-4 text-text-tertiary hover:text-text-secondary" />}
                  </button>
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-text-secondary">User</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-text-secondary">Tier</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-text-secondary hidden sm:table-cell">Trades</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-text-secondary hidden md:table-cell">Joined</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-text-secondary">Status</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-text-secondary">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="border-b border-border">
                  {Array.from({ length: 7 }).map((_, j) => (
                    <td key={j} className="px-4 py-3"><div className="h-4 w-24 animate-pulse rounded bg-bg-surface-alt" /></td>
                  ))}
                </tr>
              )) : users.map((u) => (
                <tr key={u.id} className={cn('border-b border-border hover:bg-bg-surface-alt transition-colors', selected.has(u.id) && 'bg-brand-primary/5')}>
                  <td className="px-4 py-3">
                    <button onClick={() => toggleSelect(u.id)} className="flex items-center justify-center">
                      {selected.has(u.id)
                        ? <CheckSquare className="h-4 w-4 text-brand-primary" />
                        : <Square className="h-4 w-4 text-text-tertiary hover:text-text-secondary" />}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/users/${u.id}`} className="flex items-center gap-2.5 group">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-tint-blue text-brand-primary text-[11px] font-bold uppercase shrink-0">
                        {(u.name || u.email)[0]}
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-text-primary truncate group-hover:text-brand-primary transition-colors">{u.name || '—'}</p>
                        <p className="text-[11px] text-text-secondary truncate">{u.email}</p>
                      </div>
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn('pill', u.tier === 'PREMIUM' ? 'bg-tint-purple text-info-purple' : 'bg-bg-surface-alt text-text-secondary')}>
                      {u.tier}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs tabular-nums text-text-primary hidden sm:table-cell">{u._count.trades}</td>
                  <td className="px-4 py-3 text-xs text-text-secondary hidden md:table-cell">{timeAgo(u.createdAt)}</td>
                  <td className="px-4 py-3">
                    <span className={cn('pill', u.isActive ? 'bg-tint-green text-profit-green' : 'bg-tint-red text-loss-red')}>
                      {u.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right space-x-2">
                    <Link href={`/users/${u.id}`} className="text-xs font-semibold text-brand-primary hover:underline">View</Link>
                    <button
                      onClick={() => { setSelected(new Set([u.id])); setShowConfirm(true); }}
                      className="text-xs font-semibold text-loss-red hover:underline"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!loading && users.length === 0 && (
            <div className="py-12 text-center">
              <UsersIcon className="h-10 w-10 text-text-tertiary mx-auto mb-3" />
              <p className="text-sm font-medium text-text-primary">No users found</p>
              <p className="text-xs text-text-secondary mt-1">Try adjusting your search or filters</p>
            </div>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-border">
            <p className="text-xs text-text-secondary">Page {page} of {totalPages}</p>
            <div className="flex gap-1">
              <button disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-text-secondary hover:bg-bg-surface-alt disabled:opacity-40 disabled:pointer-events-none">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button disabled={page >= totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-text-secondary hover:bg-bg-surface-alt disabled:opacity-40 disabled:pointer-events-none">
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

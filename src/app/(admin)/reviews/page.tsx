'use client';

import { useState, useEffect, useCallback } from 'react';
import { adminFetch } from '@/lib/admin-fetch';
import { cn } from '@/lib/utils';
import {
  Star, ThumbsUp, MessageSquare, Search, ChevronLeft, ChevronRight,
  AlertTriangle, Loader2, CheckCircle2, XCircle, Eye, X, Send, Shield,
  Image as ImageIcon, Bug, Lightbulb, Clock, Flag, BarChart3, Settings, Trash2, Pencil
} from 'lucide-react';

// ── Types ──
interface AdminReview {
  id: string; title: string; content: string; rating: number;
  category: string; status: string; priority: string; helpfulCount: number;
  screenshotUrl: string | null; bugStatus: string | null; featureStatus: string | null;
  bugSteps: string | null; bugExpected: string | null; bugActual: string | null;
  whyNeeded: string | null; additionalDetails: string | null;
  device: string | null; browser: string | null; os: string | null; screenSize: string | null; ip: string | null;
  createdAt: string; updatedAt: string;
  user: { id: string; name: string | null; email: string; avatar: string | null };
  replies: { id: string; content: string; createdAt: string }[];
  _count: { votes: number };
}

interface Analytics {
  total: number; pending: number; approved: number; rejected: number;
  averageRating: number; ratingDistribution: Record<number, number>;
  categoryBreakdown: { category: string; count: number }[];
  statusBreakdown: { status: string; count: number }[];
  priorityBreakdown: { priority: string; count: number }[];
  recent7Days: number;
}

// ── Status/Category badge colors ──
const STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-tint-orange text-accent-gold',
  APPROVED: 'bg-tint-green text-profit-green',
  REJECTED: 'bg-tint-red text-loss-red',
  HIDDEN: 'bg-bg-surface-alt text-text-tertiary',
};

const PRIORITY_COLORS: Record<string, string> = {
  LOW: 'bg-bg-surface-alt text-text-secondary',
  NORMAL: 'bg-tint-blue text-brand-primary',
  HIGH: 'bg-tint-orange text-accent-gold',
  URGENT: 'bg-tint-red text-loss-red',
};

const CATEGORY_ICONS: Record<string, typeof Star> = { GENERAL: Star, BUG_REPORT: Bug, FEATURE_REQUEST: Lightbulb };

const BUG_STATUS_COLORS: Record<string, string> = {
  OPEN: 'bg-tint-red text-loss-red', INVESTIGATING: 'bg-tint-orange text-accent-gold',
  IN_PROGRESS: 'bg-tint-blue text-brand-primary', FIXED: 'bg-tint-green text-profit-green', CLOSED: 'bg-bg-surface-alt text-text-tertiary',
};

const FEATURE_STATUS_COLORS: Record<string, string> = {
  UNDER_CONSIDERATION: 'bg-tint-purple text-info-purple', PLANNED: 'bg-tint-blue text-brand-primary',
  IN_DEVELOPMENT: 'bg-tint-orange text-accent-gold', RELEASED: 'bg-tint-green text-profit-green',
};

// ── Rating Stars ──
function Stars({ rating }: { rating: number }) {
  return (
    <div className='flex items-center gap-0.5'>
      {[1, 2, 3, 4, 5].map(i => (
        <Star key={i} className={cn('h-3 w-3', i <= rating ? 'fill-accent-gold text-accent-gold' : 'text-text-tertiary')} />
      ))}
    </div>
  );
}

// ── Review Detail Drawer ──
function ReviewDrawer({ review, onClose, onRefresh }: {
  review: AdminReview; onClose: () => void; onRefresh: () => void;
}) {
  const [reply, setReply] = useState('');
  const [replying, setReplying] = useState(false);
  const [showScreenshot, setShowScreenshot] = useState(false);

  const handleReply = async () => {
    if (!reply.trim()) return;
    setReplying(true);
    try {
      const res = await adminFetch(`/api/admin/reviews/${review.id}/reply`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: reply.trim() }),
      });
      if (res.success) { setReply(''); onRefresh(); }
    } catch { /* ignore */ }
    setReplying(false);
  };

  const date = (d: string) => new Date(d).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  return (
    <>
      {/* Backdrop */}
      <div className='fixed inset-0 z-40 bg-black/40' onClick={onClose} />
      {/* Drawer */}
      <div className='fixed right-0 top-0 z-50 h-full w-full max-w-lg bg-bg-surface border-l border-border overflow-y-auto custom-scrollbar'>
        {/* Header */}
        <div className='sticky top-0 z-10 flex items-center justify-between border-b border-border bg-bg-surface px-5 py-4'>
          <h2 className='font-heading text-base font-semibold text-text-primary'>Review Detail</h2>
          <button onClick={onClose} className='text-text-tertiary hover:text-text-primary'><X className='h-5 w-5' /></button>
        </div>
        <div className='p-5 space-y-5'>
          {/* User info */}
          <div className='flex items-center gap-3'>
            <div className='flex h-10 w-10 items-center justify-center rounded-full bg-tint-blue text-sm font-semibold text-brand-primary'>
              {review.user.name?.[0]?.toUpperCase() || 'U'}
            </div>
            <div>
              <p className='text-sm font-medium text-text-primary'>{review.user.name || review.user.email}</p>
              <p className='text-[10px] text-text-tertiary'>{review.user.email}</p>
            </div>
          </div>

          {/* Status & Priority */}
          <div className='flex flex-wrap gap-2'>
            <span className={cn('pill', STATUS_COLORS[review.status] || '')}>{review.status}</span>
            <span className={cn('pill', PRIORITY_COLORS[review.priority] || '')}>{review.priority}</span>
            <span className='pill bg-bg-surface-alt text-text-secondary'>{review.category.replace('_', ' ')}</span>
          </div>

          {/* Bug/Feature Status */}
          {review.category === 'BUG_REPORT' && review.bugStatus && (
            <div className='flex items-center gap-2'>
              <span className='text-xs text-text-secondary'>Bug Status:</span>
              <StatusDropdown reviewId={review.id} field='bugStatus' value={review.bugStatus} options={['OPEN', 'INVESTIGATING', 'IN_PROGRESS', 'FIXED', 'CLOSED']} colors={BUG_STATUS_COLORS} onRefresh={onRefresh} />
            </div>
          )}
          {review.category === 'FEATURE_REQUEST' && review.featureStatus && (
            <div className='flex items-center gap-2'>
              <span className='text-xs text-text-secondary'>Feature Status:</span>
              <StatusDropdown reviewId={review.id} field='featureStatus' value={review.featureStatus} options={['UNDER_CONSIDERATION', 'PLANNED', 'IN_DEVELOPMENT', 'RELEASED']} colors={FEATURE_STATUS_COLORS} onRefresh={onRefresh} />
            </div>
          )}

          {/* Rating */}
          <div className='flex items-center gap-2'>
            <Stars rating={review.rating} />
            <span className='text-xs text-text-tertiary'>{review.rating}/5</span>
          </div>

          {/* Title & Content */}
          <div>
            <h3 className='font-heading text-sm font-semibold text-text-primary'>{review.title}</h3>
            <p className='mt-2 text-sm leading-relaxed text-text-secondary whitespace-pre-line'>{review.content}</p>
          </div>

          {/* Bug details */}
          {review.category === 'BUG_REPORT' && (
            <div className='space-y-3 rounded-xl bg-bg-surface-alt p-4'>
              <p className='text-xs font-semibold text-text-primary'>Bug Details</p>
              {review.bugSteps && <div><p className='text-[10px] text-text-tertiary'>Steps to Reproduce</p><p className='mt-1 text-xs text-text-secondary whitespace-pre-line'>{review.bugSteps}</p></div>}
              <div className='grid gap-3 sm:grid-cols-2'>
                {review.bugExpected && <div><p className='text-[10px] text-text-tertiary'>Expected</p><p className='mt-1 text-xs text-text-secondary'>{review.bugExpected}</p></div>}
                {review.bugActual && <div><p className='text-[10px] text-text-tertiary'>Actual</p><p className='mt-1 text-xs text-text-secondary'>{review.bugActual}</p></div>}
              </div>
              {review.screenshotUrl && (
                <div>
                  <p className='text-[10px] text-text-tertiary'>Screenshot</p>
                  <button onClick={() => setShowScreenshot(true)} className='mt-1 rounded-lg border border-border overflow-hidden hover:border-brand-primary transition-colors'>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={review.screenshotUrl} alt='Bug screenshot' className='h-32 w-auto object-cover' />
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Feature details */}
          {review.category === 'FEATURE_REQUEST' && (
            <div className='space-y-3 rounded-xl bg-bg-surface-alt p-4'>
              <p className='text-xs font-semibold text-text-primary'>Feature Details</p>
              {review.whyNeeded && <div><p className='text-[10px] text-text-tertiary'>Why Needed</p><p className='mt-1 text-xs text-text-secondary whitespace-pre-line'>{review.whyNeeded}</p></div>}
              {review.additionalDetails && <div><p className='text-[10px] text-text-tertiary'>Additional Details</p><p className='mt-1 text-xs text-text-secondary whitespace-pre-line'>{review.additionalDetails}</p></div>}
            </div>
          )}

          {/* Device info (admin only) */}
          <div className='rounded-xl bg-bg-surface-alt p-4'>
            <p className='text-[10px] font-semibold text-text-tertiary uppercase tracking-wider'>Device Information</p>
            <div className='mt-2 grid grid-cols-2 gap-2 text-xs text-text-secondary'>
              {review.device && <div><span className='text-text-tertiary'>Device:</span> {review.device}</div>}
              {review.browser && <div><span className='text-text-tertiary'>Browser:</span> {review.browser}</div>}
              {review.os && <div><span className='text-text-tertiary'>OS:</span> {review.os}</div>}
              {review.screenSize && <div><span className='text-text-tertiary'>Screen:</span> {review.screenSize}</div>}
              {review.ip && <div><span className='text-text-tertiary'>IP:</span> {review.ip}</div>}
            </div>
          </div>

          {/* Existing Replies */}
          {review.replies.length > 0 && (
            <div className='space-y-2'>
              <p className='text-xs font-semibold text-text-primary'>Admin Replies ({review.replies.length})</p>
              {review.replies.map(r => (
                <div key={r.id} className='rounded-lg bg-tint-blue/50 p-3'>
                  <div className='flex items-center gap-2 mb-1'>
                    <Shield className='h-3 w-3 text-brand-primary' />
                    <span className='text-[10px] text-text-tertiary'>{date(r.createdAt)}</span>
                  </div>
                  <p className='text-xs text-text-secondary whitespace-pre-line'>{r.content}</p>
                </div>
              ))}
            </div>
          )}

          {/* Reply form */}
          <div>
            <p className='text-xs font-medium text-text-secondary mb-2'>Add Reply</p>
            <textarea value={reply} onChange={e => setReply(e.target.value)} rows={3} maxLength={1000} placeholder='Type your response...' className='w-full rounded-lg border border-border bg-bg-surface-alt px-3 py-2.5 text-sm text-text-primary placeholder:text-text-tertiary outline-none focus:border-brand-primary transition-colors resize-none' />
            <button onClick={handleReply} disabled={replying || !reply.trim()} className='mt-2 flex items-center gap-1.5 rounded-lg bg-brand-primary px-4 py-2 text-xs font-medium text-white hover:bg-brand-primary-hover transition-colors disabled:opacity-50'>
              {replying ? <Loader2 className='h-3.5 w-3.5 animate-spin' /> : <Send className='h-3.5 w-3.5' />}
              Send Reply
            </button>
          </div>

          {/* Metadata */}
          <div className='flex items-center gap-4 text-[10px] text-text-tertiary'>
            <span className='flex items-center gap-1'><ThumbsUp className='h-3 w-3' /> {review.helpfulCount} helpful</span>
            <span className='flex items-center gap-1'><Clock className='h-3 w-3' /> {date(review.createdAt)}</span>
          </div>
        </div>
      </div>

      {/* Screenshot lightbox */}
      {showScreenshot && review.screenshotUrl && (
        <div className='fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4' onClick={() => setShowScreenshot(false)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={review.screenshotUrl} alt='Screenshot' className='max-w-full max-h-full rounded-xl' onClick={e => e.stopPropagation()} />
        </div>
      )}
    </>
  );
}

// ── Status Dropdown (inline) ──
function StatusDropdown({ reviewId, field, value, options, colors, onRefresh }: {
  reviewId: string; field: string; value: string;
  options: string[]; colors: Record<string, string>;
  onRefresh: () => void;
}) {
  const [open, setOpen] = useState(false);
  const handleChange = async (newVal: string) => {
    setOpen(false);
    if (newVal === value) return;
    try {
      await adminFetch(`/api/admin/reviews/${reviewId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: newVal }),
      });
      onRefresh();
    } catch { /* ignore */ }
  };

  return (
    <div className='relative'>
      <button onClick={() => setOpen(!open)} className={cn('pill cursor-pointer', colors[value] || '')}>
        {value.replace(/_/g, ' ')}
      </button>
      {open && (
        <div className='absolute left-0 top-full mt-1 z-10 min-w-[140px] rounded-lg border border-border bg-bg-surface py-1 shadow-lg'>
          {options.map(o => (
            <button key={o} onClick={() => handleChange(o)} className={cn('w-full px-3 py-1.5 text-left text-xs transition-colors', o === value ? 'bg-tint-blue text-brand-primary font-medium' : 'text-text-secondary hover:bg-bg-surface-alt')}>
              {o.replace(/_/g, ' ')}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Settings Panel ──
function SettingsPanel({ onClose }: { onClose: () => void }) {
  const [settings, setSettings] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    adminFetch('/api/admin/reviews/settings').then((d: any) => { if (d.success) setSettings(d.data); });
  }, []);

  const handleToggle = async (key: string) => {
    const newVal = !settings[key];
    setSettings(s => ({ ...s, [key]: newVal }));
    setSaving(true);
    try {
      await adminFetch('/api/admin/reviews/settings', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [key]: newVal }),
      });
    } catch { setSettings(s => ({ ...s, [key]: !newVal })); }
    setSaving(false);
  };

  const ITEMS = [
    ['review_enabled', 'Reviews Enabled', 'Allow users to submit reviews'],
    ['review_requireApproval', 'Require Approval', 'New reviews need admin approval'],
    ['review_allowScreenshots', 'Allow Screenshots', 'Let users attach screenshots to bug reports'],
    ['review_allowHelpfulVotes', 'Allow Helpful Votes', 'Let users vote reviews as helpful'],
    ['review_allowAdminReplies', 'Allow Admin Replies', 'Admins can reply to reviews publicly'],
    ['review_allowBugReports', 'Allow Bug Reports', 'Users can submit bug reports'],
    ['review_allowFeatureRequests', 'Allow Feature Requests', 'Users can suggest features'],
    ['review_allowUserEdit', 'Allow User Edit', 'Users can edit their own reviews'],
    ['review_allowUserDelete', 'Allow User Delete', 'Users can delete their own reviews'],
  ] as const;

  return (
    <div className='fixed inset-0 z-40 bg-black/40' onClick={onClose}>
      <div className='fixed right-0 top-0 z-50 h-full w-full max-w-md bg-bg-surface border-l border-border overflow-y-auto custom-scrollbar' onClick={e => e.stopPropagation()}>
        <div className='sticky top-0 z-10 flex items-center justify-between border-b border-border bg-bg-surface px-5 py-4'>
          <h2 className='font-heading text-base font-semibold text-text-primary'>Review Settings</h2>
          <button onClick={onClose} className='text-text-tertiary hover:text-text-primary'><X className='h-5 w-5' /></button>
        </div>
        <div className='p-5 space-y-1'>
          {ITEMS.map(([key, label, desc]) => (
            <div key={key} className='flex items-center justify-between py-3 border-b border-border/50 last:border-0'>
              <div className='flex-1 min-w-0 mr-4'>
                <p className='text-sm font-medium text-text-primary'>{label}</p>
                <p className='text-[10px] text-text-tertiary'>{desc}</p>
              </div>
              <button
                onClick={() => handleToggle(key)}
                className={cn('relative h-6 w-11 rounded-full transition-colors shrink-0', settings[key] ? 'bg-brand-primary' : 'bg-bg-surface-alt')}
              >
                <span className={cn('absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform', settings[key] ? 'left-[22px]' : 'left-0.5')} />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Main Page ──
export default function ReviewsPage() {
  const [reviews, setReviews] = useState<AdminReview[]>([]);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedReview, setSelectedReview] = useState<AdminReview | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchReviews = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20', status: statusFilter, category: categoryFilter, priority: priorityFilter, search });
      const data = await adminFetch(`/api/admin/reviews?${params}`);
      if (data.success) { setReviews(data.data.items); setTotal(data.data.total); }
    } catch { /* ignore */ }
    setLoading(false);
  }, [page, statusFilter, categoryFilter, priorityFilter, search]);

  const fetchAnalytics = useCallback(async () => {
    try {
      const data = await adminFetch('/api/admin/reviews/analytics');
      if (data.success) setAnalytics(data.data);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { fetchReviews(); fetchAnalytics(); }, [fetchReviews, fetchAnalytics]);

  const handleAction = async (id: string, body: Record<string, string>) => {
    setActionLoading(id);
    try {
      await adminFetch(`/api/admin/reviews/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      fetchReviews(); fetchAnalytics();
      if (selectedReview?.id === id) setSelectedReview(null);
    } catch { /* ignore */ }
    setActionLoading(null);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this review permanently?')) return;
    setActionLoading(id);
    try {
      await adminFetch(`/api/admin/reviews/${id}`, { method: 'DELETE' });
      fetchReviews(); fetchAnalytics(); setSelectedReview(null);
    } catch { /* ignore */ }
    setActionLoading(null);
  };

  const totalPages = Math.ceil(total / 20);

  return (
    <div className='space-y-4'>
      {/* Header */}
      <div className='flex items-center justify-between'>
        <div>
          <h1 className='font-heading text-xl font-bold text-text-primary'>Reviews & Feedback</h1>
          <p className='text-xs text-text-secondary mt-0.5'>Manage user reviews, bug reports, and feature requests</p>
        </div>
        <button onClick={() => setShowSettings(true)} className='flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-medium text-text-secondary hover:bg-bg-surface-alt transition-colors'>
          <Settings className='h-3.5 w-3.5' /> Settings
        </button>
      </div>

      {/* KPI Cards */}
      {analytics && (
        <div className='grid grid-cols-2 lg:grid-cols-4 gap-3'>
          <KpiCard icon={Star} color='blue' label='Total Reviews' value={analytics.total} />
          <KpiCard icon={Clock} color='orange' label='Pending' value={analytics.pending} />
          <KpiCard icon={CheckCircle2} color='green' label='Approved' value={analytics.approved} />
          <KpiCard icon={XCircle} color='red' label='Rejected' value={analytics.rejected} />
        </div>
      )}

      {/* Rating Summary Bar */}
      {analytics && analytics.total > 0 && (
        <div className='card-soft p-4'>
          <div className='flex items-center gap-6'>
            <div className='text-center'>
              <p className='font-heading text-3xl font-bold text-text-primary'>{analytics.averageRating}</p>
              <Stars rating={Math.round(analytics.averageRating)} />
              <p className='text-[10px] text-text-tertiary mt-1'>{analytics.total} reviews</p>
            </div>
            <div className='flex-1 space-y-1'>
              {[5, 4, 3, 2, 1].map(s => {
                const count = analytics.ratingDistribution[s] || 0;
                const pct = analytics.total > 0 ? (count / analytics.total) * 100 : 0;
                return (
                  <div key={s} className='flex items-center gap-2 text-xs'>
                    <span className='w-3 text-right text-text-tertiary'>{s}</span>
                    <Star className='h-2.5 w-2.5 fill-accent-gold text-accent-gold' />
                    <div className='h-2 flex-1 rounded-full bg-bg-surface-alt'><div className='h-full rounded-full bg-accent-gold transition-all duration-700' style={{ width: `${pct}%` }} /></div>
                    <span className='w-5 text-right tabular-nums text-text-tertiary'>{count}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className='card-soft p-4'>
        <div className='flex flex-wrap gap-3'>
          <div className='relative flex-1 min-w-[200px]'>
            <Search className='absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-tertiary' />
            <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder='Search reviews, users...' className='w-full rounded-lg border border-border bg-bg-surface pl-9 pr-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary outline-none focus:border-brand-primary transition-colors' />
          </div>
          <div className='flex rounded-lg border border-border overflow-hidden'>
            {['', 'PENDING', 'APPROVED', 'REJECTED', 'HIDDEN'].map(s => (
              <button key={s || 'ALL'} onClick={() => { setStatusFilter(s); setPage(1); }} className={cn('px-3 py-1.5 text-xs font-medium transition-colors', statusFilter === s ? 'bg-brand-primary text-white' : 'text-text-secondary hover:bg-bg-surface-alt')}>{s || 'All'}</button>
            ))}
          </div>
          <div className='flex rounded-lg border border-border overflow-hidden'>
            {['', 'GENERAL', 'BUG_REPORT', 'FEATURE_REQUEST'].map(c => (
              <button key={c || 'ALL'} onClick={() => { setCategoryFilter(c); setPage(1); }} className={cn('px-3 py-1.5 text-xs font-medium transition-colors', categoryFilter === c ? 'bg-brand-primary text-white' : 'text-text-secondary hover:bg-bg-surface-alt')}>{c ? c.replace('_', ' ') : 'All'}</button>
            ))}
          </div>
          <div className='flex rounded-lg border border-border overflow-hidden'>
            {['', 'LOW', 'NORMAL', 'HIGH', 'URGENT'].map(p => (
              <button key={p || 'ALL'} onClick={() => { setPriorityFilter(p); setPage(1); }} className={cn('px-2.5 py-1.5 text-xs font-medium transition-colors', priorityFilter === p ? 'bg-brand-primary text-white' : 'text-text-secondary hover:bg-bg-surface-alt')}>{p || 'All'}</button>
            ))}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className='card-soft overflow-hidden'>
        <div className='overflow-x-auto'>
          <table className='w-full text-sm'>
            <thead>
              <tr className='border-b border-border'>
                <th className='text-left px-4 py-3 text-xs font-semibold text-text-secondary'>User</th>
                <th className='text-left px-4 py-3 text-xs font-semibold text-text-secondary'>Title</th>
                <th className='text-left px-4 py-3 text-xs font-semibold text-text-secondary'>Category</th>
                <th className='text-left px-4 py-3 text-xs font-semibold text-text-secondary'>Rating</th>
                <th className='text-left px-4 py-3 text-xs font-semibold text-text-secondary'>Status</th>
                <th className='text-left px-4 py-3 text-xs font-semibold text-text-secondary'>Priority</th>
                <th className='text-left px-4 py-3 text-xs font-semibold text-text-secondary'>Helpful</th>
                <th className='text-left px-4 py-3 text-xs font-semibold text-text-secondary'>Date</th>
                <th className='text-right px-4 py-3 text-xs font-semibold text-text-secondary'>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className='border-b border-border'>{Array.from({ length: 9 }).map((_, j) => (<td key={j} className='px-4 py-3'><div className='h-4 w-24 animate-pulse rounded bg-bg-surface-alt' /></td>))}</tr>
              )) : reviews.length === 0 ? (
                <tr><td colSpan={9} className='px-4 py-12 text-center text-text-secondary text-xs'>No reviews found</td></tr>
              ) : reviews.map(r => {
                const CatIcon = CATEGORY_ICONS[r.category] || Star;
                return (
                  <tr key={r.id} className='border-b border-border hover:bg-bg-surface-alt transition-colors'>
                    <td className='px-4 py-3'>
                      <p className='text-xs font-medium text-text-primary truncate max-w-[120px]'>{r.user.name || r.user.email}</p>
                      <p className='text-[10px] text-text-tertiary'>{r.replies.length} replies</p>
                    </td>
                    <td className='px-4 py-3'>
                      <p className='text-xs text-text-primary truncate max-w-[160px]'>{r.title}</p>
                    </td>
                    <td className='px-4 py-3'>
                      <div className='flex items-center gap-1'><CatIcon className='h-3 w-3 text-text-tertiary' /><span className='text-[10px] text-text-secondary'>{r.category.replace('_', ' ')}</span></div>
                    </td>
                    <td className='px-4 py-3'><Stars rating={r.rating} /></td>
                    <td className='px-4 py-3'><StatusDropdown reviewId={r.id} field='status' value={r.status} options={['PENDING', 'APPROVED', 'REJECTED', 'HIDDEN']} colors={STATUS_COLORS} onRefresh={() => { fetchReviews(); fetchAnalytics(); }} /></td>
                    <td className='px-4 py-3'><StatusDropdown reviewId={r.id} field='priority' value={r.priority} options={['LOW', 'NORMAL', 'HIGH', 'URGENT']} colors={PRIORITY_COLORS} onRefresh={fetchReviews} /></td>
                    <td className='px-4 py-3 text-xs tabular-nums text-text-secondary'>{r.helpfulCount}</td>
                    <td className='px-4 py-3 text-[10px] text-text-tertiary'>{new Date(r.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</td>
                    <td className='px-4 py-3 text-right'>
                      <div className='flex items-center justify-end gap-1'>
                        <button onClick={() => setSelectedReview(r)} className='p-1.5 rounded-lg text-text-tertiary hover:text-brand-primary hover:bg-tint-blue transition-colors'><Eye className='h-3.5 w-3.5' /></button>
                        {r.status === 'PENDING' && (
                          <button onClick={() => handleAction(r.id, { status: 'APPROVED' })} disabled={actionLoading === r.id} className='p-1.5 rounded-lg text-text-tertiary hover:text-profit-green hover:bg-tint-green transition-colors' title='Approve'>
                            {actionLoading === r.id ? <Loader2 className='h-3.5 w-3.5 animate-spin' /> : <CheckCircle2 className='h-3.5 w-3.5' />}
                          </button>
                        )}
                        {r.status !== 'REJECTED' && r.status !== 'HIDDEN' && (
                          <button onClick={() => handleAction(r.id, { status: 'REJECTED' })} disabled={actionLoading === r.id} className='p-1.5 rounded-lg text-text-tertiary hover:text-loss-red hover:bg-tint-red transition-colors' title='Reject'>
                            {actionLoading === r.id ? <Loader2 className='h-3.5 w-3.5 animate-spin' /> : <XCircle className='h-3.5 w-3.5' />}
                          </button>
                        )}
                        <button onClick={() => handleDelete(r.id)} className='p-1.5 rounded-lg text-text-tertiary hover:text-loss-red hover:bg-tint-red transition-colors' title='Delete'><Trash2 className='h-3.5 w-3.5' /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {/* Pagination */}
        {totalPages > 1 && (
          <div className='flex items-center justify-between px-4 py-3 border-t border-border'>
            <p className='text-xs text-text-secondary'>Page {page} of {totalPages} ({total} total)</p>
            <div className='flex gap-1'>
              <button disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))} className='flex h-8 w-8 items-center justify-center rounded-lg border border-border text-text-secondary hover:bg-bg-surface-alt disabled:opacity-40'><ChevronLeft className='h-4 w-4' /></button>
              <button disabled={page >= totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))} className='flex h-8 w-8 items-center justify-center rounded-lg border border-border text-text-secondary hover:bg-bg-surface-alt disabled:opacity-40'><ChevronRight className='h-4 w-4' /></button>
            </div>
          </div>
        )}
      </div>

      {/* Review Detail Drawer */}
      {selectedReview && <ReviewDrawer review={selectedReview} onClose={() => setSelectedReview(null)} onRefresh={() => { fetchReviews(); fetchAnalytics(); }} />}

      {/* Settings Panel */}
      {showSettings && <SettingsPanel onClose={() => setShowSettings(false)} />}
    </div>
  );
}

function KpiCard({ icon: Icon, color, label, value }: { icon: typeof Star; color: string; label: string; value: number }) {
  const colorMap: Record<string, string> = { blue: 'bg-tint-blue text-brand-primary', green: 'bg-tint-green text-profit-green', red: 'bg-tint-red text-loss-red', orange: 'bg-tint-orange text-accent-gold', purple: 'bg-tint-purple text-info-purple' };
  return (
    <div className='card-soft p-4'>
      <div className='flex items-center gap-3 mb-3'>
        <div className={cn('icon-tile', colorMap[color] || colorMap.blue)}><Icon className='h-[18px] w-[18px]' /></div>
        <div><p className='text-[11px] text-text-secondary'>{label}</p><p className='font-heading text-xl font-bold text-text-primary tabular-nums'>{value}</p></div>
      </div>
    </div>
  );
}

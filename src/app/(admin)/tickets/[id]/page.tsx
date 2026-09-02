'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/useAuthStore';
import { adminFetch } from '@/lib/admin-fetch';
import { cn, timeAgo, formatDateTime } from '@/lib/utils';
import {
  ArrowLeft, LifeBuoy, Loader2, Send, User, Shield,
  MessageSquare, AlertCircle, CheckCircle2,
} from 'lucide-react';

interface TicketMessage {
  id: string;
  senderId: string;
  senderType: string; // USER | ADMIN
  content: string;
  createdAt: string;
}

interface TicketDetail {
  id: string;
  subject: string;
  status: string;
  priority: string;
  createdAt: string;
  updatedAt: string;
  user: { id: string; name: string | null; email: string; tier: string; isActive: boolean } | null;
  messages: TicketMessage[];
  _count: { messages: number };
}

const STATUS_OPTIONS = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'];
const PRIORITY_OPTIONS = ['LOW', 'NORMAL', 'HIGH', 'URGENT'];

const STATUS_STYLES: Record<string, string> = {
  OPEN: 'bg-tint-red text-loss-red',
  IN_PROGRESS: 'bg-tint-yellow text-warning-amber',
  RESOLVED: 'bg-tint-green text-profit-green',
  CLOSED: 'bg-bg-surface-alt text-text-secondary',
};

const PRIORITY_STYLES: Record<string, string> = {
  LOW: 'bg-bg-surface-alt text-text-secondary',
  NORMAL: 'bg-tint-blue text-brand-primary',
  HIGH: 'bg-tint-orange text-accent-gold',
  URGENT: 'bg-tint-red text-loss-red',
};

export default function TicketDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { token } = useAuthStore();
  const [ticket, setTicket] = useState<TicketDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [reply, setReply] = useState('');
  const [replying, setReplying] = useState(false);

  const [updating, setUpdating] = useState(false);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchTicket = useCallback(async () => {
    if (!token || !params.id) return;
    try {
      const data = await adminFetch(`/api/admin/tickets/${params.id}`);
      if (data.success) {
        setTicket(data.data);
        setNotFound(false);
      } else if (data.error === 'Ticket not found') {
        setNotFound(true);
      }
    } catch (e) {
      if (!(e instanceof Error && e.message === 'Session expired')) console.error(e);
    } finally {
      setLoading(false);
    }
  }, [token, params.id]);

  useEffect(() => { fetchTicket(); }, [fetchTicket]);

  const handleReply = async () => {
    if (!reply.trim() || !ticket) return;
    setReplying(true);
    try {
      const data = await adminFetch(`/api/admin/tickets/${ticket.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: reply.trim() }),
      });
      if (data.success) {
        setReply('');
        await fetchTicket();
      } else {
        setMsg({ type: 'error', text: data.error || 'Failed to send reply' });
      }
    } catch (e) {
      if (!(e instanceof Error && e.message === 'Session expired')) {
        setMsg({ type: 'error', text: 'Network error — could not send reply' });
      }
    } finally {
      setReplying(false);
    }
  };

  const handleUpdate = async (patch: { status?: string; priority?: string }) => {
    if (!ticket) return;
    setUpdating(true);
    setMsg(null);
    try {
      const data = await adminFetch(`/api/admin/tickets/${ticket.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      if (data.success) {
        setTicket(t => (t ? { ...t, ...patch } : t));
        setMsg({ type: 'success', text: 'Ticket updated' });
        setTimeout(() => setMsg(null), 3000);
      } else {
        setMsg({ type: 'error', text: data.error || 'Update failed' });
      }
    } catch (e) {
      if (!(e instanceof Error && e.message === 'Session expired')) {
        setMsg({ type: 'error', text: 'Network error' });
      }
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-12 w-60 animate-pulse rounded-xl bg-bg-surface" />
        <div className="h-64 animate-pulse rounded-xl bg-bg-surface" />
      </div>
    );
  }

  if (notFound || !ticket) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <AlertCircle className="h-10 w-10 text-loss-red" />
        <p className="text-sm font-medium text-text-primary">Ticket not found</p>
        <button
          onClick={() => router.push('/tickets')}
          className="mt-2 px-4 py-2 rounded-lg bg-brand-primary text-white text-xs font-semibold hover:bg-brand-primary-hover"
        >
          Back to Tickets
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Back */}
      <button
        onClick={() => router.push('/tickets')}
        className="flex items-center gap-1.5 text-sm font-medium text-text-secondary hover:text-text-primary transition-colors"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Tickets
      </button>

      {/* Header card */}
      <div className="card-soft p-5">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="flex items-start gap-3 min-w-0">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-tint-blue text-brand-primary shrink-0">
              <LifeBuoy className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h1 className="font-heading text-lg font-bold text-text-primary break-words">{ticket.subject}</h1>
              <div className="flex flex-wrap items-center gap-2 mt-2">
                <span className={cn('pill', STATUS_STYLES[ticket.status] || '')}>{ticket.status.replace('_', ' ')}</span>
                <span className={cn('pill', PRIORITY_STYLES[ticket.priority] || '')}>{ticket.priority}</span>
                <span className="text-[11px] text-text-tertiary">Opened {timeAgo(ticket.createdAt)}</span>
                <span className="text-[11px] text-text-tertiary">· {ticket._count.messages} messages</span>
              </div>
            </div>
          </div>

          {/* Controls */}
          <div className="flex flex-wrap gap-2 shrink-0">
            <label className="sr-only" htmlFor="ticket-status">Ticket status</label>
            <select
              id="ticket-status"
              value={ticket.status}
              disabled={updating}
              onChange={(e) => handleUpdate({ status: e.target.value })}
              className="h-9 rounded-lg border border-border bg-bg-surface px-2.5 text-xs font-medium text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/30 disabled:opacity-60"
            >
              {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
            </select>
            <label className="sr-only" htmlFor="ticket-priority">Ticket priority</label>
            <select
              id="ticket-priority"
              value={ticket.priority}
              disabled={updating}
              onChange={(e) => handleUpdate({ priority: e.target.value })}
              className="h-9 rounded-lg border border-border bg-bg-surface px-2.5 text-xs font-medium text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/30 disabled:opacity-60"
            >
              {PRIORITY_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
        </div>

        {/* User info */}
        {ticket.user && (
          <div className="mt-4 flex items-center gap-3 rounded-xl bg-bg-surface-alt p-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-tint-purple text-info-purple text-xs font-bold uppercase shrink-0">
              {(ticket.user.name || ticket.user.email)[0]}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-text-primary truncate">{ticket.user.name || '—'}</p>
              <p className="text-[11px] text-text-secondary truncate">{ticket.user.email}</p>
            </div>
            <div className="ml-auto flex items-center gap-2 shrink-0">
              <span className={cn('pill', ticket.user.tier === 'PREMIUM' ? 'bg-tint-purple text-info-purple' : 'bg-bg-surface text-text-secondary')}>
                {ticket.user.tier}
              </span>
              <span className={cn('pill', ticket.user.isActive ? 'bg-tint-green text-profit-green' : 'bg-tint-red text-loss-red')}>
                {ticket.user.isActive ? 'Active' : 'Inactive'}
              </span>
            </div>
          </div>
        )}

        {msg && (
          <div className={cn(
            'mt-3 flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium',
            msg.type === 'success' ? 'bg-tint-green text-profit-green' : 'bg-tint-red text-loss-red'
          )}>
            {msg.type === 'success' ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
            {msg.text}
          </div>
        )}
      </div>

      {/* Message thread */}
      <div className="card-soft p-5">
        <h2 className="font-heading text-base font-semibold text-text-primary mb-4 flex items-center gap-2">
          <MessageSquare className="h-4 w-4" /> Conversation
        </h2>

        {ticket.messages.length === 0 ? (
          <p className="text-sm text-text-secondary text-center py-8">No messages yet</p>
        ) : (
          <div className="space-y-4">
            {ticket.messages.map((m) => {
              const isAdmin = m.senderType === 'ADMIN';
              return (
                <div key={m.id} className={cn('flex gap-3', isAdmin && 'flex-row-reverse')}>
                  <div className={cn(
                    'flex h-8 w-8 items-center justify-center rounded-full shrink-0',
                    isAdmin ? 'bg-tint-blue text-brand-primary' : 'bg-bg-surface-alt text-text-secondary'
                  )}>
                    {isAdmin ? <Shield className="h-4 w-4" /> : <User className="h-4 w-4" />}
                  </div>
                  <div className={cn(
                    'max-w-[80%] rounded-2xl px-4 py-3',
                    isAdmin ? 'bg-tint-blue/60 rounded-tr-sm' : 'bg-bg-surface-alt rounded-tl-sm'
                  )}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-text-tertiary">
                        {isAdmin ? 'Admin' : 'User'}
                      </span>
                      <span className="text-[10px] text-text-tertiary">{formatDateTime(m.createdAt)}</span>
                    </div>
                    <p className="text-sm text-text-secondary leading-relaxed whitespace-pre-line break-words">{m.content}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Reply box */}
        <div className="mt-6 border-t border-border pt-4">
          <label htmlFor="ticket-reply" className="text-xs font-medium text-text-secondary block mb-2">
            Reply as Admin
          </label>
          <textarea
            id="ticket-reply"
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            rows={3}
            maxLength={2000}
            placeholder="Type your response to the user..."
            className="w-full rounded-lg border border-border bg-bg-surface-alt px-3 py-2.5 text-sm text-text-primary placeholder:text-text-tertiary outline-none focus:border-brand-primary transition-colors resize-none"
          />
          <div className="mt-2 flex items-center justify-between">
            <span className="text-[10px] text-text-tertiary">{reply.length}/2000</span>
            <button
              onClick={handleReply}
              disabled={replying || !reply.trim()}
              className="flex items-center gap-1.5 rounded-lg bg-brand-primary px-4 py-2 text-xs font-medium text-white hover:bg-brand-primary-hover transition-colors disabled:opacity-50 disabled:pointer-events-none"
            >
              {replying ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              Send Reply
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

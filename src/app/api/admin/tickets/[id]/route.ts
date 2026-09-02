import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyToken, extractBearerToken } from '@/lib/auth';

interface RouteContext {
  params: Promise<{ id: string }>;
}

async function verifyAdmin(req: NextRequest) {
  const token = extractBearerToken(req.headers.get('authorization'));
  if (!token) return null;
  const payload = await verifyToken(token);
  if (!payload || payload.role !== 'ADMIN') return null;
  return payload;
}

const VALID_STATUSES = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'];
const VALID_PRIORITIES = ['LOW', 'NORMAL', 'HIGH', 'URGENT'];

/**
 * GET /api/admin/tickets/[id] — Ticket detail with user + message thread.
 * Fixes: /tickets/[id] links previously 404'd (page + API didn't exist).
 */
export async function GET(req: NextRequest, ctx: RouteContext) {
  try {
    const admin = await verifyAdmin(req);
    if (!admin) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    const { id } = await ctx.params;

    const ticket = await db.supportTicket.findUnique({
      where: { id },
      select: {
        id: true, subject: true, status: true, priority: true,
        createdAt: true, updatedAt: true,
        user: { select: { id: true, name: true, email: true, tier: true, isActive: true } },
        messages: {
          select: { id: true, senderId: true, senderType: true, content: true, createdAt: true },
          orderBy: { createdAt: 'asc' },
        },
        _count: { select: { messages: true } },
      },
    });

    if (!ticket) return NextResponse.json({ success: false, error: 'Ticket not found' }, { status: 404 });

    return NextResponse.json({ success: true, data: ticket });
  } catch (error) {
    console.error('Admin ticket detail error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch ticket' }, { status: 500 });
  }
}

/**
 * PATCH /api/admin/tickets/[id] — Update ticket status / priority.
 */
export async function PATCH(req: NextRequest, ctx: RouteContext) {
  try {
    const admin = await verifyAdmin(req);
    if (!admin) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    const { id } = await ctx.params;
    const body = await req.json();
    const { status, priority } = body;

    const updateData: Record<string, unknown> = {};

    if (status !== undefined) {
      if (!VALID_STATUSES.includes(status)) {
        return NextResponse.json({ success: false, error: 'Invalid status' }, { status: 400 });
      }
      updateData.status = status;
    }
    if (priority !== undefined) {
      if (!VALID_PRIORITIES.includes(priority)) {
        return NextResponse.json({ success: false, error: 'Invalid priority' }, { status: 400 });
      }
      updateData.priority = priority;
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ success: false, error: 'Nothing to update' }, { status: 400 });
    }

    const existing = await db.supportTicket.findUnique({ where: { id }, select: { id: true, userId: true } });
    if (!existing) return NextResponse.json({ success: false, error: 'Ticket not found' }, { status: 404 });

    const ticket = await db.supportTicket.update({
      where: { id },
      data: updateData,
      select: { id: true, status: true, priority: true, updatedAt: true },
    });

    await db.activityLog.create({
      data: {
        userId: existing.userId,
        action: 'TICKET_UPDATED',
        details: JSON.stringify({ ticketId: id, changes: updateData, adminEmail: admin.email }),
      },
    }).catch(() => {});

    return NextResponse.json({ success: true, data: ticket, message: 'Ticket updated' });
  } catch (error) {
    console.error('Admin ticket update error:', error);
    return NextResponse.json({ success: false, error: 'Failed to update ticket' }, { status: 500 });
  }
}

/**
 * POST /api/admin/tickets/[id] — Add an ADMIN reply message to the thread.
 */
export async function POST(req: NextRequest, ctx: RouteContext) {
  try {
    const admin = await verifyAdmin(req);
    if (!admin) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    const { id } = await ctx.params;
    const body = await req.json();
    const { content } = body;

    if (!content || typeof content !== 'string' || content.trim().length < 1 || content.trim().length > 2000) {
      return NextResponse.json({ success: false, error: 'Reply must be 1-2000 characters' }, { status: 400 });
    }

    const ticket = await db.supportTicket.findUnique({ where: { id }, select: { id: true, userId: true } });
    if (!ticket) return NextResponse.json({ success: false, error: 'Ticket not found' }, { status: 404 });

    const message = await db.ticketMessage.create({
      data: {
        ticketId: id,
        senderId: 'admin',
        senderType: 'ADMIN',
        content: content.trim(),
      },
      select: { id: true, senderId: true, senderType: true, content: true, createdAt: true },
    });

    await db.activityLog.create({
      data: {
        userId: ticket.userId,
        action: 'TICKET_REPLIED',
        details: JSON.stringify({ ticketId: id, messageId: message.id, adminEmail: admin.email }),
      },
    }).catch(() => {});

    return NextResponse.json({ success: true, data: message, message: 'Reply sent' }, { status: 201 });
  } catch (error) {
    console.error('Admin ticket reply error:', error);
    return NextResponse.json({ success: false, error: 'Failed to add reply' }, { status: 500 });
  }
}

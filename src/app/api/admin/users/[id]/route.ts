import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyToken, extractBearerToken } from '@/lib/auth';

/**
 * GET /api/admin/users/[id] — User detail (SAFE FIELDS ONLY).
 *
 * Security fix: previously used `include` which returned the FULL user row
 * including passwordHash, twoFactorSecret and googleId to the browser.
 * Now uses an explicit `select` and serializes Decimal fields to numbers
 * (Prisma serializes Decimal as strings, which broke number formatting).
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const token = extractBearerToken(req.headers.get('authorization'));
    const payload = token ? await verifyToken(token) : null;
    if (!payload || payload.role !== 'ADMIN') {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const user = await db.user.findUnique({
      where: { id },
      select: {
        id: true, name: true, email: true, phone: true, role: true, tier: true,
        virtualCapital: true, isActive: true, twoFactorEnabled: true, language: true,
        createdAt: true, updatedAt: true,
        portfolio: {
          select: {
            id: true, totalBalance: true, investedAmount: true, availableMargin: true,
            totalPnl: true, realizedPnl: true, unrealizedPnl: true, dayPnl: true,
            winRate: true, totalTrades: true, winningTrades: true,
          },
        },
        subscriptions: {
          select: { id: true, plan: true, status: true, startDate: true, endDate: true, razorpaySubId: true },
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
        positions: {
          select: { id: true, symbol: true, side: true, quantity: true, avgPrice: true, pnl: true, pnlPct: true, status: true, segment: true, openedAt: true },
          where: { status: 'OPEN' },
          take: 10,
        },
        activityLogs: {
          select: { id: true, action: true, ip: true, createdAt: true },
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
        supportTickets: {
          select: { id: true, subject: true, status: true, priority: true, createdAt: true },
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
        _count: { select: { orders: true, trades: true, watchlist: true, notifications: true } },
      },
    });

    if (!user) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    // Serialize Decimal → number (Decimal arrives as a string in JSON)
    const data = {
      ...user,
      virtualCapital: Number(user.virtualCapital),
      portfolio: user.portfolio
        ? {
            ...user.portfolio,
            totalBalance: Number(user.portfolio.totalBalance),
            investedAmount: Number(user.portfolio.investedAmount),
            availableMargin: Number(user.portfolio.availableMargin),
            totalPnl: Number(user.portfolio.totalPnl),
            realizedPnl: Number(user.portfolio.realizedPnl),
            unrealizedPnl: Number(user.portfolio.unrealizedPnl),
            dayPnl: Number(user.portfolio.dayPnl),
          }
        : null,
    };

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('User detail error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch user' }, { status: 500 });
  }
}

/**
 * PATCH /api/admin/users/[id] — Update tier / isActive / virtualCapital.
 *
 * Fixes: input validation, 404 on missing user (was a 500), and no longer
 * returns the raw user row (which leaked passwordHash etc).
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const token = extractBearerToken(req.headers.get('authorization'));
    const payload = token ? await verifyToken(token) : null;
    if (!payload || payload.role !== 'ADMIN') {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();
    const { tier, isActive, virtualCapital } = body;

    // ── Validation ──
    if (tier !== undefined && !['FREE', 'PREMIUM'].includes(tier)) {
      return NextResponse.json({ success: false, error: 'Invalid tier — must be FREE or PREMIUM' }, { status: 400 });
    }
    if (isActive !== undefined && typeof isActive !== 'boolean') {
      return NextResponse.json({ success: false, error: 'Invalid isActive — must be boolean' }, { status: 400 });
    }
    if (virtualCapital !== undefined) {
      const n = Number(virtualCapital);
      if (!Number.isFinite(n) || n < 0 || n > 1_000_000_000) {
        return NextResponse.json({ success: false, error: 'Invalid virtualCapital — must be a positive number' }, { status: 400 });
      }
    }

    const updateData: Record<string, unknown> = {};
    if (tier !== undefined) updateData.tier = tier;
    if (isActive !== undefined) updateData.isActive = isActive;
    if (virtualCapital !== undefined) updateData.virtualCapital = Number(virtualCapital);

    const existing = await db.user.findUnique({ where: { id }, select: { id: true } });
    if (!existing) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    const user = await db.user.update({
      where: { id },
      data: updateData,
      select: { id: true, tier: true, isActive: true, virtualCapital: true, updatedAt: true },
    });

    return NextResponse.json({
      success: true,
      data: { ...user, virtualCapital: Number(user.virtualCapital) },
    });
  } catch (error) {
    console.error('User update error:', error);
    return NextResponse.json({ success: false, error: 'Failed to update user' }, { status: 500 });
  }
}

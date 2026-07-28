import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyToken, extractBearerToken } from '@/lib/auth';
import { Prisma } from '@prisma/client';

export async function GET(req: Request) {
  try {
    const token = extractBearerToken(req.headers.get('authorization'));
    const payload = token ? await verifyToken(token) : null;
    if (!payload || payload.role !== 'ADMIN') {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [
      totalUsers,
      activeUsers,
      premiumUsers,
      trialActive,
      totalTrades,
      openPositions,
      todaySignups,
      totalOrders,
    ] = await Promise.all([
      db.user.count(),
      db.user.count({ where: { isActive: true } }),
      db.user.count({ where: { tier: 'PREMIUM' } }),
      db.subscription.count({ where: { status: 'ACTIVE', razorpaySubId: 'TRIAL', endDate: { gt: now } } }),
      db.trade.count(),
      db.position.count({ where: { status: 'OPEN' } }),
      db.user.count({ where: { createdAt: { gte: todayStart } } }),
      db.order.count(),
    ]);

    // Aggregate portfolio P&L
    const pnlAgg = await db.portfolio.aggregate({
      _sum: { totalPnl: true, realizedPnl: true },
    });

    // Recent users (last 5)
    const recentUsers = await db.user.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      select: { id: true, name: true, email: true, tier: true, createdAt: true, isActive: true },
    });

    // Tier distribution
    const freeCount = await db.user.count({ where: { tier: 'FREE' } });
    const premiumCount = await db.user.count({ where: { tier: 'PREMIUM' } });

    return NextResponse.json({
      success: true,
      data: {
        totalUsers,
        activeUsers,
        premiumUsers,
        trialActive,
        totalTrades,
        openPositions,
        todaySignups,
        totalOrders,
        totalPnl: Number(pnlAgg._sum.totalPnl || 0),
        realizedPnl: Number(pnlAgg._sum.realizedPnl || 0),
        tierDistribution: { free: freeCount, premium: premiumCount },
        recentUsers,
      },
    });
  } catch (error) {
    console.error('Stats fetch error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch stats' }, { status: 500 });
  }
}

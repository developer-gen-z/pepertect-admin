import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyToken, extractBearerToken } from '@/lib/auth';
import { batchFetchLtp, calcPnl } from '@/lib/live-quote';

export async function GET(req: Request) {
  try {
    const token = extractBearerToken(req.headers.get('authorization'));
    const payload = token ? await verifyToken(token) : null;
    if (!payload || payload.role !== 'ADMIN') {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

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

    // Aggregate realized P&L from portfolio (DB)
    const pnlAgg = await db.portfolio.aggregate({
      _sum: { totalPnl: true, realizedPnl: true },
    });

    // ─── Live unrealised P&L from open positions ───
    // Fetch all open positions, get their live LTP, and compute real-time P&L.
    const openPositionRows = await db.position.findMany({
      where: { status: 'OPEN' },
      select: {
        id: true,
        symbol: true,
        side: true,
        quantity: true,
        avgPrice: true,
        instrumentKey: true,
      },
    });

    let liveUnrealisedPnl = 0;
    let livePriceCount = 0;
    if (openPositionRows.length > 0) {
      const instrumentKeys = openPositionRows
        .map((p) => p.instrumentKey)
        .filter((k): k is string => !!k);
      const livePrices = await batchFetchLtp(instrumentKeys);
      livePriceCount = livePrices.size;

      for (const p of openPositionRows) {
        const livePrice = p.instrumentKey ? livePrices.get(p.instrumentKey) : undefined;
        if (livePrice !== undefined && livePrice > 0) {
          const { pnl } = calcPnl(p.side, p.avgPrice, livePrice, p.quantity);
          liveUnrealisedPnl += pnl;
        }
      }
    }

    // Recent users (last 5)
    const recentUsers = await db.user.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      select: { id: true, name: true, email: true, tier: true, createdAt: true, isActive: true },
    });

    // Tier distribution
    const freeCount = await db.user.count({ where: { tier: 'FREE' } });
    const premiumCount = await db.user.count({ where: { tier: 'PREMIUM' } });

    const realizedPnl = Number(pnlAgg._sum.realizedPnl || 0);
    const totalPnl = realizedPnl + liveUnrealisedPnl;

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
        totalPnl,
        realizedPnl,
        unrealisedPnl: liveUnrealisedPnl,
        livePriceCount,
        tierDistribution: { free: freeCount, premium: premiumCount },
        recentUsers,
      },
    });
  } catch (error) {
    console.error('Stats fetch error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch stats' }, { status: 500 });
  }
}

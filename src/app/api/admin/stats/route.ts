import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyToken, extractBearerToken } from '@/lib/auth';

export async function GET(req: Request) {
  try {
    const token = extractBearerToken(req.headers.get('authorization'));
    const payload = token ? await verifyToken(token) : null;
    if (!payload || payload.role !== 'ADMIN') {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const [totalUsers, activeUsers, todaySignups] = await Promise.all([
      db.user.count(),
      db.user.count({ where: { isActive: true } }),
      db.user.count({ where: { createdAt: { gte: todayStart } } }),
    ]);

    // Recent users (last 5)
    const recentUsers = await db.user.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      select: { id: true, name: true, email: true, tier: true, createdAt: true, isActive: true },
    });

    return NextResponse.json({
      success: true,
      data: {
        totalUsers,
        activeUsers,
        todaySignups,
        recentUsers,
      },
    });
  } catch (error) {
    console.error('Stats fetch error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch stats' }, { status: 500 });
  }
}

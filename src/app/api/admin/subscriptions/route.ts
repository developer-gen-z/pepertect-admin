import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyToken, extractBearerToken } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const token = extractBearerToken(req.headers.get('authorization'));
    const payload = token ? await verifyToken(token) : null;
    if (!payload || payload.role !== 'ADMIN') {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20')));
    const plan = searchParams.get('plan') || '';
    const status = searchParams.get('status') || '';
    const trial = searchParams.get('trial') || '';

    const where: Record<string, unknown> = {};
    if (plan) where.plan = plan;
    if (status) where.status = status;
    if (trial === 'true') where.razorpaySubId = 'TRIAL';
    if (trial === 'false') where.razorpaySubId = { not: 'TRIAL' };

    const [subs, total] = await Promise.all([
      db.subscription.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { id: true, name: true, email: true, tier: true } },
          payments: { orderBy: { createdAt: 'desc' }, take: 1 },
        },
      }),
      db.subscription.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: { subscriptions: subs, total, page, limit, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error('Subscriptions fetch error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch subscriptions' }, { status: 500 });
  }
}

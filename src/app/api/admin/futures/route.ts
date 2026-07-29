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
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50')));

    const [futures, total] = await Promise.all([
      db.future.findMany({
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { updatedAt: 'desc' },
        include: {
          stock: { select: { symbol: true, name: true, exchange: true, sector: true } },
        },
      }),
      db.future.count(),
    ]);

    return NextResponse.json({
      success: true,
      data: { futures, total, page, limit, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error('Futures fetch error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch futures' }, { status: 500 });
  }
}

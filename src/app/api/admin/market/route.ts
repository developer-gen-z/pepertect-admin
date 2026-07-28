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
    const type = searchParams.get('type') || 'stocks';
    const search = searchParams.get('search') || '';
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20')));

    if (type === 'indices') {
      const where: Record<string, unknown> = {};
      if (search) where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { symbol: { contains: search, mode: 'insensitive' } },
      ];

      const [indices, total] = await Promise.all([
        db.index.findMany({ where, skip: (page - 1) * limit, take: limit, orderBy: { name: 'asc' } }),
        db.index.count({ where }),
      ]);

      return NextResponse.json({ success: true, data: { items: indices, total, page, limit, pages: Math.ceil(total / limit) } });
    }

    // Default: stocks
    const where: Record<string, unknown> = {};
    if (search) where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { symbol: { contains: search, mode: 'insensitive' } },
    ];

    const [stocks, total] = await Promise.all([
      db.stock.findMany({
        where, skip: (page - 1) * limit, take: limit, orderBy: { symbol: 'asc' },
        select: { id: true, symbol: true, name: true, exchange: true, segment: true, sector: true, lotSize: true, ltp: true, change: true, changePct: true, volume: true, updatedAt: true },
      }),
      db.stock.count({ where }),
    ]);

    return NextResponse.json({ success: true, data: { items: stocks, total, page, limit, pages: Math.ceil(total / limit) } });
  } catch (error) {
    console.error('Market fetch error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch market data' }, { status: 500 });
  }
}

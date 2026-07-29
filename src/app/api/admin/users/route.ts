import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyToken, extractBearerToken } from '@/lib/auth';

// DELETE single or multiple users from database
export async function DELETE(req: NextRequest) {
  try {
    const token = extractBearerToken(req.headers.get('authorization'));
    const payload = token ? await verifyToken(token) : null;
    if (!payload || payload.role !== 'ADMIN') {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { ids } = body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ success: false, error: 'User IDs required' }, { status: 400 });
    }

    // Delete users and all related records (cascade will handle relations)
    const result = await db.user.deleteMany({
      where: { id: { in: ids } },
    });

    return NextResponse.json({
      success: true,
      data: { deleted: result.count },
      message: `${result.count} user(s) deleted from database`,
    });
  } catch (error) {
    console.error('User delete error:', error);
    return NextResponse.json({ success: false, error: 'Failed to delete users' }, { status: 500 });
  }
}

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
    const search = searchParams.get('search') || '';
    const tier = searchParams.get('tier') || '';
    const isActive = searchParams.get('isActive');

    const where: Record<string, unknown> = {};
    if (search) {
      where.OR = [
        { email: { contains: search, mode: 'insensitive' } },
        { name: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (tier) where.tier = tier;
    if (isActive !== null && isActive !== '') where.isActive = isActive === 'true';

    const [users, total] = await Promise.all([
      db.user.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true, name: true, email: true, phone: true, role: true, tier: true,
          virtualCapital: true, isActive: true, twoFactorEnabled: true,
          createdAt: true, updatedAt: true,
          _count: { select: { orders: true, positions: true, trades: true, supportTickets: true } },
        },
      }),
      db.user.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: { users, total, page, limit, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error('Users fetch error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch users' }, { status: 500 });
  }
}

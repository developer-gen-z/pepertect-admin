import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyToken, extractBearerToken } from '@/lib/auth';

/** Verify admin JWT */
async function verifyAdmin(req: NextRequest) {
  const token = extractBearerToken(req.headers.get('authorization'));
  if (!token) return null;
  const payload = await verifyToken(token);
  if (!payload || payload.role !== 'ADMIN') return null;
  return payload;
}

/** GET /api/admin/reviews — All reviews (paginated, filterable) */
export async function GET(req: NextRequest) {
  try {
    const admin = await verifyAdmin(req);
    if (!admin) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20')));
    const status = searchParams.get('status') || '';
    const category = searchParams.get('category') || '';
    const priority = searchParams.get('priority') || '';
    const search = searchParams.get('search') || '';
    const sort = searchParams.get('sort') || 'newest';

    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (category) where.category = category;
    if (priority) where.priority = priority;
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { content: { contains: search, mode: 'insensitive' } },
        { user: { name: { contains: search, mode: 'insensitive' } } },
        { user: { email: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const orderBy = sort === 'oldest'
      ? { createdAt: 'asc' as const }
      : sort === 'rating'
        ? { rating: 'desc' as const }
        : { createdAt: 'desc' as const };

    const [reviews, total] = await Promise.all([
      db.review.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy,
        select: {
          id: true, title: true, content: true, rating: true, category: true,
          status: true, priority: true, helpfulCount: true, screenshotUrl: true,
          bugStatus: true, bugSteps: true, bugExpected: true, bugActual: true,
          featureStatus: true, whyNeeded: true, additionalDetails: true,
          device: true, browser: true, os: true, screenSize: true, ip: true,
          createdAt: true, updatedAt: true,
          user: { select: { id: true, name: true, email: true, avatar: true } },
          replies: { select: { id: true, content: true, createdAt: true }, orderBy: { createdAt: 'asc' } },
          _count: { select: { votes: true } },
        },
      }),
      db.review.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: { items: reviews, total, page, limit, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error('Admin reviews list error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch reviews' }, { status: 500 });
  }
}
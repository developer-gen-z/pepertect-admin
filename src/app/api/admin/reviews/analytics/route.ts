import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyToken, extractBearerToken } from '@/lib/auth';

async function verifyAdmin(req: NextRequest) {
  const token = extractBearerToken(req.headers.get('authorization'));
  if (!token) return null;
  const payload = await verifyToken(token);
  if (!payload || payload.role !== 'ADMIN') return null;
  return payload;
}

/** GET /api/admin/reviews/analytics — Review analytics for admin */
export async function GET(req: NextRequest) {
  try {
    const admin = await verifyAdmin(req);
    if (!admin) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    const [
      total,
      pending,
      approved,
      rejected,
      hidden,
      avgRatingResult,
      ratingDist,
      categoryDist,
      statusDist,
      priorityDist,
      recent7d,
      bugStatusDist,
      featureStatusDist,
      topHelpful,
    ] = await Promise.all([
      db.review.count(),
      db.review.count({ where: { status: 'PENDING' } }),
      db.review.count({ where: { status: 'APPROVED' } }),
      db.review.count({ where: { status: 'REJECTED' } }),
      // FIX: HIDDEN reviews were counted in `total` but in no bucket,
      // so the KPIs didn't sum to the total
      db.review.count({ where: { status: 'HIDDEN' } }),
      db.review.aggregate({ _avg: { rating: true } }),
      db.review.groupBy({ by: ['rating'], _count: { rating: true } }),
      db.review.groupBy({ by: ['category'], _count: { category: true } }),
      db.review.groupBy({ by: ['status'], _count: { status: true } }),
      db.review.groupBy({ by: ['priority'], _count: { priority: true } }),
      db.review.count({ where: { createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } } }),
      db.review.groupBy({ by: ['bugStatus'], where: { bugStatus: { not: null } }, _count: { bugStatus: true } }),
      db.review.groupBy({ by: ['featureStatus'], where: { featureStatus: { not: null } }, _count: { featureStatus: true } }),
      db.review.findMany({ where: { status: 'APPROVED' }, orderBy: { helpfulCount: 'desc' }, take: 5, select: { id: true, title: true, helpfulCount: true, rating: true } }),
    ]);

    const ratingDistribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    for (const r of ratingDist) ratingDistribution[r.rating] = r._count.rating;

    return NextResponse.json({
      success: true,
      data: {
        total,
        pending,
        approved,
        rejected,
        hidden,
        averageRating: avgRatingResult._avg.rating ? Number(avgRatingResult._avg.rating.toFixed(1)) : 0,
        ratingDistribution,
        categoryBreakdown: categoryDist.map(c => ({ category: c.category, count: c._count.category })),
        statusBreakdown: statusDist.map(s => ({ status: s.status, count: s._count.status })),
        priorityBreakdown: priorityDist.map(p => ({ priority: p.priority, count: p._count.priority })),
        bugStatusBreakdown: bugStatusDist.map(b => ({ bugStatus: b.bugStatus, count: b._count.bugStatus })),
        featureStatusBreakdown: featureStatusDist.map(f => ({ featureStatus: f.featureStatus, count: f._count.featureStatus })),
        recent7Days: recent7d,
        topHelpfulReviews: topHelpful,
      },
    });
  } catch (error) {
    console.error('Admin reviews analytics error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch analytics' }, { status: 500 });
  }
}

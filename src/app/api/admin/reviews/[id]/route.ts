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

interface RouteContext {
  params: Promise<{ id: string }>;
}

/** GET /api/admin/reviews/[id] — Single review detail */
export async function GET(req: NextRequest, ctx: RouteContext) {
  try {
    const admin = await verifyAdmin(req);
    if (!admin) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    const { id } = await ctx.params;
    const review = await db.review.findUnique({
      where: { id },
      select: {
        id: true, title: true, content: true, rating: true, category: true,
        status: true, priority: true, helpfulCount: true, screenshotUrl: true,
        bugStatus: true, bugSteps: true, bugExpected: true, bugActual: true,
        featureStatus: true, whyNeeded: true, additionalDetails: true,
        device: true, browser: true, os: true, screenSize: true, ip: true,
        createdAt: true, updatedAt: true,
        user: { select: { id: true, name: true, email: true, avatar: true, tier: true } },
        replies: { select: { id: true, content: true, createdAt: true }, orderBy: { createdAt: 'asc' } },
        _count: { select: { votes: true } },
      },
    });

    if (!review) return NextResponse.json({ success: false, error: 'Review not found' }, { status: 404 });
    return NextResponse.json({ success: true, data: review });
  } catch (error) {
    console.error('Admin review detail error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch review' }, { status: 500 });
  }
}

/** PATCH /api/admin/reviews/[id] — Update review (status, priority, category, bug/feature status) */
export async function PATCH(req: NextRequest, ctx: RouteContext) {
  try {
    const admin = await verifyAdmin(req);
    if (!admin) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    const { id } = await ctx.params;
    const body = await req.json();
    const { status, priority, category, bugStatus, featureStatus } = body;

    const existing = await db.review.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ success: false, error: 'Review not found' }, { status: 404 });

    const updateData: Record<string, unknown> = { updatedAt: new Date() };

    if (status) {
      const validStatuses = ['PENDING', 'APPROVED', 'REJECTED', 'HIDDEN'];
      if (!validStatuses.includes(status)) return NextResponse.json({ success: false, error: 'Invalid status' }, { status: 400 });
      updateData.status = status;
    }
    if (priority) {
      const validPriorities = ['LOW', 'NORMAL', 'HIGH', 'URGENT'];
      if (!validPriorities.includes(priority)) return NextResponse.json({ success: false, error: 'Invalid priority' }, { status: 400 });
      updateData.priority = priority;
    }
    if (category) {
      const validCats = ['GENERAL', 'BUG_REPORT', 'FEATURE_REQUEST'];
      if (!validCats.includes(category)) return NextResponse.json({ success: false, error: 'Invalid category' }, { status: 400 });
      updateData.category = category;
    }
    if (bugStatus) {
      const validBug = ['OPEN', 'INVESTIGATING', 'IN_PROGRESS', 'FIXED', 'CLOSED'];
      if (!validBug.includes(bugStatus)) return NextResponse.json({ success: false, error: 'Invalid bug status' }, { status: 400 });
      updateData.bugStatus = bugStatus;
    }
    if (featureStatus) {
      const validFeature = ['UNDER_CONSIDERATION', 'PLANNED', 'IN_DEVELOPMENT', 'RELEASED'];
      if (!validFeature.includes(featureStatus)) return NextResponse.json({ success: false, error: 'Invalid feature status' }, { status: 400 });
      updateData.featureStatus = featureStatus;
    }

    const review = await db.review.update({
      where: { id },
      data: updateData,
      select: { id: true, status: true, priority: true, category: true, bugStatus: true, featureStatus: true, updatedAt: true },
    });

    // Log activity
    await db.activityLog.create({
      data: {
        userId: existing.userId,
        action: `REVIEW_${(status || '').toUpperCase() || 'UPDATED'}`,
        details: JSON.stringify({ reviewId: id, changes: updateData, adminEmail: admin.email }),
      },
    }).catch(() => {});

    return NextResponse.json({ success: true, data: review, message: 'Review updated' });
  } catch (error) {
    console.error('Admin review update error:', error);
    return NextResponse.json({ success: false, error: 'Failed to update review' }, { status: 500 });
  }
}

/** DELETE /api/admin/reviews/[id] — Delete review */
export async function DELETE(req: NextRequest, ctx: RouteContext) {
  try {
    const admin = await verifyAdmin(req);
    if (!admin) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    const { id } = await ctx.params;
    const existing = await db.review.findUnique({ where: { id }, select: { userId: true } });
    if (!existing) return NextResponse.json({ success: false, error: 'Review not found' }, { status: 404 });

    await db.review.delete({ where: { id } });

    await db.activityLog.create({
      data: {
        userId: existing.userId,
        action: 'REVIEW_DELETED',
        details: JSON.stringify({ reviewId: id, adminEmail: admin.email }),
      },
    }).catch(() => {});

    return NextResponse.json({ success: true, message: 'Review deleted' });
  } catch (error) {
    console.error('Admin review delete error:', error);
    return NextResponse.json({ success: false, error: 'Failed to delete review' }, { status: 500 });
  }
}
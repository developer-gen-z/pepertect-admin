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

/** POST /api/admin/reviews/[id]/reply — Add admin reply */
export async function POST(req: NextRequest, ctx: RouteContext) {
  try {
    const admin = await verifyAdmin(req);
    if (!admin) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    const { id } = await ctx.params;
    const body = await req.json();
    const { content } = body;

    if (!content || typeof content !== 'string' || content.trim().length < 1 || content.trim().length > 1000) {
      return NextResponse.json({ success: false, error: 'Reply must be 1-1000 characters' }, { status: 400 });
    }

    const review = await db.review.findUnique({ where: { id } });
    if (!review) return NextResponse.json({ success: false, error: 'Review not found' }, { status: 404 });

    const reply = await db.reviewReply.create({
      data: {
        reviewId: id,
        content: content.trim(),
      },
    });

    await db.activityLog.create({
      data: {
        userId: review.userId,
        action: 'REVIEW_REPLY_ADDED',
        details: JSON.stringify({ reviewId: id, replyId: reply.id, adminEmail: admin.email }),
      },
    }).catch(() => {});

    return NextResponse.json({ success: true, data: reply, message: 'Reply added' }, { status: 201 });
  } catch (error) {
    console.error('Admin reply error:', error);
    return NextResponse.json({ success: false, error: 'Failed to add reply' }, { status: 500 });
  }
}

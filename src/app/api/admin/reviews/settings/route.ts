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

const REVIEW_SETTING_KEYS = [
  'review_enabled',
  'review_requireApproval',
  'review_allowScreenshots',
  'review_allowHelpfulVotes',
  'review_allowAdminReplies',
  'review_allowBugReports',
  'review_allowFeatureRequests',
  'review_allowUserEdit',
  'review_allowUserDelete',
];

const DEFAULTS: Record<string, string> = {
  review_enabled: 'true',
  review_requireApproval: 'true',
  review_allowScreenshots: 'true',
  review_allowHelpfulVotes: 'true',
  review_allowAdminReplies: 'true',
  review_allowBugReports: 'true',
  review_allowFeatureRequests: 'true',
  review_allowUserEdit: 'true',
  review_allowUserDelete: 'true',
};

/** GET /api/admin/reviews/settings — Get review settings */
export async function GET(req: NextRequest) {
  try {
    const admin = await verifyAdmin(req);
    if (!admin) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    const settings = await db.platformSetting.findMany({
      where: { key: { in: REVIEW_SETTING_KEYS } },
    });

    const result: Record<string, boolean> = {} as unknown as Record<string, boolean>;
    for (const key of REVIEW_SETTING_KEYS) {
      const found = settings.find(s => s.key === key);
      result[key] = found ? found.value === 'true' : DEFAULTS[key] === 'true';
    }

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error('Review settings GET error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch settings' }, { status: 500 });
  }
}

/** PUT /api/admin/reviews/settings — Update review settings */
export async function PUT(req: NextRequest) {
  try {
    const admin = await verifyAdmin(req);
    if (!admin) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const updates: { key: string; value: string }[] = [];

    for (const key of REVIEW_SETTING_KEYS) {
      if (key in body && typeof body[key] === 'boolean') {
        updates.push({ key, value: String(body[key]) });
      }
    }

    if (updates.length === 0) {
      return NextResponse.json({ success: false, error: 'No valid settings to update' }, { status: 400 });
    }

    await Promise.all(
      updates.map(({ key, value }) =>
        db.platformSetting.upsert({
          where: { key },
          update: { value },
          create: { key, value },
        })
      )
    );

    const result: Record<string, boolean> = {} as unknown as Record<string, boolean>;
    for (const key of REVIEW_SETTING_KEYS) {
      const u = updates.find(x => x.key === key);
      if (u) result[key] = u.value === 'true';
    }

    return NextResponse.json({ success: true, data: result, message: 'Settings updated' });
  } catch (error) {
    console.error('Review settings PUT error:', error);
    return NextResponse.json({ success: false, error: 'Failed to update settings' }, { status: 500 });
  }
}

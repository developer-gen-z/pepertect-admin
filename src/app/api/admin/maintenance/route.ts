import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyToken, extractBearerToken } from '@/lib/auth';

/**
 * Maintenance Mode API
 *
 * GET  /api/admin/maintenance  → returns { enabled, message, updatedAt }
 * PUT   /api/admin/maintenance  → body { enabled: boolean, message?: string }
 *
 * Stores state in the shared `platform_settings` table so the main
 * pepertect.vercel.app site (same Supabase DB) can read it.
 */
async function readMaintenance() {
  const rows = await db.platformSetting.findMany({
    where: { key: { in: ['maintenance_enabled', 'maintenance_message'] } },
  });
  const map = new Map(rows.map((r) => [r.key, r.value]));
  return {
    enabled: map.get('maintenance_enabled') === 'true',
    message:
      map.get('maintenance_message') ||
      "We're performing scheduled maintenance to improve your experience. We'll be back shortly!",
    updatedAt: rows[0]?.updatedAt?.toISOString() || null,
  };
}

async function upsertSetting(key: string, value: string) {
  await db.platformSetting.upsert({
    where: { key },
    update: { value },
    create: { key, value },
  });
}

export async function GET() {
  try {
    const data = await readMaintenance();
    return NextResponse.json({ success: true, data });
  } catch (error: unknown) {
    const err = error as any;
    console.error('[maintenance GET] error:', err?.message || error);
    return NextResponse.json(
      { success: false, error: 'Failed to read maintenance status' },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    const token = extractBearerToken(req.headers.get('authorization'));
    const payload = token ? await verifyToken(token) : null;
    if (!payload || payload.role !== 'ADMIN') {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const enabled = Boolean(body.enabled);
    const message =
      typeof body.message === 'string' && body.message.trim().length > 0
        ? body.message.trim().slice(0, 1000)
        : "We're performing scheduled maintenance to improve your experience. We'll be back shortly!";

    await upsertSetting('maintenance_enabled', enabled ? 'true' : 'false');
    await upsertSetting('maintenance_message', message);

    const data = await readMaintenance();
    return NextResponse.json({
      success: true,
      message: enabled
        ? 'Maintenance mode ON — main site now shows maintenance page.'
        : 'Production mode ON — main site is live.',
      data,
    });
  } catch (error: unknown) {
    const err = error as any;
    console.error('[maintenance PUT] error:', err?.message || error);
    return NextResponse.json(
      { success: false, error: 'Failed to update maintenance status' },
      { status: 500 }
    );
  }
}

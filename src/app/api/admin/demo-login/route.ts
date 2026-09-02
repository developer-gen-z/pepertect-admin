import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyToken, extractBearerToken } from '@/lib/auth';

/**
 * Demo Login Toggle API
 *
 * GET  /api/admin/demo-login  → returns { enabled, updatedAt } (admin-auth)
 * PUT  /api/admin/demo-login  → body { enabled: boolean }
 *
 * Stores state in the shared `platform_settings` table so the main
 * website can read it and show/hide the demo login button.
 */
async function readDemoLogin() {
  const row = await db.platformSetting.findUnique({
    where: { key: 'demo_login_enabled' },
  });
  return {
    enabled: !row || row.value === 'true', // default enabled
    updatedAt: row?.updatedAt?.toISOString() || null,
  };
}

async function upsertSetting(key: string, value: string) {
  await db.platformSetting.upsert({
    where: { key },
    update: { value },
    create: { key, value },
  });
}

export async function GET(req: NextRequest) {
  try {
    // FIX: GET previously had NO auth check (every other admin route does)
    const token = extractBearerToken(req.headers.get('authorization'));
    const payload = token ? await verifyToken(token) : null;
    if (!payload || payload.role !== 'ADMIN') {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const data = await readDemoLogin();
    return NextResponse.json({ success: true, data });
  } catch (error: unknown) {
    const err = error as any;
    console.error('[demo-login GET] error:', err?.message || error);
    return NextResponse.json(
      { success: false, error: 'Failed to read demo login status' },
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

    await upsertSetting('demo_login_enabled', enabled ? 'true' : 'false');

    const data = await readDemoLogin();
    return NextResponse.json({
      success: true,
      message: enabled
        ? 'Demo login ON — users can now use demo account on the website.'
        : 'Demo login OFF — demo account option removed from website.',
      data,
    });
  } catch (error: unknown) {
    const err = error as any;
    console.error('[demo-login PUT] error:', err?.message || error);
    return NextResponse.json(
      { success: false, error: 'Failed to update demo login status' },
      { status: 500 }
    );
  }
}

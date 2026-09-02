import { NextRequest, NextResponse } from 'next/server';
import { createToken } from '@/lib/auth';

/**
 * Simple in-memory rate limiter (best-effort on serverless).
 * 5 failed attempts per IP per 10-minute window.
 */
const attempts = new Map<string, { count: number; resetAt: number }>();
const WINDOW_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = attempts.get(ip);
  if (!entry || entry.resetAt < now) {
    attempts.set(ip, { count: 0, resetAt: now + WINDOW_MS });
    return false;
  }
  return entry.count >= MAX_ATTEMPTS;
}

function recordFailure(ip: string): void {
  const now = Date.now();
  const entry = attempts.get(ip);
  if (!entry || entry.resetAt < now) {
    attempts.set(ip, { count: 1, resetAt: now + WINDOW_MS });
  } else {
    entry.count += 1;
  }
}

function clearFailures(ip: string): void {
  attempts.delete(ip);
}

function getClientIp(req: NextRequest): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    'unknown'
  );
}

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);

    if (isRateLimited(ip)) {
      return NextResponse.json(
        { success: false, error: 'Too many attempts. Try again in 10 minutes.' },
        { status: 429 }
      );
    }

    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ success: false, error: 'Email and password required' }, { status: 400 });
    }

    // Credentials MUST be configured via env in production.
    // Previously fell back to admin@pepertect.com / admin123 — publicly loggable.
    const envEmail = process.env.ADMIN_EMAIL;
    const envPassword = process.env.ADMIN_PASSWORD;
    if (process.env.NODE_ENV === 'production' && (!envEmail || !envPassword)) {
      console.error('[admin-auth] ADMIN_EMAIL / ADMIN_PASSWORD env vars are not configured.');
      return NextResponse.json(
        { success: false, error: 'Server misconfiguration — admin credentials not set' },
        { status: 500 }
      );
    }

    const adminEmail = envEmail || 'admin@pepertect.com'; // dev-only fallback
    const adminPassword = envPassword || 'admin123'; // dev-only fallback

    if (email !== adminEmail || password !== adminPassword) {
      recordFailure(ip);
      // Uniform error — never reveal which field was wrong
      return NextResponse.json({ success: false, error: 'Invalid credentials' }, { status: 401 });
    }

    clearFailures(ip);

    const token = await createToken({ userId: 'admin', role: 'ADMIN', email: adminEmail });

    return NextResponse.json({
      success: true,
      token,
      admin: { id: 'admin', email: adminEmail, role: 'ADMIN' },
    });
  } catch (error) {
    console.error('Admin auth error:', error);
    return NextResponse.json({ success: false, error: 'Authentication failed' }, { status: 500 });
  }
}

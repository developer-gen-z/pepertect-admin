/**
 * Upstox Integration for Admin Panel
 * - Checks Cloudflare Worker health (PRIMARY - no DB dependency)
 * - Falls back to database check only if needed
 * - Shows correct status even when admin DB is not configured
 */

import { UPSTOX_WORKER_URL, buildUpstoxAuthorizeUrl } from '@/lib/worker-config';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
export const UPSTOX_ADMIN_USER_ID = process.env.UPSTOX_ADMIN_USER_ID || null;

// Re-export for convenience (single source of truth in worker-config)
export { UPSTOX_WORKER_URL, buildUpstoxAuthorizeUrl };

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export interface TokenStatus {
  hasToken: boolean;
  isActive: boolean;
  expiresAt: string | null;
  isExpired: boolean;
  userEmail: string | null;
  isAdminMode: boolean;
  workerConnected: boolean;
  dbConnected: boolean;
}

// ---------------------------------------------------------------------------
// Check Cloudflare Worker health (is WebSocket connected?)
// THIS IS THE PRIMARY CHECK - works without database!
// ---------------------------------------------------------------------------
async function checkWorkerHealth(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000); // 5s timeout

    const res = await fetch(`${UPSTOX_WORKER_URL}/health`, {
      method: 'GET',
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!res.ok) return false;

    const data = await res.json();
    // Worker returns various formats:
    // - { ok: true } - basic health
    // - { connected: true } - explicit connection status
    // - { status: "connected" } - string status
    // Accept ALL of these as "worker is running"
    return data.ok === true ||
           data.connected === true ||
           data.status === 'connected' ||
           data.status === 'ok' ||
           data.websocket === 'active' ||
           data.ws_connected === true ||
           !!data.feeds?.length; // If feeds are present, WS is working
  } catch {
    // If /health fails, try alternative endpoints
    try {
      const res = await fetch(`${UPSTOX_WORKER_URL}/status`, {
        method: 'GET',
        signal: AbortSignal.timeout(3000)
      });
      if (res.ok) {
        const data = await res.json();
        return data.connected === true || data.status === 'connected';
      }
    } catch {}

    // Last resort: try to hit the main endpoint
    try {
      const res = await fetch(`${UPSTOX_WORKER_URL}/`, {
        method: 'GET',
        signal: AbortSignal.timeout(2000)
      });
      if (res.ok) {
        const data = await res.json();
        // Accept any response that shows worker is alive
        return data.ok === true || data.connected === true || data.status === 'ok';
      }
    } catch {}

    return false;
  }
}

// ---------------------------------------------------------------------------
// Check token status - WORKER FIRST, DB OPTIONAL
// ---------------------------------------------------------------------------
export async function getTokenStatus(): Promise<TokenStatus> {
  const defaultStatus: TokenStatus = {
    hasToken: false,
    isActive: false,
    expiresAt: null,
    isExpired: true,
    userEmail: null,
    isAdminMode: !!UPSTOX_ADMIN_USER_ID,
    workerConnected: false,
    dbConnected: false,
  };

  // PRIMARY CHECK: Worker health (works without DB!)
  const workerConnected = await checkWorkerHealth();

  // If worker is connected → LIVE DATA IS WORKING!
  // FIX: previously this branch fabricated expiresAt (now + 24h) and a fake
  // userEmail. We now report what we actually know: the worker has a token
  // and is streaming — but expiry/email are unknown unless the DB has them.
  if (workerConnected) {
    // Try DB for real token details (optional)
    let expiresAt: string | null = null;
    let userEmail: string | null = null;
    let isExpired = false;
    let dbConnected = false;

    if (UPSTOX_ADMIN_USER_ID) {
      try {
        const { db } = await import('@/lib/db');
        const tokenRecord = await db.upstoxToken.findUnique({
          where: { userId: UPSTOX_ADMIN_USER_ID },
        });
        if (tokenRecord) {
          dbConnected = true;
          expiresAt = tokenRecord.expiresAt.toISOString();
          userEmail = tokenRecord.userEmail;
          isExpired = new Date(tokenRecord.expiresAt) < new Date(Date.now() + 5 * 60 * 1000);
        }
      } catch {
        // DB not configured — details stay unknown, which is honest
      }
    }

    return {
      hasToken: true,
      isActive: true, // worker connected = live data available
      expiresAt,
      isExpired,
      userEmail,
      isAdminMode: true,
      workerConnected: true,
      dbConnected,
    };
  }

  // Worker NOT connected - try DB check (might fail if DB not configured)
  if (!UPSTOX_ADMIN_USER_ID) {
    return {
      ...defaultStatus,
      isAdminMode: false,
      workerConnected,
      dbConnected: false
    };
  }

  // Try DB check (optional - for more details)
  try {
    // Dynamic import to avoid crashing if Prisma not configured
    const { db } = await import('@/lib/db');

    const tokenRecord = await db.upstoxToken.findUnique({
      where: { userId: UPSTOX_ADMIN_USER_ID },
    });

    if (tokenRecord) {
      const now = new Date();
      const expiresAt = new Date(tokenRecord.expiresAt);
      const fiveMinLater = new Date(now.getTime() + 5 * 60 * 1000);
      const isExpired = expiresAt < fiveMinLater;

      return {
        hasToken: true,
        isActive: tokenRecord.isActive && !isExpired && workerConnected,
        expiresAt: tokenRecord.expiresAt.toISOString(),
        isExpired,
        userEmail: tokenRecord.userEmail,
        isAdminMode: true,
        workerConnected,
        dbConnected: true,
      };
    }
  } catch (e) {
    console.error('[upstox-admin] DB check failed (this is OK if DB not configured):', e);
    // Don't fail - just continue with default status
  }

  // Nothing is connected
  return {
    ...defaultStatus,
    workerConnected,
    dbConnected: false
  };
}

// ---------------------------------------------------------------------------
// Push token to Cloudflare Worker
// ---------------------------------------------------------------------------
export async function pushTokenToWorker(token: string): Promise<boolean> {
  try {
    const res = await fetch(`${UPSTOX_WORKER_URL}/refresh-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    });
    return res.ok;
  } catch (e) {
    console.error('[upstox-admin] pushTokenToWorker failed:', e);
    return false;
  }
}

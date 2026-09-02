import { NextRequest, NextResponse } from 'next/server';
import { UPSTOX_WORKER_URL } from '@/lib/worker-config';
import { verifyToken, extractBearerToken } from '@/lib/auth';

/**
 * Proxy endpoint to check Cloudflare Worker health AND WebSocket status.
 *
 * GROUND TRUTH health indicators (in priority order):
 *   1. dataIsFlowing = workerReachable && hasToken && subscribedCount > 0
 *      → Proves real data is reaching website users right now.
 *   2. upstoxReady flag from /stats
 *      → Worker reports WebSocket is open (may lag behind reality).
 *
 * ONLY show "disconnected" when the worker is genuinely unreachable
 * OR has no token AND no active subscriptions whatsoever.
 *
 * Security fix: requires admin auth (was previously public — anyone could
 * probe the infrastructure through this endpoint). The worker URL now also
 * comes from the central worker-config module instead of being hardcoded.
 */
export async function GET(req: NextRequest) {
  try {
    // ── Auth check ──
    const token = extractBearerToken(req.headers.get('authorization'));
    const payload = token ? await verifyToken(token) : null;
    if (!payload || payload.role !== 'ADMIN') {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const baseUrl = UPSTOX_WORKER_URL;

    // ── Step 1: Check if Worker is reachable via /health ──
    let workerReachable = false;
    try {
      const healthRes = await fetch(`${baseUrl}/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(8000),
        headers: { 'Accept': 'application/json' },
      });
      if (healthRes.ok) {
        const healthData = await healthRes.json();
        workerReachable = healthData.ok === true;
      }
    } catch {
      // unreachable — fall through to /stats
    }

    // ── Step 2: Get stats from /stats (ground truth) ──
    let statsData: any = null;
    let upstoxReady = false;
    let upstoxConnecting = false;
    let clientCount = 0;
    let subscribedCount = 0;
    let hasToken = false;

    try {
      const statsRes = await fetch(`${baseUrl}/stats`, {
        method: 'GET',
        signal: AbortSignal.timeout(10000),
        headers: { 'Accept': 'application/json' },
      });

      if (statsRes.ok) {
        statsData = await statsRes.json();
        upstoxReady = statsData.upstoxReady === true;
        upstoxConnecting = statsData.upstoxConnecting === true;
        clientCount = Number(statsData.clientCount) || 0;
        subscribedCount = Number(statsData.subscribedCount) || 0;
        hasToken = statsData.hasToken === true;

        // If /stats responded, the worker IS reachable even if /health failed
        if (!workerReachable) {
          workerReachable = true;
        }
      }
    } catch {
      // both endpoints failed
    }

    // ── HEALTH DETERMINATION ──
    //
    // IMPORTANT: Vercel serverless functions may hit a different Cloudflare edge
    // than the one serving website users, so subscribedCount/clientCount from
    // /stats can be 0 even when data IS flowing to users.
    //
    // Therefore, the PRIMARY signal is: workerReachable + hasToken.
    // If the worker is up and has a valid token, the infrastructure works.
    // subscribedCount > 0 or upstoxReady = true are BONUS confirmations.
    //
    // ONLY show "disconnected" when worker is completely unreachable OR has no token.

    const hasSubscriptions = subscribedCount > 0 ||
      (Array.isArray(statsData?.subscribedKeys) && statsData.subscribedKeys.length > 0);

    // Bonus: data flow confirmed (but NOT required for healthy status)
    const dataFlowConfirmed = workerReachable && hasToken && hasSubscriptions;

    // PRIMARY health: worker reachable + has token = infrastructure is working
    const isHealthy = workerReachable && hasToken;

    // Truly disconnected: worker completely down OR no token at all
    const isTrulyDisconnected = !workerReachable || !hasToken;

    // Determine display status
    let status: string;
    if (isHealthy) {
      status = 'connected';
    } else if (isTrulyDisconnected) {
      status = 'disconnected';
    } else {
      status = 'connecting';
    }

    return NextResponse.json({
      success: true,
      healthy: isHealthy,
      workerReachable,
      upstoxReady,
      dataIsFlowing: dataFlowConfirmed,
      upstoxConnecting,
      hasToken,
      clientCount,
      subscribedCount,
      status,
      data: { stats: statsData },
      checkedAt: new Date().toISOString(),
    }, { status: 200 });

  } catch (error: unknown) {
    const err = error as any;
    console.error('[worker-health] Error:', err?.message || error);
    return NextResponse.json({
      success: false,
      healthy: false,
      workerReachable: false,
      upstoxReady: false,
      dataIsFlowing: false,
      hasToken: false,
      error: err?.message || 'Worker unreachable',
      status: 'error',
      checkedAt: new Date().toISOString(),
    }, { status: 200 });
  }
}

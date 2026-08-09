import { NextResponse } from 'next/server';

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
 */
export async function GET() {
  try {
    const workerUrl = process.env.NEXT_PUBLIC_UPSTOX_WORKER_URL ||
                      process.env.UPSTOX_WORKER_URL ||
                      'https://upstox-realtime.hzero9393.workers.dev';

    const baseUrl = workerUrl.replace(/\/ws$/, '');

    console.log('[worker-health] Checking worker status...', { baseUrl });

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
    } catch (e: any) {
      console.log('[worker-health] /health unreachable:', e?.message || e);
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
          console.log('[worker-health] Worker reachable via /stats (fallback)');
        }

        console.log('[worker-health] Stats:', {
          upstoxReady, hasToken, clientCount, subscribedCount,
          subscribedKeys: Array.isArray(statsData.subscribedKeys) ? statsData.subscribedKeys.length : 0
        });
      }
    } catch (e: any) {
      console.error('[worker-health] /stats failed:', e?.message || e);
    }

    // ── GROUND TRUTH ──
    // Data IS flowing if: worker reachable + has token + active subscriptions
    // subscribedCount > 0 is the definitive proof that data reaches website users
    const dataIsFlowing = workerReachable && hasToken && subscribedCount > 0;

    // Also consider it flowing if there are subscribedKeys (array length > 0)
    // as a secondary check in case subscribedCount is stale
    const hasSubscribedKeys = Array.isArray(statsData?.subscribedKeys) && statsData.subscribedKeys.length > 0;
    const dataFlowingRelaxed = workerReachable && hasToken && hasSubscribedKeys;

    // Use the strongest signal available
    const isActuallyFlowing = dataIsFlowing || dataFlowingRelaxed;

    // Healthy if data is flowing OR worker reports upstoxReady
    const isHealthy = isActuallyFlowing || (workerReachable && upstoxReady);

    // ONLY truly disconnected if worker is completely unreachable
    // OR (no token AND no subscriptions at all)
    const isTrulyDisconnected = !workerReachable || (!hasToken && !isActuallyFlowing);

    // Determine display status
    let status: string;
    if (isHealthy) {
      status = 'connected';
    } else if (upstoxConnecting || (workerReachable && hasToken && !isActuallyFlowing)) {
      // Worker up, has token, but reconnecting or waiting for subscriptions
      status = 'connecting';
    } else if (isTrulyDisconnected) {
      status = 'disconnected';
    } else {
      status = 'connected';
    }

    console.log('[worker-health] Final:', {
      isHealthy, dataIsFlowing, dataFlowingRelaxed,
      isActuallyFlowing, isTrulyDisconnected, status
    });

    return NextResponse.json({
      success: true,
      healthy: isHealthy,
      workerReachable,
      upstoxReady,
      dataIsFlowing: isActuallyFlowing,
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

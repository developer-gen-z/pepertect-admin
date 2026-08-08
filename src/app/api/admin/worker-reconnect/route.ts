import { NextResponse } from 'next/server';
import { verifyToken, extractBearerToken } from '@/lib/auth';

/**
 * POST /api/admin/worker-reconnect
 *
 * Checks REAL Upstox WebSocket connection status via /stats endpoint.
 * If upstoxReady is false, pushes the env UPSTOX_ACCESS_TOKEN to the
 * worker and triggers reconnection.
 */
export async function POST(req: Request) {
  try {
    const token = extractBearerToken(req.headers.get('authorization'));
    const payload = token ? await verifyToken(token) : null;

    if (!payload || payload.role !== 'ADMIN') {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const workerUrl = (process.env.NEXT_PUBLIC_UPSTOX_WORKER_URL ||
                      'https://upstox-realtime.hzero9393.workers.dev').replace(/\/ws$/, '');
    const accessToken = process.env.UPSTOX_ACCESS_TOKEN;

    // ─── Step 1: Check REAL status via /stats ───────────────────────────
    let upstoxReady = false;
    let hasToken = false;
    let workerReachable = false;

    try {
      const statsRes = await fetch(`${workerUrl}/stats`, {
        method: 'GET',
        signal: AbortSignal.timeout(8000),
        headers: { Accept: 'application/json' },
      });
      if (statsRes.ok) {
        const stats = await statsRes.json();
        upstoxReady = stats.upstoxReady === true;
        hasToken = stats.hasToken === true;
        workerReachable = true;
      }
    } catch (e) {
      console.error('[worker-reconnect] /stats failed:', e);
    }

    // If already connected, no action needed
    if (upstoxReady) {
      return NextResponse.json({
        success: true,
        message: '✅ Upstox WebSocket is already connected and streaming live data',
        action: 'none',
        data: { status: 'already_connected', upstoxReady, hasToken },
      });
    }

    // ─── Step 2: Push token to worker ───────────────────────────────────
    if (!accessToken) {
      return NextResponse.json({
        success: false,
        error: 'No Upstox access token configured. Please re-authorize with Upstox.',
        action: 'required_oauth',
        authUrl: `https://api.upstox.com/v2/login/authorization/dialog?response_type=code&client_id=${process.env.UPSTOX_API_KEY || ''}&redirect_uri=${process.env.UPSTOX_REDIRECT_URI || ''}`,
      }, { status: 400 });
    }

    let pushResult = false;
    let pushError = '';

    try {
      const pushRes = await fetch(`${workerUrl}/refresh-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: accessToken }),
        signal: AbortSignal.timeout(10000),
      });
      pushResult = pushRes.ok;
      if (!pushRes.ok) {
        pushError = `Worker returned ${pushRes.status}: ${await pushRes.text()}`;
      }
    } catch (e) {
      pushError = e instanceof Error ? e.message : 'Unknown error';
      console.error('[worker-reconnect] Push failed:', pushError);
    }

    // ─── Step 3: Wait & verify via /stats ───────────────────────────────
    await new Promise((resolve) => setTimeout(resolve, 3000));

    let finalUpstoxReady = false;
    try {
      const finalStatsRes = await fetch(`${workerUrl}/stats`, {
        method: 'GET',
        signal: AbortSignal.timeout(8000),
      });
      if (finalStatsRes.ok) {
        const finalStats = await finalStatsRes.json();
        finalUpstoxReady = finalStats.upstoxReady === true;
      }
    } catch {}

    return NextResponse.json({
      success: finalUpstoxReady,
      message: finalUpstoxReady
        ? '✅ WebSocket reconnected successfully! Live data is now streaming.'
        : pushResult
          ? '⚠️ Token was pushed but Upstox rejected it. The token may be expired — please re-authorize with Upstox.'
          : '❌ Failed to push token to worker.',
      action: finalUpstoxReady ? 'reconnected' : pushResult ? 'token_pushed_but_rejected' : 'failed',
      data: {
        workerReachable,
        wasUpstoxReady: upstoxReady,
        finalUpstoxReady,
        tokenPushed: pushResult,
        hasAccessToken: !!accessToken,
      },
      error: !finalUpstoxReady && !pushResult ? pushError : undefined,
      authUrl: !finalUpstoxReady
        ? `https://api.upstox.com/v2/login/authorization/dialog?response_type=code&client_id=${process.env.UPSTOX_API_KEY || ''}&redirect_uri=${process.env.UPSTOX_REDIRECT_URI || ''}`
        : undefined,
    });
  } catch (error: any) {
    console.error('[worker-reconnect] Error:', error?.message || error);
    return NextResponse.json(
      { success: false, error: 'Failed to reconnect worker', message: error?.message || 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/admin/worker-reconnect
 */
export async function GET(req: Request) {
  try {
    const token = extractBearerToken(req.headers.get('authorization'));
    const payload = token ? await verifyToken(token) : null;

    if (!payload || payload.role !== 'ADMIN') {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const workerUrl = (process.env.NEXT_PUBLIC_UPSTOX_WORKER_URL ||
                      'https://upstox-realtime.hzero9393.workers.dev').replace(/\/ws$/, '');

    let upstoxReady = false;
    let workerReachable = false;
    let hasToken = false;

    try {
      const statsRes = await fetch(`${workerUrl}/stats`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000),
      });
      if (statsRes.ok) {
        const stats = await statsRes.json();
        upstoxReady = stats.upstoxReady === true;
        hasToken = stats.hasToken === true;
        workerReachable = true;
      }
    } catch {}

    const hasAccessToken = !!process.env.UPSTOX_ACCESS_TOKEN;

    return NextResponse.json({
      success: true,
      data: {
        status: upstoxReady ? 'connected' : workerReachable ? 'worker_up_upstox_down' : 'disconnected',
        upstoxReady,
        workerReachable,
        hasToken,
        canReconnect: hasAccessToken,
        hasAccessToken,
        authUrl: `https://api.upstox.com/v2/login/authorization/dialog?response_type=code&client_id=${process.env.UPSTOX_API_KEY || ''}&redirect_uri=${process.env.UPSTOX_REDIRECT_URI || ''}`,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to get status' },
      { status: 500 }
    );
  }
}

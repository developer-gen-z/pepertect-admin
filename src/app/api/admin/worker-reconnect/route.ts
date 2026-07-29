import { NextResponse } from 'next/server';
import { verifyToken, extractBearerToken } from '@/lib/auth';

/**
 * POST /api/admin/worker-reconnect
 * 
 * Allows admin to push Upstox token to Cloudflare Worker and trigger WebSocket reconnection.
 * This is useful when:
 * - Worker's WebSocket connection drops
 * - Token needs to be refreshed on worker side
 * - Admin wants to force reconnect without going through Upstox OAuth flow again
 */
export async function POST(req: Request) {
  try {
    // Verify admin authentication
    const token = extractBearerToken(req.headers.get('authorization'));
    const payload = token ? await verifyToken(token) : null;
    
    if (!payload || payload.role !== 'ADMIN') {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const workerUrl = process.env.NEXT_PUBLIC_UPSTOX_WORKER_URL || 
                      'https://upstox-realtime.hzero9393.workers.dev';
    
    const accessToken = process.env.UPSTOX_ACCESS_TOKEN;

    console.log('[worker-reconnect] Attempting to reconnect WebSocket via Worker...');

    // Step 1: Check worker health first
    let workerHealthy = false;
    try {
      const healthRes = await fetch(`${workerUrl}/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000),
      });
      if (healthRes.ok) {
        const healthData = await healthRes.json();
        workerHealthy = healthData.ok === true || healthData.connected === true;
      }
    } catch (e) {
      console.error('[worker-reconnect] Worker health check failed:', e);
    }

    // If worker is already healthy, no need to reconnect
    if (workerHealthy) {
      return NextResponse.json({
        success: true,
        message: 'Worker is already connected and healthy',
        action: 'none',
        data: { status: 'already_connected' },
      });
    }

    // Step 2: If we have an access token, try to push it to worker
    if (!accessToken) {
      return NextResponse.json({
        success: false,
        error: 'No Upstox access token configured. Please set UPSTOX_ACCESS_TOKEN environment variable.',
        action: 'required_oauth',
        authUrl: `https://api.upstox.com/v2/login/authorization/dialog?response_type=code&client_id=${process.env.UPSTOX_API_KEY || ''}&redirect_uri=${process.env.UPSTOX_REDIRECT_URI || ''}`,
      }, { status: 400 });
    }

    // Step 3: Push token to worker for reconnection
    let pushResult = false;
    let pushError = '';

    try {
      console.log('[worker-reconnect] Pushing token to worker...');
      const pushRes = await fetch(`${workerUrl}/refresh-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: accessToken }),
        signal: AbortSignal.timeout(10000),
      });

      pushResult = pushRes.ok;
      
      if (!pushRes.ok) {
        const errText = await pushRes.text();
        pushError = `Worker returned ${pushRes.status}: ${errText}`;
      }
      
      console.log('[worker-reconnect] Push result:', pushResult ? 'SUCCESS' : 'FAILED');
    } catch (e) {
      pushError = e instanceof Error ? e.message : 'Unknown error';
      console.error('[worker-reconnect] Push failed:', pushError);
    }

    // Step 4: Try to trigger explicit reconnect endpoint (if worker supports it)
    let reconnectResult = false;
    try {
      console.log('[worker-reconnect] Triggering reconnect...');
      const reconnectRes = await fetch(`${workerUrl}/reconnect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ force: true }),
        signal: AbortSignal.timeout(10000),
      });
      reconnectResult = reconnectRes.ok;
      console.log('[worker-reconnect] Reconnect result:', reconnectResult ? 'SUCCESS' : 'NOT SUPPORTED');
    } catch (e) {
      console.log('[worker-reconnect] /reconnect endpoint not available or failed:', e);
      // This is OK - some workers might not have this endpoint
    }

    // Step 5: Verify reconnection worked
    await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2s for worker to connect

    let finalStatus = false;
    try {
      const finalHealthRes = await fetch(`${workerUrl}/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000),
      });
      if (finalHealthRes.ok) {
        const finalData = await finalHealthRes.json();
        finalStatus = finalData.ok === true || finalData.connected === true;
      }
    } catch {}

    return NextResponse.json({
      success: finalStatus || pushResult,
      message: finalStatus 
        ? '✅ WebSocket reconnected successfully!' 
        : pushResult 
          ? 'Token pushed to worker. Worker may take a few seconds to connect...'
          : '❌ Failed to reconnect. You may need to re-authorize with Upstox.',
      action: finalStatus ? 'reconnected' : pushResult ? 'token_pushed' : 'failed',
      data: {
        workerWasHealthy: workerHealthy,
        tokenPushed: pushResult,
        reconnectTriggered: reconnectResult,
        finalHealth: finalStatus,
        hasAccessToken: !!accessToken,
      },
      error: !finalStatus && !pushResult ? pushError : undefined,
    });

  } catch (error: any) {
    console.error('[worker-reconnect] Error:', error?.message || error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to reconnect worker', 
        message: error?.message || 'Unknown error occurred'
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/admin/worker-reconnect
 * Returns current status and available actions
 */
export async function GET(req: Request) {
  try {
    const token = extractBearerToken(req.headers.get('authorization'));
    const payload = token ? await verifyToken(token) : null;
    
    if (!payload || payload.role !== 'ADMIN') {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const workerUrl = process.env.NEXT_PUBLIC_UPSTOX_WORKER_URL || 
                      'https://upstox-realtime.hzero9393.workers.dev';

    // Check current status
    let workerHealthy = false;
    let hasAccessToken = !!process.env.UPSTOX_ACCESS_TOKEN;

    try {
      const healthRes = await fetch(`${workerUrl}/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000),
      });
      if (healthRes.ok) {
        const healthData = await healthRes.json();
        workerHealthy = healthData.ok === true || healthData.connected === true;
      }
    } catch {}

    return NextResponse.json({
      success: true,
      data: {
        status: workerHealthy ? 'connected' : 'disconnected',
        canReconnect: hasAccessToken,
        hasAccessToken,
        actions: [
          ...(hasAccessToken ? ['push_token', 'trigger_reconnect'] : []),
          'check_health',
          ...(hasAccessToken ? [] : ['oauth_required']),
        ],
        endpoints: {
          health: `${workerUrl}/health`,
          refresh: `${workerUrl}/refresh-token`,
          reconnect: `${workerUrl}/reconnect`,
        },
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to get status' },
      { status: 500 }
    );
  }
}

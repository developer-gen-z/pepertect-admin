import { NextResponse } from 'next/server';

/**
 * Proxy endpoint to check Cloudflare Worker health AND WebSocket status
 * 
 * IMPORTANT: Uses /stats endpoint (not /health) because:
 * - /health only returns { ok: true } meaning Worker is RUNNING
 * - /stats returns { upstoxReady: true/false } meaning WS to Upstox is CONNECTED
 * 
 * This gives admin REAL connection status, not just Worker uptime!
 */
export async function GET() {
  try {
    const workerUrl = process.env.NEXT_PUBLIC_UPSTOX_WORKER_URL || 
                      'https://upstox-realtime.hzero9393.workers.dev';
    
    // Use /stats for REAL WebSocket connection status
    const statsUrl = workerUrl.replace(/\/ws$/, '') + '/stats';
    
    console.log('[worker-health] Checking REAL WS status via /stats:', statsUrl);
    
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    
    // Step 1: Check if Worker is reachable
    let workerReachable = false;
    let healthData: any = null;
    
    try {
      const healthRes = await fetch(`${workerUrl.replace(/\/ws$/, '')}/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000),
        headers: { 'Accept': 'application/json' },
      });
      if (healthRes.ok) {
        healthData = await healthRes.json();
        workerReachable = healthData.ok === true;
      }
    } catch (e: any) {
      console.log('[worker-health] Worker unreachable:', e?.message || e);
    }
    
    // Step 2: Get ACTUAL WebSocket status from /stats
    let statsData: any = null;
    let upstoxReady = false;
    let upstoxConnecting = false;
    let clientCount = 0;
    let subscribedCount = 0;
    let hasToken = false;
    
    try {
      const statsRes = await fetch(statsUrl, {
        method: 'GET',
        signal: controller.signal,
        headers: { 'Accept': 'application/json' },
      });
      
      if (statsRes.ok) {
        statsData = await statsRes.json();
        
        // Extract REAL WebSocket status
        upstoxReady = statsData.upstoxReady === true;
        upstoxConnecting = statsData.upstoxConnecting === true;
        clientCount = statsData.clientCount || 0;
        subscribedCount = statsData.subscribedCount || 0;
        hasToken = statsData.hasToken === true;
        
        console.log('[worker-health] Stats:', {
          upstoxReady,
          upstoxConnecting,
          clientCount,
          subscribedCount,
          hasToken,
        });
      }
    } catch (e: any) {
      console.error('[worker-health] /stats failed:', e?.message || e);
    }
    
    clearTimeout(timeout);
    
    // Determine TRUE health status:
    // - Worker must be reachable
    // - AND Upstox WebSocket must be connected (upstoxReady)
    const isHealthy = workerReachable && upstoxReady;
    const isPartiallyHealthy = workerReachable && !upstoxReady && hasToken; // Worker OK but WS down
    
    return NextResponse.json({
      success: true,
      healthy: isHealthy,              // TRUE only if WS is actually connected
      workerReachable,                 // Is Worker server running?
      upstoxReady,                     // Is WS to Upstox connected?
      upstoxConnecting,                // Is WS trying to connect?
      hasToken,                        // Does Worker have valid token?
      clientCount,                     // How many browser clients connected
      subscribedCount,                 // How many instruments subscribed
      status: isHealthy ? 'connected' : upstoxConnecting ? 'connecting' : 'disconnected',
      data: {
        health: healthData,
        stats: statsData,
      },
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
      error: err?.message || 'Worker unreachable',
      status: 'error',
      checkedAt: new Date().toISOString(),
    }, { status: 200 }); // Return 200 so client can handle gracefully
  }
}

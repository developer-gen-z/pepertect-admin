import { NextResponse } from 'next/server';

/**
 * Proxy endpoint to check Cloudflare Worker health
 * Bypasses CORS issues by making server-side request
 */
export async function GET() {
  try {
    const workerUrl = process.env.NEXT_PUBLIC_UPSTOX_WORKER_URL || 
                      'https://upstox-realtime.hzero9393.workers.dev';
    
    const healthUrl = workerUrl.replace(/\/ws$/, '') + '/health';
    
    console.log('[worker-health] Checking:', healthUrl);
    
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    
    const res = await fetch(healthUrl, {
      method: 'GET',
      signal: controller.signal,
      headers: {
        'Accept': 'application/json',
      },
    });
    
    clearTimeout(timeout);
    
    const data = await res.json();
    console.log('[worker-health] Response:', data);
    
    // Determine if worker is healthy
    const isHealthy = res.ok && (
      data.ok === true ||
      data.connected === true ||
      data.status === 'connected' ||
      data.status === 'ok'
    );
    
    return NextResponse.json({
      success: true,
      healthy: isHealthy,
      status: res.status,
      data: data,
      checkedAt: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[worker-health] Error:', error?.message || error);
    return NextResponse.json({
      success: false,
      healthy: false,
      error: error?.message || 'Worker unreachable',
      checkedAt: new Date().toISOString(),
    }, { status: 200 }); // Return 200 even on error so client can handle it
  }
}

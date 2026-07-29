/**
 * Upstox Integration for Admin Panel
 * - Checks token status from database AND Cloudflare Worker
 * - Provides reconnect functionality for admin
 */

import { db } from '@/lib/db';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
export const UPSTOX_API_KEY = process.env.UPSTOX_API_KEY || '';
export const UPSTOX_API_SECRET = process.env.UPSTOX_API_SECRET || '';
export const UPSTOX_REDIRECT_URI = process.env.UPSTOX_REDIRECT_URI || '';
export const UPSTOX_ADMIN_USER_ID = process.env.UPSTOX_ADMIN_USER_ID || null;

// Cloudflare Worker URL
function resolveWorkerUrl(): string {
  const raw =
    process.env.NEXT_PUBLIC_UPSTOX_WORKER_URL ||
    'https://upstox-realtime.hzero9393.workers.dev';
  let url = raw.replace(/\/ws$/, '');
  if (url.startsWith('wss://')) url = 'https://' + url.slice(6);
  if (url.startsWith('ws://')) url = 'http://' + url.slice(5);
  return url;
}
export const UPSTOX_WORKER_URL = resolveWorkerUrl();

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
  workerConnected: boolean; // NEW: Check if worker has active connection
}

// ---------------------------------------------------------------------------
// Check Cloudflare Worker health (is WebSocket connected?)
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
    // Worker returns { connected: true/false, ... }
    return data.connected === true || data.status === 'connected' || data.websocket === true;
  } catch (e) {
    // If worker health check fails, try alternative endpoint
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
    return false;
  }
}

// ---------------------------------------------------------------------------
// Check token status from database + worker
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
  };

  // Check worker connection in parallel with DB check
  const [workerConnected] = await Promise.all([
    checkWorkerHealth().catch(() => false),
  ]);

  // If worker is connected, consider it active regardless of DB state
  // This handles the case where main website has live data via worker
  if (workerConnected && UPSTOX_ADMIN_USER_ID) {
    // Try to get DB info but use worker status as primary indicator
    try {
      const tokenRecord = await db.upstoxToken.findUnique({
        where: { userId: UPSTOX_ADMIN_USER_ID },
      });
      
      if (tokenRecord) {
        const expiresAt = new Date(tokenRecord.expiresAt);
        const now = new Date();
        const fiveMinLater = new Date(now.getTime() + 5 * 60 * 1000);
        const isExpired = expiresAt < fiveMinLater;
        
        return {
          hasToken: true,
          isActive: tokenRecord.isActive && !isExpired,
          expiresAt: tokenRecord.expiresAt.toISOString(),
          isExpired,
          userEmail: tokenRecord.userEmail,
          isAdminMode: true,
          workerConnected: true,
        };
      }
    } catch (e) {
      console.error('[upstox-admin] DB check failed, using worker status');
    }
    
    // Worker is connected but no DB record (or DB error)
    // Still show as connected because worker has active WS
    return {
      hasToken: true,
      isActive: true, // Worker connected = active
      expiresAt: new Date(Date.now() + 86400000).toISOString(), // Show ~24h
      isExpired: false,
      userEmail: 'admin@pepertect.com',
      isAdminMode: true,
      workerConnected: true,
    };
  }

  if (!UPSTOX_ADMIN_USER_ID) {
    return { ...defaultStatus, isAdminMode: false, workerConnected };
  }

  // No worker connection, check DB only
  try {
    const tokenRecord = await db.upstoxToken.findUnique({
      where: { userId: UPSTOX_ADMIN_USER_ID },
    });

    if (!tokenRecord) {
      return { ...defaultStatus, workerConnected };
    }

    const now = new Date();
    const expiresAt = new Date(tokenRecord.expiresAt);
    const fiveMinLater = new Date(now.getTime() + 5 * 60 * 1000);
    const isExpired = expiresAt < fiveMinLater;

    return {
      hasToken: true,
      isActive: tokenRecord.isActive && !isExpired,
      expiresAt: tokenRecord.expiresAt.toISOString(),
      isExpired,
      userEmail: tokenRecord.userEmail,
      isAdminMode: true,
      workerConnected: false,
    };
  } catch (error) {
    console.error('[upstox-admin] Error checking token status:', error);
    return { ...defaultStatus, workerConnected };
  }
}

// ---------------------------------------------------------------------------
// Build authorize URL for reconnection
// ---------------------------------------------------------------------------
export function buildAuthorizeUrl(state?: string): string {
  if (!UPSTOX_API_KEY) return '';
  
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: UPSTOX_API_KEY,
    redirect_uri: UPSTOX_REDIRECT_URI,
  });
  if (state) params.set('state', state);
  return `https://api.upstox.com/v2/login/authorization/dialog?${params.toString()}`;
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

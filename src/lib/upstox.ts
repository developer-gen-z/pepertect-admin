/**
 * Upstox Integration for Admin Panel
 * - Checks token status from database
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
}

// ---------------------------------------------------------------------------
// Check token status from database
// ---------------------------------------------------------------------------
export async function getTokenStatus(): Promise<TokenStatus> {
  const defaultStatus: TokenStatus = {
    hasToken: false,
    isActive: false,
    expiresAt: null,
    isExpired: true,
    userEmail: null,
    isAdminMode: !!UPSTOX_ADMIN_USER_ID,
  };

  if (!UPSTOX_ADMIN_USER_ID) {
    return { ...defaultStatus, isAdminMode: false };
  }

  try {
    const tokenRecord = await db.upstoxToken.findUnique({
      where: { userId: UPSTOX_ADMIN_USER_ID },
    });

    if (!tokenRecord) {
      return defaultStatus;
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
    };
  } catch (error) {
    console.error('[upstox-admin] Error checking token status:', error);
    return defaultStatus;
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

/**
 * Central config for the Upstox realtime Cloudflare Worker.
 * Single source of truth — previously this URL was hardcoded in 6+ files.
 */

export const UPSTOX_WORKER_URL = (() => {
  const raw =
    process.env.NEXT_PUBLIC_UPSTOX_WORKER_URL ||
    'https://upstox-realtime.hzero9393.workers.dev';
  let url = raw.replace(/\/+$/, '').replace(/\/ws$/, '');
  if (url.startsWith('wss://')) url = 'https://' + url.slice(6);
  if (url.startsWith('ws://')) url = 'http://' + url.slice(5);
  return url;
})();

/**
 * Build the Upstox OAuth authorize URL.
 * Server-side only — reads secret env vars.
 * Returns '' when UPSTOX_API_KEY / UPSTOX_REDIRECT_URI are not configured
 * (callers must handle the empty case instead of rendering a broken link).
 */
export function buildUpstoxAuthorizeUrl(): string {
  const clientId = process.env.UPSTOX_API_KEY;
  const redirectUri = process.env.UPSTOX_REDIRECT_URI;
  if (!clientId || !redirectUri) return '';
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: redirectUri,
  });
  return `https://api.upstox.com/v2/login/authorization/dialog?${params.toString()}`;
}

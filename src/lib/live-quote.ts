/**
 * Live Quote Helper for Admin Panel
 *
 * Fetches real-time LTP (Last Traded Price) from the Cloudflare Worker
 * which proxies the Upstox WebSocket feed.  This lets the admin panel
 * show LIVE prices & P&L instead of stale DB values.
 */

// ─── Worker URL ────────────────────────────────────────────────────────────
function getWorkerUrl(): string {
  const raw =
    process.env.NEXT_PUBLIC_UPSTOX_WORKER_URL ||
    'https://upstox-realtime.hzero9393.workers.dev';
  let url = raw.replace(/\/ws$/, '');
  if (url.startsWith('wss://')) url = 'https://' + url.slice(6);
  if (url.startsWith('ws://')) url = 'http://' + url.slice(5);
  return url.replace(/\/+$/, '');
}

// ─── Types ─────────────────────────────────────────────────────────────────
export interface LivePrice {
  instrumentKey: string;
  lastPrice: number;
  // optional extra fields from /quotes endpoint
  open?: number;
  high?: number;
  low?: number;
  close?: number;
  netChange?: number;
  timestamp?: string;
}

type LtpResponse = {
  status: string;
  data?: Record<string, { last_price: number; instrument_token: string }>;
};

type QuotesResponse = {
  status: string;
  data?: Record<
    string,
    {
      last_price: number;
      instrument_token: string;
      ohlc?: { open: number; high: number; low: number; close: number };
      net_change?: number;
      timestamp?: string;
    }
  >;
};

// ─── Batch LTP fetch ───────────────────────────────────────────────────────
/**
 * Fetch LTP for many instrument keys in ONE request.
 * Worker endpoint: GET /ltp?instrument_key=KEY1,KEY2,KEY3
 *
 * Returns a Map<instrumentKey, lastPrice>.
 * Keys that cannot be resolved (expired options etc.) are simply omitted.
 */
export async function batchFetchLtp(
  instrumentKeys: string[]
): Promise<Map<string, number>> {
  const result = new Map<string, number>();
  if (!instrumentKeys.length) return result;

  // Deduplicate & filter
  const unique = [...new Set(instrumentKeys.filter(Boolean))];
  if (!unique.length) return result;

  // Worker accepts comma-separated instrument_key values.
  // URL-encode each key (they contain '|' which must be %7C).
  const encoded = unique.map((k) => encodeURIComponent(k)).join(',');
  const url = `${getWorkerUrl()}/ltp?instrument_key=${encoded}`;

  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) {
      console.error('[live-quote] LTP fetch failed:', res.status, await res.text().catch(() => ''));
      return result;
    }

    const json = (await res.json()) as LtpResponse;
    if (json.status === 'success' && json.data) {
      for (const [, val] of Object.entries(json.data)) {
        // Map by the instrument_token (which is the key we sent in)
        if (val?.instrument_token && typeof val.last_price === 'number') {
          result.set(val.instrument_token, val.last_price);
        }
      }
    }
  } catch (e) {
    console.error('[live-quote] LTP fetch error:', e);
  }

  return result;
}

// ─── Batch full-quote fetch (includes OHLC + net change) ───────────────────
/**
 * Fetch full quotes for many instrument keys.
 * Worker endpoint: GET /quotes?instrument_key=KEY1,KEY2,KEY3
 *
 * Slower than LTP but includes OHLC + net_change — use for Market page.
 */
export async function batchFetchQuotes(
  instrumentKeys: string[]
): Promise<Map<string, LivePrice>> {
  const result = new Map<string, LivePrice>();
  if (!instrumentKeys.length) return result;

  const unique = [...new Set(instrumentKeys.filter(Boolean))];
  if (!unique.length) return result;

  const encoded = unique.map((k) => encodeURIComponent(k)).join(',');
  const url = `${getWorkerUrl()}/quotes?instrument_key=${encoded}`;

  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) {
      console.error('[live-quote] quotes fetch failed:', res.status);
      return result;
    }

    const json = (await res.json()) as QuotesResponse;
    if (json.status === 'success' && json.data) {
      for (const [, val] of Object.entries(json.data)) {
        if (val?.instrument_token && typeof val.last_price === 'number') {
          result.set(val.instrument_token, {
            instrumentKey: val.instrument_token,
            lastPrice: val.last_price,
            open: val.ohlc?.open,
            high: val.ohlc?.high,
            low: val.ohlc?.low,
            close: val.ohlc?.close,
            netChange: val.net_change,
            timestamp: val.timestamp,
          });
        }
      }
    }
  } catch (e) {
    console.error('[live-quote] quotes fetch error:', e);
  }

  return result;
}

// ─── P&L Calculator ────────────────────────────────────────────────────────
/**
 * Calculate unrealised P&L for a position given its live price.
 *
 *  LONG  → (livePrice - avgPrice) * qty
 *  SHORT → (avgPrice - livePrice) * qty
 */
export function calcPnl(
  side: string,
  avgPrice: number,
  livePrice: number,
  qty: number
): { pnl: number; pnlPct: number } {
  if (!livePrice || livePrice <= 0) return { pnl: 0, pnlPct: 0 };
  const direction = side === 'SHORT' ? -1 : 1;
  const pnl = (livePrice - avgPrice) * qty * direction;
  const pnlPct = avgPrice > 0 ? ((livePrice - avgPrice) / avgPrice) * 100 * direction : 0;
  return { pnl, pnlPct };
}

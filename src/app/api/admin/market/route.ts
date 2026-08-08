import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyToken, extractBearerToken } from '@/lib/auth';
import { batchFetchQuotes } from '@/lib/live-quote';
import { getUpstoxKey } from '@/lib/upstox-instruments';

export async function GET(req: NextRequest) {
  try {
    const token = extractBearerToken(req.headers.get('authorization'));
    const payload = token ? await verifyToken(token) : null;
    if (!payload || payload.role !== 'ADMIN') {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const type = searchParams.get('type') || 'stocks';
    const search = searchParams.get('search') || '';
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20')));

    if (type === 'indices') {
      const where: Record<string, unknown> = {};
      if (search) where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { symbol: { contains: search, mode: 'insensitive' } },
      ];

      const [indices, total] = await Promise.all([
        db.index.findMany({ where, skip: (page - 1) * limit, take: limit, orderBy: { name: 'asc' } }),
        db.index.count({ where }),
      ]);

      // ─── Enrich with live quotes ───
      let enrichedIndices = indices;
      if (indices.length > 0) {
        const instrumentKeys = indices
          .map((i) => getUpstoxKey(i.symbol))
          .filter((k): k is string => !!k);
        const liveQuotes = await batchFetchQuotes(instrumentKeys);
        enrichedIndices = indices.map((idx) => {
          const key = getUpstoxKey(idx.symbol);
          const live = key ? liveQuotes.get(key) : undefined;
          if (live) {
            return {
              ...idx,
              lastPrice: live.lastPrice,
              open: live.open ?? idx.open,
              high: live.high ?? idx.high,
              low: live.low ?? idx.low,
              close: live.close ?? idx.close,
              change: live.netChange ?? (live.close ? live.lastPrice - live.close : idx.change),
              changePct: live.close ? ((live.lastPrice - live.close) / live.close) * 100 : idx.changePct,
              updatedAt: new Date(),
            };
          }
          return idx;
        });
      }

      return NextResponse.json({ success: true, data: { items: enrichedIndices, total, page, limit, pages: Math.ceil(total / limit) } });
    }

    // Default: stocks
    const where: Record<string, unknown> = {};
    if (search) where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { symbol: { contains: search, mode: 'insensitive' } },
    ];

    const [stocks, total] = await Promise.all([
      db.stock.findMany({
        where, skip: (page - 1) * limit, take: limit, orderBy: { symbol: 'asc' },
        select: { id: true, symbol: true, name: true, exchange: true, segment: true, sector: true, lotSize: true, ltp: true, change: true, changePct: true, volume: true, open: true, high: true, low: true, close: true, updatedAt: true },
      }),
      db.stock.count({ where }),
    ]);

    // ─── Enrich with live quotes ───
    let enrichedStocks = stocks;
    if (stocks.length > 0) {
      // Resolve each stock's Upstox instrument key
      const keyMap = new Map<string, string>(); // stockId → upstoxKey
      const instrumentKeys: string[] = [];
      for (const s of stocks) {
        const key = getUpstoxKey(s.symbol);
        if (key) {
          keyMap.set(s.id, key);
          instrumentKeys.push(key);
        }
      }

      // Batch-fetch live quotes
      const liveQuotes = await batchFetchQuotes(instrumentKeys);
      enrichedStocks = stocks.map((s) => {
        const key = keyMap.get(s.id);
        const live = key ? liveQuotes.get(key) : undefined;
        if (live) {
          return {
            ...s,
            ltp: live.lastPrice,
            open: live.open ?? s.open,
            high: live.high ?? s.high,
            low: live.low ?? s.low,
            close: live.close ?? s.close,
            change: live.netChange ?? (live.close ? live.lastPrice - live.close : s.change),
            changePct: live.close ? ((live.lastPrice - live.close) / live.close) * 100 : s.changePct,
            updatedAt: new Date(),
          };
        }
        return s;
      });
    }

    return NextResponse.json({ success: true, data: { items: enrichedStocks, total, page, limit, pages: Math.ceil(total / limit) } });
  } catch (error) {
    console.error('Market fetch error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch market data' }, { status: 500 });
  }
}

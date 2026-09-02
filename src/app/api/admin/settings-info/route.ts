import { NextResponse } from 'next/server';
import { verifyToken, extractBearerToken } from '@/lib/auth';
import { UPSTOX_WORKER_URL } from '@/lib/worker-config';
import { db } from '@/lib/db';

/**
 * GET /api/admin/settings-info
 * Returns real platform configuration and status information
 */
export async function GET(req: Request) {
  try {
    const token = extractBearerToken(req.headers.get('authorization'));
    const payload = token ? await verifyToken(token) : null;

    if (!payload || payload.role !== 'ADMIN') {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    // Database info
    let dbStatus = 'unknown';
    let dbConnectionInfo: { provider: string; type: string; pooler?: string } = { provider: 'PostgreSQL', type: 'Supabase' };
    
    try {
      // Test DB connection by counting users
      await db.user.count({ take: 1 });
      dbStatus = 'connected';
      
      // Get connection details from DATABASE_URL
      const dbUrl = process.env.DATABASE_URL || '';
      if (dbUrl.includes('supabase')) {
        dbConnectionInfo = { provider: 'PostgreSQL', type: 'Supabase', pooler: 'pgbouncer' };
      } else if (dbUrl.includes('localhost') || dbUrl.includes('127.0.0.1')) {
        dbConnectionInfo = { provider: 'PostgreSQL', type: 'Local' };
      }
    } catch (e) {
      console.error('[settings-info] DB check failed:', e);
      dbStatus = 'error';
    }

    // User stats
    let userStats = { total: 0, active: 0, premium: 0, free: 0 };
    try {
      const [total, active, premium, free] = await Promise.all([
        db.user.count(),
        db.user.count({ where: { isActive: true } }),
        db.user.count({ where: { tier: 'PREMIUM' } }),
        db.user.count({ where: { tier: 'FREE' } }),
      ]);
      userStats = { total, active, premium, free };
    } catch {}

    // Worker/Market Data status — use /stats for real data flow info
    let workerStatus = 'unknown';
    let workerData: any = null;
    
    try {
      const workerUrl = UPSTOX_WORKER_URL;
      const statsRes = await fetch(`${workerUrl}/stats`, {
        method: 'GET',
        signal: AbortSignal.timeout(8000),
      });
      
      if (statsRes.ok) {
        const stats = await statsRes.json();
        workerData = stats;
        // Real check: hasToken + subscribedCount > 0 = data flowing
        const dataFlowing = stats.hasToken && (stats.subscribedCount || 0) > 0;
        workerStatus = dataFlowing ? 'connected' : (stats.upstoxConnecting ? 'connecting' : 'disconnected');
      } else {
        // Fallback to /health
        try {
          const healthRes = await fetch(`${workerUrl}/health`, {
            method: 'GET',
            signal: AbortSignal.timeout(5000),
          });
          if (healthRes.ok) {
            const data = await healthRes.json();
            workerStatus = data.ok === true ? 'connected' : 'disconnected';
            workerData = data;
          } else {
            workerStatus = 'disconnected';
          }
        } catch {
          workerStatus = 'disconnected';
        }
      }
    } catch {
      workerStatus = 'disconnected';
    }

    // Upstox Token info
    let upstoxTokenStatus = 'unknown';
    let tokenExpiry: string | null = null;
    
    try {
      const accessToken = process.env.UPSTOX_ACCESS_TOKEN;
      if (accessToken) {
        // Decode JWT to get expiry
        // FIX: Upstox tokens use base64url encoding ('-'/'_' chars, no padding)
        // which atob() cannot decode — normalize to standard base64 first.
        const parts = accessToken.split('.');
        if (parts.length === 3) {
          try {
            const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
            const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
            const payload = JSON.parse(Buffer.from(padded, 'base64').toString('utf-8'));
            if (payload.exp) {
              tokenExpiry = new Date(payload.exp * 1000).toISOString();
              upstoxTokenStatus = new Date(payload.exp * 1000) > new Date() ? 'valid' : 'expired';
            }
          } catch {
            // Undecodable payload — don't assume valid, stay unknown
          }
        }
      } else {
        upstoxTokenStatus = 'not_configured';
      }
    } catch {
      upstoxTokenStatus = 'error';
    }

    // Platform info
    const platformInfo = {
      name: process.env.NEXT_PUBLIC_APP_NAME || 'Pepertect',
      url: process.env.NEXT_PUBLIC_APP_URL || 'https://pepertect.vercel.app',
      framework: 'Next.js 16',
      runtime: 'Node.js 20.x',
      hosting: 'Vercel',
      environment: process.env.NODE_ENV || 'production',
    };

    // Security info
    const securityInfo = {
      authMethod: 'JWT (HS256)',
      // FIX: report the ACTUAL expiry (single source of truth with lib/auth.ts).
      // Previously hard-reported "24 hours" while tokens actually lasted 365 days.
      tokenExpiry: process.env.JWT_EXPIRES_IN || '7d',
      adminAuth: 'Environment Credentials',
      jwtSecretConfigured: !!process.env.JWT_SECRET,
    };

    return NextResponse.json({
      success: true,
      data: {
        database: {
          status: dbStatus,
          ...dbConnectionInfo,
          ...userStats,
        },
        security: securityInfo,
        deployment: platformInfo,
        marketData: {
          provider: 'Upstox WebSocket',
          exchanges: ['NSE', 'BSE'],
          segments: ['EQUITY', 'F&O'],
          workerStatus,
          workerData,
          tokenStatus: upstoxTokenStatus,
          tokenExpiry,
        },
        timestamps: {
          checkedAt: new Date().toISOString(),
          serverTime: new Date().toISOString(),
        },
      },
    });

  } catch (error: any) {
    console.error('[settings-info] Error:', error?.message || error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch settings info' },
      { status: 500 }
    );
  }
}

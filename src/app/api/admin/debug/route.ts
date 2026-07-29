import { NextResponse } from 'next/server';
import { verifyToken, extractBearerToken } from '@/lib/auth';
import { db } from '@/lib/db';

export async function GET(req: Request) {
  try {
    const token = extractBearerToken(req.headers.get('authorization'));
    const payload = token ? await verifyToken(token) : null;
    
    if (!payload || payload.role !== 'ADMIN') {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    // Test database connectivity
    const dbTest = await testDatabaseConnection();
    
    return NextResponse.json({
      success: true,
      data: {
        timestamp: new Date().toISOString(),
        environment: {
          nodeEnv: process.env.NODE_ENV,
          hasDbUrl: !!process.env.DATABASE_URL,
          dbUrlPrefix: process.env.DATABASE_URL?.substring(0, 30) + '...',
          hasAdminUserId: !!process.env.UPSTOX_ADMIN_USER_ID,
          adminUserId: process.env.UPSTOX_ADMIN_USER_ID?.substring(0, 20) + '...',
        },
        database: dbTest,
      },
    });
  } catch (error: any) {
    console.error('Debug endpoint error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Debug failed' },
      { status: 500 }
    );
  }
}

async function testDatabaseConnection() {
  try {
    // Try basic queries
    const userCount = await db.user.count();
    const orderCount = await db.order.count();
    const positionCount = await db.position.count();
    
    // Get sample users
    const recentUsers = await db.user.findMany({
      take: 3,
      select: { id: true, email: true, name: true, role: true, createdAt: true },
      orderBy: { createdAt: 'desc' }
    });
    
    // Check for upstox tokens
    const tokenCount = await db.upstoxToken.count();
    const tokens = await db.upstoxToken.findMany({
      take: 2,
      select: { userId: true, isActive: true, expiresAt: true, userEmail: true }
    });
    
    return {
      connected: true,
      counts: {
        users: userCount,
        orders: orderCount,
        positions: positionCount,
        upstoxTokens: tokenCount,
      },
      recentUsers,
      upstoxTokens: tokens,
    };
  } catch (error: any) {
    return {
      connected: false,
      error: error.message || String(error),
    };
  }
}

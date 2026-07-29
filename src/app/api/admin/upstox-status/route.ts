import { NextResponse } from 'next/server';
import { verifyToken, extractBearerToken } from '@/lib/auth';
import { getTokenStatus } from '@/lib/upstox';

export async function GET(req: Request) {
  try {
    const token = extractBearerToken(req.headers.get('authorization'));
    const payload = token ? await verifyToken(token) : null;
    
    if (!payload || payload.role !== 'ADMIN') {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    // Get token status (worker-first, DB optional)
    const status = await getTokenStatus();
    
    return NextResponse.json({
      success: true,
      data: status,
    });
  } catch (error: any) {
    console.error('[upstox-status] Error:', error?.message || error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to check Upstox status',
        // Return a safe default so UI doesn't break
        data: {
          hasToken: false,
          isActive: false,
          expiresAt: null,
          isExpired: true,
          userEmail: null,
          isAdminMode: true,
          workerConnected: false,
          dbConnected: false,
        }
      },
      { status: 500 }
    );
  }
}

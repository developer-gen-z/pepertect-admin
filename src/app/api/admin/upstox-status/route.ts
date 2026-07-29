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

    const status = await getTokenStatus();
    
    return NextResponse.json({
      success: true,
      data: status,
    });
  } catch (error) {
    console.error('Upstox status check error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to check Upstox status' },
      { status: 500 }
    );
  }
}

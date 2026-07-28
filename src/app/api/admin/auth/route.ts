import { NextRequest, NextResponse } from 'next/server';
import { createToken } from '@/lib/auth';
import bcrypt from 'bcryptjs';

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ success: false, error: 'Email and password required' }, { status: 400 });
    }

    const adminEmail = process.env.ADMIN_EMAIL || 'admin@pepertect.com';
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';

    if (email !== adminEmail) {
      return NextResponse.json({ success: false, error: 'Invalid credentials' }, { status: 401 });
    }

    const isValid = password === adminPassword || await bcrypt.compare(password, await bcrypt.hash(adminPassword, 1)).catch(() => false);
    if (!isValid) {
      return NextResponse.json({ success: false, error: 'Invalid credentials' }, { status: 401 });
    }

    const token = await createToken({ userId: 'admin', role: 'ADMIN', email: adminEmail });

    return NextResponse.json({
      success: true,
      token,
      admin: { id: 'admin', email: adminEmail, role: 'ADMIN' },
    });
  } catch (error) {
    console.error('Admin auth error:', error);
    return NextResponse.json({ success: false, error: 'Authentication failed' }, { status: 500 });
  }
}

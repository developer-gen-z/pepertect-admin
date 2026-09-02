import { SignJWT, jwtVerify } from 'jose';

let cachedSecret: Uint8Array | null = null;

/**
 * JWT secret — REQUIRED in production.
 * Previously fell back to a hardcoded secret committed to the repo, which
 * let anyone forge admin tokens. Now: throw in production, warn in dev.
 */
function getJwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        'JWT_SECRET environment variable is required in production. ' +
        'Generate one with: openssl rand -base64 32'
      );
    }
    console.warn(
      '[auth] JWT_SECRET not set — using insecure dev fallback. ' +
      'Set JWT_SECRET in .env before deploying!'
    );
    return new TextEncoder().encode('pepertect-dev-only-insecure-fallback');
  }
  return new TextEncoder().encode(secret);
}

function jwtSecret(): Uint8Array {
  if (!cachedSecret) cachedSecret = getJwtSecret();
  return cachedSecret;
}

/** Token expiry from env. Default 7d (was 365d — "effectively permanent" is unsafe). */
export function tokenExpiry(): string {
  return process.env.JWT_EXPIRES_IN || '7d';
}

export async function createToken(payload: { userId: string; role: string; email: string }): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime(tokenExpiry())
    .setIssuedAt()
    .sign(jwtSecret());
}

export async function verifyToken(token: string) {
  try {
    const { payload } = await jwtVerify(token, jwtSecret());
    return payload as { userId: string; role: string; email: string; iat: number; exp: number };
  } catch {
    return null;
  }
}

export function extractBearerToken(authHeader: string | null): string | null {
  if (!authHeader) return null;
  const parts = authHeader.split(' ');
  return parts.length === 2 && parts[0] === 'Bearer' ? parts[1] : null;
}

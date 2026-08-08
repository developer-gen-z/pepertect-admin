import { useAuthStore } from '@/stores/useAuthStore';

/**
 * Shared fetch wrapper for admin API calls.
 *
 * Automatically:
 *  - Attaches the JWT Authorization header from the auth store
 *  - Detects 401 / "Unauthorized" responses (expired or invalid token)
 *  - On expired session: clears stale auth state and redirects to /login
 *    so the user never sees a silently-empty dashboard full of zeros.
 */
export async function adminFetch<T = any>(url: string, options: RequestInit = {}): Promise<T> {
  const token = useAuthStore.getState().token;

  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...(options.headers as Record<string, string> | undefined),
  };
  if (token && !headers.Authorization) {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(url, { ...options, headers });

  // Try to parse JSON (API always returns JSON)
  let data: any = null;
  try {
    data = await res.json();
  } catch {
    data = { success: false, error: `Invalid response (${res.status})` };
  }

  // Auto-logout on 401 — token expired or invalid
  if (res.status === 401 || (!data.success && data.error === 'Unauthorized')) {
    console.warn('[adminFetch] Session expired (401). Clearing auth & redirecting to /login');
    useAuthStore.getState().logout();
    if (typeof window !== 'undefined') {
      window.location.href = '/login?reason=expired';
    }
    throw new Error('Session expired');
  }

  return data as T;
}

'use client';

import { useEffect } from 'react';
import { rehydrateAuth } from '@/stores/useAuthStore';

/**
 * Rehydrates the persisted auth store AFTER mount.
 * Rendered once in the root layout — makes the store SSR-safe
 * (server HTML and client first render always agree).
 */
export default function AuthProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    rehydrateAuth();
  }, []);

  return <>{children}</>;
}

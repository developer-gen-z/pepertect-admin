'use client';

import { useEffect } from 'react';
import { useAuthStore, useAuthHydration } from '@/stores/useAuthStore';
import { useRouter } from 'next/navigation';

export default function Home() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const hydrated = useAuthHydration();
  const router = useRouter();

  // Wait for store rehydration before deciding — otherwise a logged-in
  // admin gets bounced to /login on every hard refresh.
  useEffect(() => {
    if (!hydrated) return;
    if (isAuthenticated) {
      router.replace('/dashboard');
    } else {
      router.replace('/login');
    }
  }, [isAuthenticated, hydrated, router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg-base">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-primary border-t-transparent" />
    </div>
  );
}

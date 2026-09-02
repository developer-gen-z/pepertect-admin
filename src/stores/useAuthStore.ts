import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

interface AdminUser {
  id: string;
  email: string;
  role: string;
}

interface AuthState {
  admin: AdminUser | null;
  token: string | null;
  isAuthenticated: boolean;
  _hydrated: boolean; // Internal flag for hydration state
  login: (admin: AdminUser, token: string) => void;
  logout: () => void;
  setHydrated: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      admin: null,
      token: null,
      isAuthenticated: false,
      _hydrated: false,
      login: (admin, token) => set({ admin, token, isAuthenticated: true }),
      logout: () => set({ admin: null, token: null, isAuthenticated: false }),
      setHydrated: () => set({ _hydrated: true }),
    }),
    {
      name: 'pepertect-admin-auth',
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({
        admin: s.admin,
        token: s.token,
        isAuthenticated: s.isAuthenticated
      }),
      // SSR-safety fix: previously the store rehydrated synchronously at import
      // time, so the client's first render (authenticated) mismatched the
      // server-rendered HTML (loading spinner) → React hydration errors.
      // With skipHydration we rehydrate manually AFTER mount (see AuthProvider).
      skipHydration: true,
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.setHydrated();
        }
      },
    }
  )
);

/** Manually rehydrate persisted auth state (client-only, after mount). */
export function rehydrateAuth() {
  if (typeof window !== 'undefined') {
    void useAuthStore.persist.rehydrate();
  }
}

// Hook to check if auth store has hydrated
export function useAuthHydration() {
  const _hydrated = useAuthStore((s) => s._hydrated);
  return _hydrated;
}

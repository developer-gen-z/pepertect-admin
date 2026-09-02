import { useSyncExternalStore } from 'react';

const emptySubscribe = () => () => {};

/**
 * SSR-safe "has mounted" check — the React-recommended way
 * (useSyncExternalStore) instead of setState-in-effect.
 * Returns false during SSR/first paint, true after hydration.
 */
export function useMounted(): boolean {
  return useSyncExternalStore(emptySubscribe, () => true, () => false);
}

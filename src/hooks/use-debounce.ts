import { useEffect, useState } from 'react';

/**
 * Debounce a rapidly-changing value (e.g. search input keystrokes).
 * Prevents firing an API request on every keypress.
 */
export function useDebounce<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);

  return debounced;
}

'use client';

import { useCallback, useSyncExternalStore } from 'react';

/**
 * Track a CSS media query from JavaScript.
 *
 * For anything expressible in CSS, use a Tailwind breakpoint prefix instead —
 * this exists for the cases where a *prop* has to change, not a class. The
 * drawer is the one such case: which edge it opens from is a vaul prop.
 *
 * `useSyncExternalStore` rather than `useState` + `useEffect`, because the
 * match is external state that React should subscribe to, not state to
 * assign after the fact. It also gives the server snapshot its own answer —
 * `false`, so the mobile treatment is what renders without JavaScript.
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const media = window.matchMedia(query);
      media.addEventListener('change', onChange);
      return () => media.removeEventListener('change', onChange);
    },
    [query],
  );

  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false,
  );
}

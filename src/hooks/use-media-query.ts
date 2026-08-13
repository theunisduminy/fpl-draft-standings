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
      const media = mediaQuery(query);
      media.addEventListener('change', onChange);
      return () => media.removeEventListener('change', onChange);
    },
    [query],
  );

  return useSyncExternalStore(
    subscribe,
    () => mediaQuery(query).matches,
    () => false,
  );
}

/**
 * One `MediaQueryList` per query string, for the life of the page.
 *
 * React calls the snapshot on every render, and `matchMedia` allocates a fresh
 * object each time — so without this a component that renders often builds a
 * new one every pass, and two components asking the same question keep two.
 */
const cache = new Map<string, MediaQueryList>();

function mediaQuery(query: string): MediaQueryList {
  const existing = cache.get(query);
  if (existing) return existing;

  const media = window.matchMedia(query);
  cache.set(query, media);
  return media;
}

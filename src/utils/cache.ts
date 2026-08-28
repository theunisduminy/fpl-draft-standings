import { unstable_cache } from 'next/cache';

import { TIMED_OUT, withDeadline } from './deadline';

// Simple in-memory cache with TTL for API route responses
// Keys are strings, values are { data: T, expiresAt: number }

const cache = new Map<string, { data: unknown; expiresAt: number }>();

export function getCache<T>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return entry.data as T;
}

export function setCache<T>(key: string, data: T, ttlSeconds: number): void {
  cache.set(key, {
    data,
    expiresAt: Date.now() + ttlSeconds * 1000,
  });
}

/**
 * A read cached at both levels that matter on a serverless host.
 *
 * 1. **Next's Data Cache** — shared between instances and outliving them, so a
 *    cold instance does not re-pay the upstream and database round trips.
 * 2. **The in-memory map above** — per process, and worth keeping in front of
 *    it: a Data Cache hit measured ~190ms against ~10ms from memory.
 * 3. **Promise dedup** — concurrent callers on one instance share a single
 *    computation rather than each starting their own, bounded by
 *    `ADOPTED_DEADLINE_MS` so that a computation abandoned by the request that
 *    started it cannot pin every later one behind it.
 *
 * Both domains that need this were wiring up the same three layers by hand,
 * which is how their TTLs drift apart. Revalidate early with
 * `revalidateTag(key, 'max')`; Next 16 requires that second argument, and
 * `'max'` serves the stale value while the fresh one computes.
 */
export function cachedRead<T>(
  key: string,
  ttlSeconds: number,
  compute: () => Promise<T>,
): () => Promise<T> {
  // Both caches are keyed on `key` alone, not on anything derived from
  // `compute`, so editing the computation does **not** invalidate them. In
  // production that is exactly right — the same code runs for the whole TTL.
  // In development it means an edit to the data layer is invisible until the
  // window expires or `.next` is deleted, which cost real debugging time here:
  // a fix to `total_points` looked like it had not worked, because the cache
  // was replaying a value computed before it.
  //
  // So development recomputes every time. A cold read is ~2s locally, which is
  // a fair price for "the code I just wrote is the code that runs".
  if (process.env.NODE_ENV !== 'production') {
    return compute;
  }

  const readShared = unstable_cache(compute, [key], {
    revalidate: ttlSeconds,
    tags: [key],
  });

  let pending: Promise<T> | null = null;

  // `clearCache` empties the map, but the dedup slot is checked immediately
  // after it — so without this a caller's in-flight *pre-sync* computation
  // survives the clear, gets adopted by whoever asks next, and is written back
  // for the full TTL. Registering the reset lets `clearCache` drop both layers.
  resets.set(key, () => {
    pending = null;
  });

  return async function read(): Promise<T> {
    const cached = getCache<T>(key);
    if (cached) return cached;

    // Adopting the in-flight computation is the fast path, and it is the one
    // that has to be defended: the caller who started it is a *different
    // request*, and once that request ends the instance freezes with the
    // promise still pending. Waiting on it unconditionally is unbounded, so a
    // discarded `<Link>` prefetch could leave the next reader on that instance
    // staring at a skeleton with no error and a 200 in the log. See
    // `withDeadline`.
    if (pending) {
      const adopted = pending;
      const result = await withDeadline(adopted, ADOPTED_DEADLINE_MS);

      if (result !== TIMED_OUT) return result;

      // Nothing is coming. Clear the slot — unless somebody has already
      // replaced it — so the next caller does not adopt it too, and do the
      // work here instead.
      if (pending === adopted) pending = null;
    }

    pending = readShared().then((value) => {
      setCache(key, value, ttlSeconds);
      return value;
    });

    try {
      return await pending;
    } finally {
      pending = null;
    }
  };
}

/**
 * How long to wait on a computation another request started before giving up
 * on it and doing the work again.
 *
 * Sized against the slowest honest read in the app, not the fastest: a cold
 * season is up to 344 upstream calls, each now bounded at ten seconds by
 * `upstreamSignal`. Fifteen seconds is comfortably past a real one and
 * comfortably short of forever, which is what the alternative was. Paying for
 * one duplicate computation is the cheap side of this trade; the expensive side
 * is a page that never loads again until the instance recycles.
 */
const ADOPTED_DEADLINE_MS = 15_000;

/** Per-key hooks that drop an in-flight computation. See `cachedRead`. */
const resets = new Map<string, () => void>();

/**
 * Drop cached values — **both** layers this module owns.
 *
 * The in-flight promise matters as much as the map: the sync job clears in
 * order to force a recompute against freshly written tables, and a pending
 * promise started before the write would quietly serve the old answer and
 * re-pin it.
 */
export function clearCache(key?: string): void {
  if (key) {
    cache.delete(key);
    resets.get(key)?.();
  } else {
    cache.clear();
    resets.forEach((reset) => reset());
  }
}

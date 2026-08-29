import { cache as perRequest } from 'react';
import { unstable_cache } from 'next/cache';

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
 * 3. **Promise dedup, scoped to one request** — concurrent callers *inside a
 *    single render* share one computation instead of each starting their own.
 *    Never across requests; see `requestToken`.
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

  let pending: { owner: symbol; run: Promise<T> } | null = null;

  // `clearCache` empties the map, but the dedup slot is checked immediately
  // after it — so without this a caller's in-flight *pre-sync* computation
  // survives the clear, gets adopted by whoever asks next, and is written back
  // for the full TTL. Registering the reset lets `clearCache` drop both layers.
  // It is also what makes the sync job's clear-then-warm work: the warm runs in
  // the same request as the clear, so a dedup slot that survived it would hand
  // the warm the value the clear had just thrown away.
  resets.set(key, () => {
    pending = null;
  });

  return async function read(): Promise<T> {
    const cached = getCache<T>(key);
    if (cached) return cached;

    const owner = requestToken();

    // Only ever adopt a computation this same request started. The slot is
    // module-level and therefore outlives the request that filled it, and a
    // promise from a request that has ended is not a shortcut — it is a
    // promise that will never settle. See `requestToken`.
    if (pending && pending.owner === owner) return pending.run;

    const started = {
      owner,
      run: readShared().then((value) => {
        setCache(key, value, ttlSeconds);
        return value;
      }),
    };

    pending = started;

    try {
      return await started.run;
    } finally {
      // Only if it is still ours: a slot dropped by `clearCache` and refilled
      // by a later caller must not be cleared by this one.
      if (pending === started) pending = null;
    }
  };
}

/**
 * A token identifying the request currently being served, used to decide
 * whether an in-flight computation is safe to share.
 *
 * **The whole bug this exists to stop.** A serverless instance is frozen the
 * moment its request ends, so a promise created by one request neither
 * continues nor rejects once that request is gone — it simply never settles.
 * Every link in the nav is prefetched in one burst, and a prefetch the browser
 * then discards ends its request mid-computation. A later reader that adopted
 * that computation inherited something already dead: first as a page pinned on
 * its loading skeleton forever, then — once every upstream read carried a
 * timeout — as the same page failing with "the feed could not be reached" ten
 * seconds after the click, while a reload beside it loaded instantly.
 *
 * A deadline was the first attempt and it was the wrong instrument: it bounded
 * how long the reader waited to find out, rather than stopping it waiting on a
 * corpse. Sharing has to be scoped to the request instead, which is exactly
 * what React's `cache` does — one value per request, and, crucially, **a fresh
 * one when there is no request scope at all** (it calls straight through when
 * React's dispatcher is absent). So a caller outside a render, such as the
 * cron route, gets a token nobody else can match and always does its own work,
 * which is the safe default rather than a special case.
 */
const requestToken = perRequest(() => Symbol('request'));

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

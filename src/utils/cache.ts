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
 * 3. **Promise dedup** — concurrent callers on one instance share a single
 *    computation rather than each starting their own.
 *
 * Both domains that need this were wiring up the same three layers by hand,
 * which is how their TTLs drift apart. Revalidate early with
 * `revalidateTag(key)`.
 */
export function cachedRead<T>(
  key: string,
  ttlSeconds: number,
  compute: () => Promise<T>,
): () => Promise<T> {
  const readShared = unstable_cache(compute, [key], {
    revalidate: ttlSeconds,
    tags: [key],
  });

  let pending: Promise<T> | null = null;

  return async function read(): Promise<T> {
    const cached = getCache<T>(key);
    if (cached) return cached;

    if (pending) return pending;

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

export function clearCache(key?: string): void {
  if (key) {
    cache.delete(key);
  } else {
    cache.clear();
  }
}

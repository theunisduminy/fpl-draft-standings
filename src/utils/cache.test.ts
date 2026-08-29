import { afterEach, describe, expect, it, vi } from 'vitest';

// `cachedRead` layers Next's Data Cache over its own map. The Data Cache is not
// what is under test here — sharing is — so it is replaced with a pass-through.
vi.mock('next/cache', () => ({
  unstable_cache: <T>(fn: () => Promise<T>) => fn,
}));

const { cachedRead, clearCache } = await import('./cache');

/**
 * The production path is the one with the dedup slot in it: outside production
 * `cachedRead` returns the raw computation, so none of this exists to test.
 * The flag is read when `cachedRead` is called, so it is stubbed per test.
 */
function productionRead<T>(key: string, compute: () => Promise<T>) {
  vi.stubEnv('NODE_ENV', 'production');

  const read = cachedRead(key, 60, compute);

  vi.unstubAllEnvs();

  return read;
}

afterEach(() => {
  clearCache();
  vi.unstubAllEnvs();
});

describe('cachedRead', () => {
  it('serves the second caller from the value cache', async () => {
    const compute = vi.fn(async () => 'season');
    const read = productionRead('hit', compute);

    await expect(read()).resolves.toBe('season');
    await expect(read()).resolves.toBe('season');
    expect(compute).toHaveBeenCalledTimes(1);
  });

  /**
   * The regression that cost two deploys. A computation started by one request
   * and abandoned when that request ended is a promise that will never settle —
   * a serverless instance freezes the moment its request is over. The next
   * caller must start its own, not queue behind a corpse.
   *
   * There is no React request scope in a test, so `requestToken` hands out a
   * fresh token every call: exactly the "nobody may adopt this" case, and the
   * behaviour every caller outside a render gets.
   */
  it('does not wait on a computation abandoned by an earlier caller', async () => {
    let call = 0;
    const compute = vi.fn(() => {
      call += 1;
      // The first caller's work never settles, like a discarded prefetch's.
      return call === 1
        ? new Promise<string>(() => {})
        : Promise.resolve('table');
    });

    const read = productionRead('abandoned', compute);

    // Started and deliberately never awaited to completion — the request that
    // owns it has, in effect, gone away.
    void read();

    await expect(read()).resolves.toBe('table');
    expect(compute).toHaveBeenCalledTimes(2);
  });

  it('recomputes after clearCache, which is what the sync job relies on', async () => {
    const compute = vi.fn(async () => 'fresh');
    const read = productionRead('cleared', compute);

    await read();
    clearCache('cleared');
    await read();

    expect(compute).toHaveBeenCalledTimes(2);
  });

  it('does not cache a rejection', async () => {
    const compute = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new Error('Pulse is down'))
      .mockResolvedValueOnce('recovered');

    const read = productionRead('rejects', compute);

    await expect(read()).rejects.toThrow('Pulse is down');
    await expect(read()).resolves.toBe('recovered');
  });
});

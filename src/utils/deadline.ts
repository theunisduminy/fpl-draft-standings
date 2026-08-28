/**
 * Wait on a promise somebody else started, but never forever.
 *
 * **This exists because a serverless instance freezes between invocations.**
 * A promise created while rendering one request keeps running only as long as
 * that request does; the moment it finishes — or the browser cancels it, which
 * is what a discarded `<Link>` prefetch is — the platform suspends the process
 * and the sockets underneath that promise are gone. The promise itself is not
 * rejected. It simply never settles.
 *
 * That matters because two module-level memos in this app deliberately share an
 * in-flight computation between callers, and callers on a warm instance are
 * different requests. Adopting a promise from a request that has already ended
 * is how a page gets pinned in its loading skeleton for the life of the
 * instance, with no error, no log line and a 200 in the access log. A reload
 * lands on another instance and works, which is exactly what makes it look like
 * a browser problem rather than a server one.
 *
 * So an adopted promise gets a deadline. Past it the caller stops waiting and
 * does the work itself, rather than waiting on something that will never
 * answer.
 *
 * `TIMED_OUT` is a symbol rather than `null` or `undefined` so that a
 * computation legitimately resolving to either is not read as a timeout.
 */
export const TIMED_OUT = Symbol('timed-out');

export function withDeadline<T>(
  promise: Promise<T>,
  ms: number,
): Promise<T | typeof TIMED_OUT> {
  // The adopted promise outlives this race whenever the deadline wins, and a
  // rejection nobody is listening for takes the process down in Node. The race
  // still sees the real rejection; this only stops the *second*, orphaned one.
  promise.catch(() => {});

  let timer: ReturnType<typeof setTimeout>;

  const deadline = new Promise<typeof TIMED_OUT>((resolve) => {
    timer = setTimeout(() => resolve(TIMED_OUT), ms);
  });

  // Cleared on every outcome, including a rejection: a pending timer keeps a
  // serverless invocation alive after its response has been sent.
  return Promise.race([promise, deadline]).finally(() => clearTimeout(timer));
}

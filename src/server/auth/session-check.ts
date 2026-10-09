import 'server-only';

import { Agent, fetch as undiciFetch } from 'undici';

import {
  classifySessionCheck,
  SESSION_TOKEN_COOKIE,
  type SessionCheck,
} from '@/utils/session-renewal';

/**
 * A second opinion, asked only when Neon Auth's middleware is about to send a
 * request that still carries a session token to the sign-in page.
 *
 * The library's own check goes out on the global `fetch` and its keep-alive
 * pool, which is exactly the state a serverless pause corrupts (AGENTS.md,
 * "Never memoise a promise across requests"). So this one takes a fresh
 * connection, the same way `upstreamFetch` does, and retries once on a throw.
 * Only an answer from Neon decides; a failure to get one is `unknown`.
 */
const freshConnectionAgent = new Agent({ pipelining: 0, allowH2: false });

const CHECK_TIMEOUT_MS = 5_000;

export async function checkSessionToken(token: string): Promise<SessionCheck> {
  const baseUrl = process.env.NEON_AUTH_BASE_URL;
  if (!baseUrl) return { kind: 'unknown' };

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await undiciFetch(`${baseUrl}/get-session`, {
        headers: { cookie: `${SESSION_TOKEN_COOKIE}=${token}` },
        signal: AbortSignal.timeout(CHECK_TIMEOUT_MS),
        dispatcher: freshConnectionAgent,
      });
      const body: unknown = response.ok
        ? await response.json().catch(() => undefined)
        : null;

      // A 200 whose body would not parse is Neon failing, not a verdict.
      if (response.ok && body === undefined) return { kind: 'unknown' };

      return classifySessionCheck(response.status, body);
    } catch (error) {
      console.error(
        `[auth] session check failed (attempt ${attempt + 1})`,
        error,
      );
    }
  }

  return { kind: 'unknown' };
}

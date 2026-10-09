/**
 * The rules `src/proxy.ts` uses to keep a signed-in browser signed in.
 *
 * Neon Auth's middleware lets two things sign a member out who should not be:
 *
 * 1. **The session cookie is never renewed.** Neon sets
 *    `__Secure-neon-auth.session_token` once, at sign-in, with a fixed
 *    `Max-Age`. Neon extends the session itself on every check, but the
 *    library's middleware makes that check with a bare `fetch` and throws the
 *    response's `Set-Cookie` away, so the browser never hears about it. The
 *    cookie expires on the date it was first given, however often the member
 *    visits, and they are signed out mid-season for no reason they can see.
 * 2. **One failed check is treated as "signed out".** Any non-2xx from Neon,
 *    a timeout or a dead pooled socket (see "Never memoise a promise across
 *    requests" in AGENTS.md) sends the request to `/auth/sign-in`.
 *
 * This module decides; the proxy fetches. Kept pure so both rules are tested.
 */

export const SESSION_TOKEN_COOKIE = '__Secure-neon-auth.session_token';
export const SESSION_DATA_COOKIE = '__Secure-neon-auth.local.session_data';

/**
 * The raw value of the named cookie in a request's `Cookie` header, exactly as
 * sent. Raw, not decoded: the token is re-issued byte for byte, and Neon's
 * signed value carries percent-encoding that a decode would change.
 */
export function readRequestCookie(
  cookieHeader: string,
  name: string,
): string | null {
  for (const part of cookieHeader.split(';')) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    if (part.slice(0, eq).trim() !== name) continue;
    const value = part.slice(eq + 1).trim();
    return value === '' ? null : value;
  }
  return null;
}

/**
 * The value of the named cookie in a list of `Set-Cookie` headers, or `null`
 * when it is absent or being deleted (an empty value).
 */
export function findSetCookieValue(
  setCookies: readonly string[],
  name: string,
): string | null {
  for (const header of setCookies) {
    const [pair] = header.split(';');
    const eq = pair.indexOf('=');
    if (eq === -1) continue;
    if (pair.slice(0, eq).trim() !== name) continue;
    const value = pair.slice(eq + 1).trim();
    return value === '' ? null : value;
  }
  return null;
}

/**
 * When the session expires, read from a `session_data` cookie the library has
 * just minted. Its payload is the `/get-session` response, so
 * `session.expiresAt` is Neon's own, already-extended, expiry.
 *
 * Not verified: the proxy only reads a cookie it watched the library sign in
 * the same request, never one the browser sent.
 */
export function sessionExpiryFromSessionData(jwt: string): Date | null {
  const payload = jwt.split('.')[1];
  if (!payload) return null;

  try {
    const json = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return parseExpiry(json?.session?.expiresAt);
  } catch {
    return null;
  }
}

export type SessionCheck =
  | { kind: 'valid'; expiresAt: Date | null }
  | { kind: 'signed-out' }
  | { kind: 'unknown' };

/**
 * What a `/get-session` answer means.
 *
 * Only Neon saying so signs a member out: a `200` with no session (that is how
 * Better Auth answers an expired or revoked token) or a `401`. Every other
 * status is Neon failing, not the member, so it is `unknown` and the proxy lets
 * the request through. The pages re-check membership themselves, so nothing is
 * served on the strength of an `unknown`.
 */
export function classifySessionCheck(
  status: number,
  body: unknown,
): SessionCheck {
  if (status === 401) return { kind: 'signed-out' };
  if (status !== 200) return { kind: 'unknown' };

  const session = (body as { session?: { expiresAt?: unknown } } | null)
    ?.session;
  if (!session) return { kind: 'signed-out' };

  return { kind: 'valid', expiresAt: parseExpiry(session.expiresAt) };
}

/**
 * A `Set-Cookie` that re-issues the session token with its lifetime brought
 * up to Neon's current expiry. Same name, path and flags as Neon's own, so it
 * overwrites rather than duplicates. `null` when the session is already over.
 */
export function renewedSessionTokenCookie(
  token: string,
  expiresAt: Date,
  now: Date,
): string | null {
  const maxAge = Math.floor((expiresAt.getTime() - now.getTime()) / 1000);
  if (maxAge <= 0) return null;

  return `${SESSION_TOKEN_COOKIE}=${token}; Path=/; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Lax`;
}

function parseExpiry(value: unknown): Date | null {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

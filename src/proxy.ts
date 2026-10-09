import { NextResponse, type NextRequest } from 'next/server';

import { auth } from '@/server/auth/server';
import { checkSessionToken } from '@/server/auth/session-check';
import {
  findSetCookieValue,
  readRequestCookie,
  renewedSessionTokenCookie,
  RETURNING_MEMBER_COOKIE_HEADER,
  SESSION_DATA_COOKIE,
  SESSION_TOKEN_COOKIE,
  sessionExpiryFromSessionData,
} from '@/utils/session-renewal';

const LOGIN_PATH = '/auth/sign-in';

const neonGate = auth.middleware({ loginUrl: LOGIN_PATH });

/**
 * The Neon Auth gate. **The app does not work without this file.**
 *
 * It does two jobs, and the first one is not optional:
 *
 * 1. **It completes the OAuth handshake.** Neon returns the browser to the
 *    callback URL with a `?neon_auth_session_verifier=…` param, and the only
 *    code in the library that trades that param for the
 *    `__Secure-neon-auth.session_token` cookie is `exchangeOAuthToken`, which
 *    is reachable from here and nowhere else. The `/api/auth/[...path]` mount
 *    never sees that navigation — it lands on a page route. Without this file
 *    sign-in half-succeeds forever: Neon mints a real session row, no cookie is
 *    ever set, and every page renders signed out.
 * 2. **It gates the app.** Better Draft is for the managers in one league;
 *    there is no view for a stranger.
 *
 * Note this is `proxy.ts`, not `middleware.ts` — Next 16 renamed the convention
 * and deprecated the old name. It defaults to the Node.js runtime, so importing
 * the same `auth` instance the rest of the server uses is safe; `getDb()` is
 * lazy, so nothing here opens a database connection.
 *
 * **The gate is authentication, not membership.** Any Google account passes it.
 * `league_members` is enforced by `getCurrentUser()`, which is what `/profile`
 * reads — see `src/server/auth/server.ts`.
 *
 * **Signed in once means signed in.** The library's gate, left alone, signs
 * members out twice over: it never renews the session cookie, so the cookie
 * dies on the date Neon first set it however often someone visits, and it
 * reads any failed check against Neon as "signed out". This wrapper fixes both
 * (the rules, and why, are in `src/utils/session-renewal.ts`):
 *
 * - whenever the library has just re-checked the session with Neon, the token
 *   cookie is re-issued with Neon's current, rolling expiry;
 * - a redirect to sign-in for a request that still carries a token is only
 *   honoured once a fresh-connection check confirms Neon really has no session.
 *   If Neon cannot be reached the request goes through; the pages check
 *   membership again themselves.
 *
 * Neon's session still ends after about a week without a visit, and Neon has
 * no setting to change that. So every verified session also refreshes a
 * long-lived `bd-returning` flag, and `/auth/sign-in` reads it to start the
 * Google sign-in by itself. Google is already signed in, so it bounces
 * straight back: an expired session costs a redirect, not a click.
 */
export default async function proxy(
  request: NextRequest,
): Promise<NextResponse> {
  const response = await neonGate(request);
  const token = readRequestCookie(
    request.headers.get('cookie') ?? '',
    SESSION_TOKEN_COOKIE,
  );

  // The OAuth handshake just set a token: remember this browser has signed in,
  // so an expired session later signs back in without a click.
  if (
    findSetCookieValue(response.headers.getSetCookie(), SESSION_TOKEN_COOKIE)
  ) {
    response.headers.append('Set-Cookie', RETURNING_MEMBER_COOKIE_HEADER);
  }

  // Never touch the token on Neon's own routes: a renewal riding on the
  // sign-out POST would race the deletion and could undo the sign-out.
  if (!token || request.nextUrl.pathname.startsWith('/api/auth'))
    return response;

  if (isLoginRedirect(response, request)) {
    const check = await checkSessionToken(token);
    if (check.kind === 'signed-out') return response;

    const through = NextResponse.next();
    if (check.kind === 'valid' && check.expiresAt) {
      renewToken(through, token, check.expiresAt);
    }
    return through;
  }

  const minted = findSetCookieValue(
    response.headers.getSetCookie(),
    SESSION_DATA_COOKIE,
  );
  const expiresAt = minted ? sessionExpiryFromSessionData(minted) : null;
  if (expiresAt) renewToken(response, token, expiresAt);

  return response;
}

function isLoginRedirect(
  response: NextResponse,
  request: NextRequest,
): boolean {
  const location = response.headers.get('location');
  if (!location || response.status < 300 || response.status >= 400)
    return false;

  return new URL(location, request.url).pathname === LOGIN_PATH;
}

function renewToken(
  response: NextResponse,
  token: string,
  expiresAt: Date,
): void {
  const cookie = renewedSessionTokenCookie(token, expiresAt, new Date());
  if (!cookie) return;
  response.headers.append('Set-Cookie', cookie);
  response.headers.append('Set-Cookie', RETURNING_MEMBER_COOKIE_HEADER);
}

export const config = {
  /**
   * Everything except Next's own static output and the files in `public/`.
   * Without the asset exclusions the gate would redirect the logo and the
   * favicons too, so the sign-in page would render with no branding on it.
   *
   * `/api/auth/**` is deliberately *not* excluded: the library already skips it
   * (`DEFAULT_AUTH_SKIP_ROUTES`), and the sign-in POST has to reach it while the
   * caller is still signed out.
   *
   * `/api/cron/**` **is** excluded, because its caller is Vercel Cron and has no
   * session to redirect. It is not thereby public: the route checks a bearer
   * `CRON_SECRET` itself. Nothing else may be excluded on those grounds without
   * its own authentication written first.
   *
   * The OAuth callback lands on a page route (`/`), which the pattern above
   * still matches — check that remains true before touching this, or sign-in
   * fails silently. See the note at the top of this file.
   */
  matcher: [
    '/((?!api/cron|_next/static|_next/image|.*\\.(?:png|jpg|jpeg|gif|svg|ico|webp|txt|xml|webmanifest)$).*)',
  ],
};

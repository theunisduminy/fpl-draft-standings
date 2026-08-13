import { auth } from '@/server/auth/server';

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
 */
export default auth.middleware({ loginUrl: '/auth/sign-in' });

export const config = {
  /**
   * Everything except Next's own static output and the files in `public/`.
   * Without the asset exclusions the gate would redirect the logo and the
   * favicons too, so the sign-in page would render with no branding on it.
   *
   * `/api/auth/**` is deliberately *not* excluded: the library already skips it
   * (`DEFAULT_AUTH_SKIP_ROUTES`), and the sign-in POST has to reach it while the
   * caller is still signed out.
   */
  matcher: [
    '/((?!_next/static|_next/image|.*\\.(?:png|jpg|jpeg|gif|svg|ico|webp|txt|xml|webmanifest)$).*)',
  ],
};

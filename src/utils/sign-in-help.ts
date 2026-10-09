/**
 * Plain-English help for the sign-in page, for the two ways Google sign-in
 * fails for reasons the member can fix themselves.
 *
 * Better Auth checks that a sign-in finishes in the same browser that started
 * it, with a short-lived `state` cookie. When the cookie is missing on the way
 * back, it refuses with `state_mismatch` and the member sees jargon about a
 * state check. The usual cause is a link opened inside WhatsApp, Instagram or
 * the Google app: the sign-in starts in that app's built-in browser and Google
 * finishes it somewhere else, without the cookie.
 */

/** Neon's error codes that all mean "the sign-in did not finish where it started". */
const STATE_ERRORS = new Set([
  'state_mismatch',
  'state_security_mismatch',
  'state_not_found',
  'state_invalid',
  'please_restart_the_process',
]);

export function signInErrorMessage(code: string | undefined): string | null {
  if (!code) return null;

  if (STATE_ERRORS.has(code)) {
    return (
      "Sign-in didn't finish in the browser it started in. Open " +
      'betterdraft.vercel.app in Chrome or Safari directly, not from a link ' +
      'inside WhatsApp or another app, and sign in once without switching apps.'
    );
  }

  if (code === 'access_denied') {
    return 'Google sign-in was cancelled. Try again when you are ready.';
  }

  return `Sign-in failed (${code}). Try again, and tell the league admin if it keeps happening.`;
}

/**
 * Apps whose built-in browser keeps its own cookies, so a Google sign-in begun
 * there tends to come back to a browser that never saw it start. Google also
 * refuses sign-in inside some of these outright.
 */
const EMBEDDED_BROWSER = [
  /FBAN|FBAV|FB_IAB/, // Facebook, Messenger
  /Instagram/,
  /WhatsApp/i,
  /LinkedInApp/,
  /Snapchat/,
  /\bLine\//,
  /\bGSA\//, // the Google app on iOS
  /; wv\)/, // any Android WebView
];

export function isEmbeddedBrowser(userAgent: string | null): boolean {
  if (!userAgent) return false;
  return EMBEDDED_BROWSER.some((pattern) => pattern.test(userAgent));
}

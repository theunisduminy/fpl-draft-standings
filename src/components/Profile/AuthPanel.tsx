'use client';

import { useEffect, useState } from 'react';
import { LogIn, LogOut } from 'lucide-react';

import { authClient } from '@/lib/auth/client';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { RETURNING_MEMBER_COOKIE } from '@/utils/session-renewal';

/** Per tab, so a sign-in that cannot complete stops after one try. */
const AUTO_SIGN_IN_KEY = 'bd-auto-sign-in-at';
const AUTO_SIGN_IN_COOLDOWN_MS = 5 * 60 * 1000;

function claimAutoSignIn(): boolean {
  try {
    const last = Number(sessionStorage.getItem(AUTO_SIGN_IN_KEY));
    if (last && Date.now() - last < AUTO_SIGN_IN_COOLDOWN_MS) return false;
    sessionStorage.setItem(AUTO_SIGN_IN_KEY, String(Date.now()));
    return true;
  } catch {
    // No storage means no loop guard, so do not risk a loop.
    return false;
  }
}

function startGoogleSignIn(callbackURL: string) {
  return authClient.signIn.social({ provider: 'google', callbackURL });
}

/**
 * Sign in and out. Google is the only provider enabled on the Neon Auth
 * project, and the league is an allowlist of known addresses, so there is no
 * sign-up flow to build.
 *
 * `callbackURL` is where Neon returns the browser after Google. It must be a
 * path the proxy matches, because the proxy is what turns the verifier param on
 * that URL into a session cookie — see `src/proxy.ts`.
 *
 * `autoStart` starts Google sign-in on mount, for a returning member whose
 * session expired (see `shouldAutoSignIn`). Google is already signed in, so
 * they bounce straight back without a click.
 */
export function AuthPanel({
  signedIn,
  callbackURL = '/profile',
  autoStart = false,
  className,
}: {
  signedIn: boolean;
  callbackURL?: string;
  autoStart?: boolean;
  className?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [signOutFailed, setSignOutFailed] = useState(false);

  useEffect(() => {
    if (signedIn || !autoStart || !claimAutoSignIn()) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reflects a redirect already under way
    setBusy(true);
    void startGoogleSignIn(callbackURL);
  }, [signedIn, autoStart, callbackURL]);

  if (signedIn) {
    return (
      <Button
        variant='outline'
        disabled={busy}
        aria-live='polite'
        onClick={async () => {
          setBusy(true);
          // `signOut` reports a refusal in its result rather than throwing.
          // Reloading regardless is what made a rejected sign-out look like a
          // button that did nothing: Neon answers 403 `INVALID_ORIGIN` for any
          // host missing from the project's `trusted_origins`, and the cookie
          // survives. Only leave the page once the session is really gone.
          const { error } = await authClient.signOut();
          if (error) {
            console.error('Sign-out was refused', error);
            setSignOutFailed(true);
            setBusy(false);
            return;
          }
          // Signing out is a choice: forget this browser, or the sign-in
          // page would sign them straight back in.
          document.cookie = `${RETURNING_MEMBER_COOKIE}=; Path=/; Max-Age=0; Secure; SameSite=Lax`;
          window.location.reload();
        }}
        // Resting state is quiet — signing out is not the point of any page it
        // sits on. The warning colour arrives on hover, where it is a reply to
        // someone already reaching for it.
        className={cn(
          'border-white/20 text-white/80',
          'hover:border-destructive/60 hover:bg-destructive/15 hover:text-destructive',
          className,
        )}
      >
        <LogOut className='mr-2 h-4 w-4' />
        {signOutFailed ? 'Sign-out failed. Try again' : 'Sign out'}
      </Button>
    );
  }

  return (
    <Button
      disabled={busy}
      className={className}
      onClick={async () => {
        setBusy(true);
        await startGoogleSignIn(callbackURL);
      }}
    >
      <LogIn className='mr-2 h-4 w-4' />
      {busy
        ? autoStart
          ? 'Signing you back in…'
          : 'Redirecting…'
        : 'Sign in with Google'}
    </Button>
  );
}

'use client';

import { useState } from 'react';
import { LogIn, LogOut } from 'lucide-react';

import { authClient } from '@/lib/auth/client';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * Sign in and out. Google is the only provider enabled on the Neon Auth
 * project, and the league is an allowlist of known addresses, so there is no
 * sign-up flow to build.
 *
 * `callbackURL` is where Neon returns the browser after Google. It must be a
 * path the proxy matches, because the proxy is what turns the verifier param on
 * that URL into a session cookie — see `src/proxy.ts`.
 */
export function AuthPanel({
  signedIn,
  callbackURL = '/profile',
  className,
}: {
  signedIn: boolean;
  callbackURL?: string;
  className?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [signOutFailed, setSignOutFailed] = useState(false);

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
        await authClient.signIn.social({
          provider: 'google',
          callbackURL,
        });
      }}
    >
      <LogIn className='mr-2 h-4 w-4' />
      {busy ? 'Redirecting…' : 'Sign in with Google'}
    </Button>
  );
}

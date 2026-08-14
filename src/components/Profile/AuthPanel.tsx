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

  if (signedIn) {
    return (
      <Button
        variant='outline'
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          await authClient.signOut();
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
        Sign out
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

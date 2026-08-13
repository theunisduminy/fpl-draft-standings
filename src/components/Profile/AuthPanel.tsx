'use client';

import { useState } from 'react';
import { LogIn, LogOut } from 'lucide-react';

import { authClient } from '@/lib/auth/client';
import { Button } from '@/components/ui/button';

/**
 * Sign in and out. Google is the only provider enabled on the Neon Auth
 * project, and the league is an allowlist of known addresses, so there is no
 * sign-up flow to build.
 */
export function AuthPanel({ signedIn }: { signedIn: boolean }) {
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
        className='border-white/20 text-white/80 hover:bg-white/10'
      >
        <LogOut className='mr-2 h-4 w-4' />
        Sign out
      </Button>
    );
  }

  return (
    <Button
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await authClient.signIn.social({
          provider: 'google',
          callbackURL: '/profile',
        });
      }}
    >
      <LogIn className='mr-2 h-4 w-4' />
      {busy ? 'Redirecting…' : 'Sign in with Google'}
    </Button>
  );
}

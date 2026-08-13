/* eslint-disable @next/next/no-img-element */
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { getCurrentUser } from '@/server/auth/server';
import { AuthPanel } from '@/components/Profile/AuthPanel';
import { Card, CardContent } from '@/components/ui/card';

export const metadata: Metadata = { title: 'Sign in' };

// Reads the session, so it can never be prerendered.
export const dynamic = 'force-dynamic';

/**
 * The only page a signed-out visitor can reach. Everything else redirects here,
 * via `loginUrl` in `src/proxy.ts`.
 *
 * The path is not arbitrary: `/auth/sign-in` is in Neon Auth's
 * `DEFAULT_AUTH_SKIP_ROUTES`, so the gate lets it through instead of producing
 * the circular "redirect to the login page because you are not signed in".
 * Moving it means changing `loginUrl` too.
 *
 * It sits outside the `(app)` route group on purpose, so it renders against the
 * root layout with no header, no sidebar and no bottom nav. It is also the one
 * page that does not use `PageShell`: a centred auth screen is not a data view
 * with a heading above a Suspense boundary, and it has no shared container to
 * line up with. Signing in lands on `/`, not on `/profile` — a gated app's home
 * is the standings.
 */
export default async function SignInPage() {
  if (await getCurrentUser()) redirect('/');

  return (
    <main className='flex flex-1 items-center justify-center px-4 py-12'>
      <div className='w-full max-w-sm space-y-8'>
        <div className='flex flex-col items-center gap-3 text-center'>
          <img className='h-14 w-auto' src='/better-draft.png' alt='' />
          <h1 className='text-2xl font-bold tracking-tight text-white'>
            Better Draft
          </h1>
          <p className='text-sm text-white/50'>
            A better FPL point system, for one league
          </p>
        </div>

        <Card className='border-white/10 bg-[#2a0d33]'>
          <CardContent className='space-y-5 pt-6'>
            <p className='text-center text-sm text-white/60'>
              Sign in with the Google account that is on the league list.
            </p>

            <AuthPanel signedIn={false} callbackURL='/' className='w-full' />

            <p className='text-center text-xs text-white/40'>
              Signed in and still seeing this? Your address is not mapped to a
              manager yet. Ask the league admin to add you.
            </p>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

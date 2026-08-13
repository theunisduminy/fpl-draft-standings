import { redirect } from 'next/navigation';

import { getCurrentUser } from '@/server/auth/server';

// Reads the session, so nothing beneath it can be prerendered.
export const dynamic = 'force-dynamic';

/**
 * Onboarding is compulsory: no display name and bio, no app.
 *
 * This is a route group rather than a check inside each page because a layout
 * cannot see the pathname, and a gate that redirects to `/profile` must not run
 * on `/profile` — that is an infinite redirect. Grouping solves it structurally:
 * everything that requires a finished profile lives in `(onboarded)`, and
 * `/profile` sits outside it, one level up in `(app)`, so it still gets the
 * navigation chrome while staying reachable.
 *
 * It also closes the hole the proxy leaves open. `src/proxy.ts` only knows that
 * a Neon session is valid, so any Google account clears it; `getCurrentUser()`
 * returns `null` unless that session's email is in `league_members`. Sending
 * those people to `/profile` too means they land on the page that explains why
 * they are not in, instead of reading the league's standings.
 *
 * Adding a page that should skip onboarding — another pre-app step, say — means
 * putting it beside `profile/` in `(app)`, not here.
 */
export default async function OnboardedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();

  if (!user || !user.profileComplete) redirect('/profile');

  return <>{children}</>;
}

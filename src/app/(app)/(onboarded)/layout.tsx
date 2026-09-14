import { Suspense } from 'react';

import { MembershipGate } from '@/components/Layout/MembershipGate';
import { SkeletonRegion } from '@/components/SkeletonRegion';
import { Skeleton } from '@/components/ui/skeleton';

// Reads the session, so nothing beneath it can be prerendered.
export const dynamic = 'force-dynamic';

/**
 * Onboarding is compulsory: no display name and club, no app.
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
 *
 * Streaming shape: this layout is sync — it never awaits `getCurrentUser()`
 * itself. The check lives in `<MembershipGate>`, awaited below a `<Suspense>`
 * boundary with a skeleton-only fallback, so AppChrome flushes before the
 * user lookup resolves while enforcement stays identical (null or incomplete
 * profile still redirects to `/profile`, and the fallback carries zero league
 * content — neutral bars only, no names, scores, or rumblers).
 *
 * Routes that can 404 are the exception: a flushed shell commits the HTTP
 * status before `notFound()` runs, so such routes belong in a `(blocking)`
 * subgroup whose layout awaits the gate before the page renders, not under
 * this boundary. Everything else streams here (the `(streamed)` subgroup).
 * Groups are URL-neutral, so the split never changes a URL.
 *
 * Concrete split: `(streamed)` holds `(home)`, `results`, `rumblers`,
 * `squads`, `premier-league`; `(blocking)` holds `players/[playerId]` only.
 */
export default function OnboardedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense
      fallback={
        <SkeletonRegion>
          <div className='space-y-4'>
            <Skeleton className='h-8 w-48' />
            <Skeleton className='h-4 w-64' />
            <Skeleton className='h-64 w-full' />
          </div>
        </SkeletonRegion>
      }
    >
      <MembershipGate>{children}</MembershipGate>
    </Suspense>
  );
}

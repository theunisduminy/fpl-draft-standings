import { StandingsSkeleton } from '@/components/TableView/StandingsSkeleton';
import { SkeletonRegion } from '@/components/SkeletonRegion';
import { PageShell } from '@/components/Layout/PageShell';

/**
 * Route-level loading UI for `/`.
 *
 * Mirrors the streamed shell in `page.tsx` — the same `StandingsSkeleton` its
 * Suspense falls back to — so a soft-nav home and the streamed first paint look
 * identical. `delayed` belongs here and not on the in-page fallback: this is the
 * skeleton the router paints first.
 *
 * It lives in a `(home)` route group, which is the whole point: a `loading.tsx`
 * at the app root would wrap every route beneath it — including
 * `/players/[playerId]` — and flushing that shell commits the HTTP status
 * before the page can call `notFound()`, turning a 404 into a 200. The group
 * scopes this boundary to `/` alone without changing the URL.
 */
export default function Loading() {
  return (
    <PageShell title='Standings' subtitle='FPL Draft league rankings'>
      <SkeletonRegion delayed>
        <StandingsSkeleton />
      </SkeletonRegion>
    </PageShell>
  );
}

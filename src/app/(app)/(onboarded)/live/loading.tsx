import { LiveTowerSkeleton } from '@/components/LiveRoom/LiveTowerSkeleton';
import { SkeletonRegion } from '@/components/SkeletonRegion';
import { PageShell } from '@/components/Layout/PageShell';

/**
 * Route-level loading UI for `/live`.
 *
 * Mirrors the streamed shell in `page.tsx` — the same `LiveTowerSkeleton` its
 * Suspense falls back to — so a soft-nav here and the streamed first paint
 * look identical. `delayed` belongs on this one: it is the skeleton the router
 * paints first.
 *
 * Safe because `/live` cannot 404.
 */
export default function Loading() {
  return (
    <PageShell
      title='Live room'
      subtitle='Provisional tower for the gameweek in progress'
    >
      <SkeletonRegion delayed>
        <LiveTowerSkeleton />
      </SkeletonRegion>
    </PageShell>
  );
}

import { ResultsSkeleton } from '@/components/TableView/ResultsSkeleton';
import { SkeletonRegion } from '@/components/SkeletonRegion';
import { PageShell } from '@/components/Layout/PageShell';

/**
 * Mirrors the streamed shell in `page.tsx`, so a soft-nav here and the streamed
 * first paint look identical. `delayed` belongs on this one — it is the
 * skeleton the router paints first.
 *
 * Safe because `/results` cannot 404.
 */
export default function Loading() {
  return (
    <PageShell title='Results' subtitle='Gameweek by gameweek breakdown'>
      <SkeletonRegion delayed>
        <ResultsSkeleton />
      </SkeletonRegion>
    </PageShell>
  );
}

import { PremierLeagueSkeleton } from '@/components/PremierLeagueView/PremierLeagueSkeleton';
import { SkeletonRegion } from '@/components/SkeletonRegion';
import { PageShell } from '@/components/Layout/PageShell';

/** Mirrors `page.tsx`'s fallback. Safe because `/premier-league` cannot 404. */
export default function Loading() {
  return (
    <PageShell
      title='Premier League'
      subtitle='The real table, fixtures and results'
    >
      <SkeletonRegion delayed>
        <PremierLeagueSkeleton />
      </SkeletonRegion>
    </PageShell>
  );
}

import { SquadsSkeleton } from '@/components/SquadView/SquadsSkeleton';
import { SkeletonRegion } from '@/components/SkeletonRegion';
import { PageShell } from '@/components/Layout/PageShell';

/** Mirrors `page.tsx`'s fallback. Safe because `/squads` cannot 404. */
export default function Loading() {
  return (
    <PageShell title='Squads' subtitle='Who drafted whom'>
      <SkeletonRegion delayed>
        <SquadsSkeleton />
      </SkeletonRegion>
    </PageShell>
  );
}

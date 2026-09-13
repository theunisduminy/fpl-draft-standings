import { RumblerSkeleton } from '@/components/RumblerView/RumblerSkeleton';
import { SkeletonRegion } from '@/components/SkeletonRegion';
import { PageShell } from '@/components/Layout/PageShell';

/** Mirrors `page.tsx`'s fallback. Safe because `/rumblers` cannot 404. */
export default function Loading() {
  return (
    <PageShell title='Rumblers' subtitle="Who's buying the next round?">
      <SkeletonRegion delayed>
        <RumblerSkeleton />
      </SkeletonRegion>
    </PageShell>
  );
}

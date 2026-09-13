import { Suspense } from 'react';
import type { Metadata } from 'next';

import { getGameweekData } from '@/utils/gameweek-data';
import { RumblerTabs } from '@/components/RumblerView/RumblerTabs';
import { RumblerSkeleton } from '@/components/RumblerView/RumblerSkeleton';
import { SkeletonRegion } from '@/components/SkeletonRegion';
import { PageShell } from '@/components/Layout/PageShell';

export const metadata: Metadata = { title: 'Rumblers' };

// Reads live upstream data, so it is never prerendered.
export const dynamic = 'force-dynamic';

// Heading above the boundary, skeleton below — see `src/app/(app)/(onboarded)/(home)/page.tsx`.
export default function Rumblers() {
  return (
    <PageShell title='Rumblers' subtitle="Who's buying the next round?">
      <Suspense
        fallback={
          <SkeletonRegion>
            <RumblerSkeleton />
          </SkeletonRegion>
        }
      >
        <Rumbler />
      </Suspense>
    </PageShell>
  );
}

async function Rumbler() {
  const { rumblerData } = await getGameweekData();

  return <RumblerTabs data={rumblerData} />;
}

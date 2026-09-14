import { Suspense } from 'react';
import type { Metadata } from 'next';

import { getGameweekData } from '@/utils/gameweek-data';
import DraftResults from '@/components/TableView/DraftResultsTable';
import { ResultsSkeleton } from '@/components/TableView/ResultsSkeleton';
import { SkeletonRegion } from '@/components/SkeletonRegion';
import { PageShell } from '@/components/Layout/PageShell';

export const metadata: Metadata = { title: 'Results' };

// Reads live upstream data, so it is never prerendered.
export const dynamic = 'force-dynamic';

// Heading above the boundary, skeleton below — see `src/app/(app)/(onboarded)/(home)/page.tsx`.
export default function ResultsView() {
  return (
    <PageShell title='Results' subtitle='Gameweek by gameweek breakdown'>
      <Suspense
        fallback={
          <SkeletonRegion>
            <ResultsSkeleton />
          </SkeletonRegion>
        }
      >
        <Results />
      </Suspense>
    </PageShell>
  );
}

async function Results() {
  const data = await getGameweekData();

  return <DraftResults data={data} />;
}

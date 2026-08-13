import { Suspense } from 'react';
import type { Metadata } from 'next';

import { getGameweekData } from '@/utils/gameweek-data';
import DraftResults from '@/components/TableView/DraftResultsTable';
import { SkeletonCard } from '@/components/SkeletonTable';

export const metadata: Metadata = { title: 'Results' };

// Reads live upstream data, so it is never prerendered.
export const dynamic = 'force-dynamic';

// The boundary is in the page, not a `loading.tsx` — see `src/app/page.tsx`.
export default function ResultsView() {
  return (
    <div className='w-full space-y-6'>
      <div className='space-y-1'>
        <h1 className='text-2xl font-bold text-white md:text-3xl'>Results</h1>
        <p className='text-sm text-white/60'>Gameweek by gameweek breakdown</p>
      </div>

      <Suspense fallback={<SkeletonCard />}>
        <Results />
      </Suspense>
    </div>
  );
}

async function Results() {
  const data = await getGameweekData();

  return <DraftResults data={data} />;
}

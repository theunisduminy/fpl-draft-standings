import { Suspense } from 'react';
import type { Metadata } from 'next';

import { getGameweekData } from '@/utils/gameweek-data';
import { StandingsTabs } from '@/components/TableView/StandingsTabs';
import { SkeletonCard } from '@/components/SkeletonTable';

export const metadata: Metadata = { title: 'Standings' };

// Reads live upstream data, so it is never prerendered.
export const dynamic = 'force-dynamic';

/**
 * The season is read here, once, on the server. Both the standings table and
 * the position charts render from the same object — previously they were two
 * separate browser fetches of overlapping data.
 *
 * The Suspense boundary lives inside the page rather than in a `loading.tsx`
 * on purpose. A `loading.tsx` at the app root would wrap every route below it,
 * including `/players/[playerId]`, and flushing that shell early commits the
 * response status before the page has decided whether it is a 404 — so
 * `notFound()` would render the right page with a 200.
 */
export default function Home() {
  return (
    <div className='w-full space-y-6'>
      <div className='space-y-1'>
        <h1 className='text-2xl font-bold text-white md:text-3xl'>Standings</h1>
        <p className='text-sm text-white/60'>FPL Draft league rankings</p>
      </div>

      <Suspense fallback={<SkeletonCard />}>
        <Standings />
      </Suspense>
    </div>
  );
}

async function Standings() {
  const data = await getGameweekData();

  return <StandingsTabs data={data} />;
}

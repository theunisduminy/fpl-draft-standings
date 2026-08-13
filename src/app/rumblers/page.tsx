import { Suspense } from 'react';
import type { Metadata } from 'next';

import { getGameweekData } from '@/utils/gameweek-data';
import { RumblerTabs } from '@/components/RumblerView/RumblerTabs';
import { SkeletonCard } from '@/components/SkeletonTable';

export const metadata: Metadata = { title: 'Rumblers' };

// Reads live upstream data, so it is never prerendered.
export const dynamic = 'force-dynamic';

// The boundary is in the page, not a `loading.tsx` — see `src/app/page.tsx`.
export default function Rumblers() {
  return (
    <div className='w-full space-y-6'>
      <div className='space-y-1'>
        <h1 className='text-2xl font-bold text-white md:text-3xl'>Rumblers</h1>
        <p className='text-sm text-white/60'>
          Who&apos;s buying the next round?
        </p>
      </div>

      <Suspense fallback={<SkeletonCard />}>
        <Rumbler />
      </Suspense>
    </div>
  );
}

async function Rumbler() {
  const { rumblerData } = await getGameweekData();

  return <RumblerTabs data={rumblerData} />;
}

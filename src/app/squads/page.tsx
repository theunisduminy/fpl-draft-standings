import { Suspense } from 'react';
import type { Metadata } from 'next';

import { getSquads } from '@/utils/squads';
import { SquadCard } from '@/components/SquadView/SquadCard';
import { SkeletonCard } from '@/components/SkeletonTable';
import { Card, CardContent } from '@/components/ui/card';

export const metadata: Metadata = { title: 'Squads' };

// Reads live upstream data, so it is never prerendered.
export const dynamic = 'force-dynamic';

// The boundary is in the page, not a `loading.tsx` — see `src/app/page.tsx`.
export default function SquadsPage() {
  return (
    <div className='w-full space-y-6'>
      <div className='space-y-1'>
        <h1 className='text-2xl font-bold text-white md:text-3xl'>Squads</h1>
        <p className='text-sm text-white/60'>Who drafted whom</p>
      </div>

      <Suspense fallback={<SkeletonCard />}>
        <Squads />
      </Suspense>
    </div>
  );
}

async function Squads() {
  const { squads, freeAgentCount, drafted } = await getSquads();

  if (!drafted) {
    return (
      <Card className='border-white/10 bg-[#2a0d33]'>
        <CardContent className='p-6 text-center text-sm text-white/60'>
          The draft has not run yet. Squads appear here once it does.
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <div className='grid grid-cols-1 gap-4 lg:grid-cols-2'>
        {squads.map((squad) => (
          <SquadCard key={squad.leagueEntry} squad={squad} />
        ))}
      </div>

      <p className='text-xs text-white/30'>
        {freeAgentCount} players unowned. Ownership is live: it follows trades
        and waivers, so it will drift from the draft as the season runs.
      </p>
    </>
  );
}

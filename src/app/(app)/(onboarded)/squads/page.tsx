import { Suspense } from 'react';
import type { Metadata } from 'next';

import { getSquads } from '@/utils/squads';
import { SquadCard } from '@/components/SquadView/SquadCard';
import { SquadsSkeleton } from '@/components/SquadView/SquadsSkeleton';
import { SkeletonRegion } from '@/components/SkeletonRegion';
import { PageShell } from '@/components/Layout/PageShell';
import { EmptyState } from '@/components/EmptyState';

export const metadata: Metadata = { title: 'Squads' };

// Reads live upstream data, so it is never prerendered.
export const dynamic = 'force-dynamic';

// Heading above the boundary, skeleton below — see `src/app/(app)/(onboarded)/(home)/page.tsx`.
export default function SquadsPage() {
  return (
    <PageShell title='Squads' subtitle='Who drafted whom'>
      <Suspense
        fallback={
          <SkeletonRegion>
            <SquadsSkeleton />
          </SkeletonRegion>
        }
      >
        <Squads />
      </Suspense>
    </PageShell>
  );
}

async function Squads() {
  const { squads, freeAgentCount, drafted } = await getSquads();

  if (!drafted) {
    return (
      <EmptyState>
        The draft has not run yet. Squads appear here once it does.
      </EmptyState>
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

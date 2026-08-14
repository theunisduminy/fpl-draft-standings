import { Suspense } from 'react';
import type { Metadata } from 'next';

import { getSquads } from '@/utils/squads';
import { getCurrentUser } from '@/server/auth/server';
import { SquadPicker } from '@/components/SquadView/SquadPicker';
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
  // The session read is cheap and already cached per request; it only decides
  // which squad the picker opens on.
  const [{ squads, freeAgentCount, drafted }, user] = await Promise.all([
    getSquads(),
    getCurrentUser(),
  ]);

  if (!drafted) {
    return (
      <EmptyState>
        The draft has not run yet. Squads appear here once it does.
      </EmptyState>
    );
  }

  return (
    <>
      <SquadPicker squads={squads} initialLeagueEntry={user?.leagueEntry} />

      <p className='text-xs text-white/30'>
        {freeAgentCount} players unowned. Ownership is live: it follows trades
        and waivers, so it will drift from the draft as the season runs.
      </p>
    </>
  );
}

import { Suspense } from 'react';
import type { Metadata } from 'next';

import { getLiveGameweek } from '@/utils/live-gameweek';
import { LiveTower, type LiveTowerRow } from '@/components/LiveRoom/LiveTower';
import { LiveTowerSkeleton } from '@/components/LiveRoom/LiveTowerSkeleton';
import { EmptyState } from '@/components/EmptyState';
import { SkeletonRegion } from '@/components/SkeletonRegion';
import { PageShell } from '@/components/Layout/PageShell';

export const metadata: Metadata = { title: 'Live room' };

// Reads live upstream data, so it is never prerendered.
export const dynamic = 'force-dynamic';

/**
 * The matchday board: who is where right now, by how much, and who still has
 * players to come.
 *
 * `PageShell` paints the static heading before the boundary is reached; the
 * gameweek specific line (badge, tower, or empty state) renders inside the
 * streamed subtree, because whether a gameweek is in flight is a fact about
 * the data. The boundary lives here rather than in a `loading.tsx` at the app
 * root: that would wrap every route beneath it. A sibling `loading.tsx` covers
 * this route alone, which cannot 404.
 */
export default function LivePage() {
  return (
    <PageShell
      title='Live room'
      subtitle='Provisional tower for the gameweek in progress'
    >
      <Suspense
        fallback={
          <SkeletonRegion>
            <LiveTowerSkeleton />
          </SkeletonRegion>
        }
      >
        <LiveRoom />
      </Suspense>
    </PageShell>
  );
}

async function LiveRoom() {
  const result = await getLiveGameweek();

  // Pre-kickoff: fixtures exist but nobody has played, so there is nothing to
  // rank. Zeros are never ranked; the starts soon state says so instead.
  if (result?.state === 'pre-kickoff') {
    return (
      <EmptyState>
        <p className='font-medium text-foreground'>
          GW{result.gameweek} starts soon
        </p>
        <p className='mt-1'>
          The fixtures are set but nobody has played yet. Provisional positions
          appear here after kickoff.
        </p>
      </EmptyState>
    );
  }

  // Field mapping assumption against the frozen slice: the live member carries
  // `gameweek`, `computedAt` epoch millis, and `rows` in provisional order
  // where each row carries at least the `LiveTowerRow` fields (`position`,
  // `managerName`, `teamName`, `points`, `interval`, `cushion`, `done`,
  // `toPlay`, `movement`). The callback annotation asserts exactly that, so a
  // slice that spells a field differently fails here at merge rather than
  // rendering undefined. Nothing here invents a number.
  if (result?.state === 'live') {
    return (
      <LiveTower
        data={{
          gameweek: result.gameweek,
          computedAt: result.computedAt,
          rows: result.rows.map((row: LiveTowerRow) => ({
            position: row.position,
            managerName: row.managerName,
            teamName: row.teamName,
            points: row.points,
            interval: row.interval,
            cushion: row.cushion,
            done: row.done,
            toPlay: row.toPlay,
            movement: row.movement,
          })),
        }}
      />
    );
  }

  // Idle: no gameweek in flight, so no ranks at all.
  if (result?.state === 'idle') {
    return (
      <EmptyState>
        <p className='font-medium text-foreground'>No gameweek in progress</p>
        <p className='mt-1'>
          The live room opens while a gameweek is being played. Finished
          gameweeks are on standings and results.
        </p>
      </EmptyState>
    );
  }

  // Unavailable, and anything unrecognised: the feed or the picks could not be
  // read. This renders the explanatory state rather than throwing, and never a
  // board of zeros.
  return (
    <EmptyState>
      <p className='font-medium text-foreground'>Live feed unavailable</p>
      <p className='mt-1'>
        The live feed could not be read, so there is nothing provisional to
        show. Please try again later.
      </p>
    </EmptyState>
  );
}

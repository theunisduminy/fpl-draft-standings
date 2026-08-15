import { Suspense } from 'react';
import type { Metadata } from 'next';

import { getGameweekData } from '@/utils/gameweek-data';
import { standingsByGameweek, standingsMovement } from '@/utils/scoring';
import { StandingsTabs } from '@/components/TableView/StandingsTabs';
import { StandingsSkeleton } from '@/components/TableView/StandingsSkeleton';
import { SkeletonRegion } from '@/components/SkeletonRegion';
import { PageShell } from '@/components/Layout/PageShell';

export const metadata: Metadata = { title: 'Standings' };

// Reads live upstream data, so it is never prerendered.
export const dynamic = 'force-dynamic';

/**
 * The season is read once, on the server. The board and every chart below
 * render from the same object — previously they were two separate browser
 * fetches of overlapping data.
 *
 * `PageShell` paints the heading before the boundary is reached, so the
 * skeleton below stands in only for what is genuinely still loading.
 *
 * The boundary lives here rather than in a `loading.tsx` at the app root: that
 * would wrap every route beneath it, and flushing its shell commits the HTTP
 * status before `/players/[playerId]` can decide it is a 404. Segment-level
 * `loading.tsx` files exist for the routes that cannot 404.
 */
export default function Home() {
  return (
    <PageShell title='Standings' subtitle='FPL Draft league rankings'>
      <Suspense
        fallback={
          <SkeletonRegion>
            <StandingsSkeleton />
          </SkeletonRegion>
        }
      >
        <Standings />
      </Suspense>
    </PageShell>
  );
}

async function Standings() {
  const data = await getGameweekData();

  // One derivation, two surfaces: the move column and the bump chart are both
  // questions about this same series. See `scoring.ts`.
  const snapshots = standingsByGameweek(data.gameweekPerformances);

  return (
    <StandingsTabs
      data={data}
      snapshots={snapshots}
      movement={standingsMovement(snapshots)}
    />
  );
}

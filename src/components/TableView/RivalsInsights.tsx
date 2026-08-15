import React from 'react';

import { HeadToHeadGrid } from '@/components/TableView/HeadToHeadGrid';
import { PointsSpreadChart } from '@/components/TableView/PointsSpreadChart';
import { EmptyState } from '@/components/EmptyState';
import type { GameweekDataResponse } from '@/interfaces/players';

/**
 * The rivals tab: two ways of comparing managers to each other.
 *
 * The season tab is about time — where everyone stood, week by week. This one
 * deliberately has no time axis at all. Every card here is the whole season
 * collapsed into a comparison, which is the other half of the question people
 * actually argue about, and the half the site never answered.
 *
 * The same no-duplication test applies as on the season tab. The head-to-head
 * grid is **who beats whom**, which no ranking can express because the F1 table
 * cannot tell a one-point defeat from a hammering. Weekly scores is **how
 * reliable you are**. Two cards, two questions, no overlap.
 *
 * A third card lived here briefly and was cut: a slope chart of the F1 ranking
 * against `points_ranking`, meant to show who the format flatters. It read as a
 * curiosity rather than an answer — knowing you would be two places higher
 * under a scoring system nobody plays changes nothing about the season. The
 * derivation survives on `PlayerDetails` and is still unrendered; that is not
 * an oversight, and the next surface tempted by it should read this first.
 *
 * The grid goes first: it is the one people came for, and it is the only thing
 * on the site that names a rival rather than a rank.
 */
export default function RivalsInsights({
  data,
}: {
  data: GameweekDataResponse;
}) {
  if (data.players.length === 0 || data.gameweekPerformances.length === 0) {
    return <EmptyState>No results to compare yet.</EmptyState>;
  }

  return (
    <div className='w-full space-y-4'>
      <HeadToHeadGrid
        players={data.players}
        performances={data.gameweekPerformances}
      />

      <PointsSpreadChart
        players={data.players}
        performances={data.gameweekPerformances}
      />
    </div>
  );
}

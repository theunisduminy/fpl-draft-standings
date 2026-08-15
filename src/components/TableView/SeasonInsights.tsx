import React from 'react';

import { PositionDistributionChart } from '@/components/PlayerView/PositionDistributionChart';
import { FormGuide } from '@/components/PlayerView/FormGuide';
import { PositionBumpChart } from '@/components/PlayerView/PositionBumpChart';
import { EmptyState } from '@/components/EmptyState';
import type { GameweekDataResponse } from '@/interfaces/players';
import type { SeasonSnapshot } from '@/utils/scoring';

/**
 * The season tab: three charts, three different questions.
 *
 * No two of them answer the same one, which is the test anything added here
 * has to pass. The form guide is **now**, the distribution is the **shape** of
 * a season, the bump chart is **when** it changed hands. A lead strip used to
 * sit under the bump chart and was cut for failing that test — it was that
 * chart's top line, extracted.
 *
 * Ordered by how much reading each asks for: the first two are a glance each,
 * the bump chart rewards actually looking at it, so it goes last. The ledger
 * strip is not here; six one-line answers belong with the board, on the tab
 * people land on.
 *
 * `snapshots` arrives as a prop rather than being derived here, because the
 * board needs the same series for its move column. One derivation, computed
 * once on the server.
 */
export default function SeasonInsights({
  data,
  snapshots,
}: {
  data: GameweekDataResponse;
  snapshots: SeasonSnapshot[];
}) {
  if (data.players.length === 0) {
    return <EmptyState>No position data available yet.</EmptyState>;
  }

  const playerNames = Object.fromEntries(
    data.players.map((player) => [player.id, player.player_name]),
  );

  return (
    <div className='w-full space-y-4'>
      <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
        <PositionDistributionChart players={data.players} />
        <FormGuide
          performances={data.gameweekPerformances}
          playerNames={playerNames}
        />
      </div>

      <PositionBumpChart snapshots={snapshots} playerNames={playerNames} />
    </div>
  );
}

import React from 'react';

import { PositionHeatmap } from '@/components/PlayerView/PositionHeatmap';
import { FormGuide } from '@/components/PlayerView/FormGuide';
import { PositionBumpChart } from '@/components/PlayerView/PositionBumpChart';
import { EmptyState } from '@/components/EmptyState';
import type { GameweekDataResponse } from '@/interfaces/players';
import type { SeasonSnapshot } from '@/utils/scoring';

/**
 * The season tab: three charts, three different questions.
 *
 * No two of them answer the same one, which is the test anything added here
 * has to pass. The form guide is **now**, the heatmap is the **shape** of a
 * season, the bump chart is **when** it changed hands. A lead strip used to
 * sit under the bump chart and was cut for failing that test — it was that
 * chart's top line, extracted.
 *
 * Ordered by how much reading each asks for: the first two are a glance each,
 * the bump chart rewards actually looking at it, so it goes last. The ledger
 * strip is not here; six one-line answers belong with the board, on the tab
 * people land on.
 *
 * **The top row is two grids, not a chart and a grid.** It used to be a
 * stacked bar chart beside the form guide, and the pair never balanced: the
 * chart inherited an `aspect-square` default and grew to the width of its
 * column, leaving the form guide floating in half a card of nothing. Both
 * halves are now eight rows of the same height, so the row is level by
 * construction rather than by a tuned pixel value. The split waits for `lg`
 * because eight heat cells plus a name gutter is too much to fit in half a
 * tablet.
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
      {/* No `items-start`: the two cards are close in height but not identical
          (the heatmap carries a column-heading row and a ramp legend), and the
          grid's default stretch puts that difference *inside* the shorter card
          rather than as a gap below it. */}
      <div className='grid grid-cols-1 gap-4 lg:grid-cols-2'>
        <PositionHeatmap players={data.players} />
        <FormGuide
          performances={data.gameweekPerformances}
          playerNames={playerNames}
        />
      </div>

      <PositionBumpChart snapshots={snapshots} playerNames={playerNames} />
    </div>
  );
}

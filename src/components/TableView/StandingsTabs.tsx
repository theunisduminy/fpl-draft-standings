'use client';
import { Trophy, LineChart, Swords } from 'lucide-react';

import { SectionTabs } from '@/components/SectionTabs';
import StandingsTable from './StandingsTable';
import SeasonInsights from './SeasonInsights';
import RivalsInsights from './RivalsInsights';
import { LeagueLedger } from './LeagueLedger';
import type { StandingsContext } from './table-configs';
import { GameweekDataResponse } from '@/interfaces/players';
import type { SeasonSnapshot } from '@/utils/scoring';

/**
 * The board, and everything else behind a second tab.
 *
 * **One layout at every width.** It used to be tabs on a phone and a long
 * stacked scroll on a desktop, which is two layouts to keep in step and two
 * skeletons to keep honest — and the desktop one buried the board under a
 * screen and a half of charts the moment anyone scrolled. Landing on the
 * standings has to mean landing on the rankings, at any size, so the board is
 * the default tab and the charts are somewhere you choose to go.
 *
 * The strip is `SectionTabs`, the same primitive the rumblers page uses.
 *
 * Client-side for the tab state. The data arrives as a prop rather than being
 * fetched here, but note the panels below still ship to the browser: their
 * chart leaves are all `'use client'` for recharts, so there is no server
 * subtree to preserve by passing them in as slots.
 */
export function StandingsTabs({
  data,
  snapshots,
  movement,
}: {
  data: GameweekDataResponse;
  snapshots: SeasonSnapshot[];
} & StandingsContext) {
  return (
    <SectionTabs
      defaultValue='standings'
      tabs={[
        {
          value: 'standings',
          label: 'Standings',
          icon: Trophy,
          // The ledger sits with the board rather than with the charts: it is
          // six answers, not a thing to study, and the tab someone lands on is
          // where answers belong.
          className: 'space-y-4',
          content: (
            <>
              <StandingsTable players={data.players} movement={movement} />
              <LeagueLedger
                players={data.players}
                performances={data.gameweekPerformances}
              />
            </>
          ),
        },
        {
          value: 'season',
          label: 'Season',
          icon: LineChart,
          content: <SeasonInsights data={data} snapshots={snapshots} />,
        },
        // Season is the story over time; rivals is the season collapsed into
        // comparisons. Splitting them keeps either tab to three cards, which is
        // roughly a screen — six on one tab was a scroll nobody would finish.
        {
          value: 'rivals',
          label: 'Rivals',
          icon: Swords,
          content: <RivalsInsights data={data} />,
        },
      ]}
    />
  );
}

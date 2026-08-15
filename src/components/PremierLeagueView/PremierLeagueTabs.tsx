'use client';

import { CalendarDays, Table2 } from 'lucide-react';

import { SectionTabs } from '@/components/SectionTabs';
import { LeagueTable } from './LeagueTable';
import { FixtureBoard } from './FixtureBoard';
import type { PremierLeagueData } from '@/interfaces/premier-league';

/**
 * The table and the fixture list, behind the same strip the standings and
 * rumblers pages use.
 *
 * The table leads. Someone opening this page has a position in mind more often
 * than a kick-off time, and the fixture board is the one that costs a tap to
 * get back from because it holds its own gameweek state.
 *
 * `'use client'` for the tab state, which also makes both panels client
 * components. That is no loss here: `FixtureBoard` is one already, and
 * `LeagueTable` is pure markup over data that arrives as a prop.
 */
export function PremierLeagueTabs({ data }: { data: PremierLeagueData }) {
  return (
    <SectionTabs
      defaultValue='table'
      tabs={[
        {
          value: 'table',
          label: 'Table',
          icon: Table2,
          content: <LeagueTable rows={data.table} />,
        },
        {
          value: 'fixtures',
          // "Matches" rather than "Fixtures", because this one tab is both:
          // it opens on the current gameweek and scrolls back into played
          // ones, where the kick-off time becomes the score. "Fixtures" alone
          // made the results look missing, and spelling both out ran the
          // trigger to the edge of its half of the strip on a phone. A match
          // is a match whether it has been played or not.
          label: 'Matches',
          icon: CalendarDays,
          content: (
            <FixtureBoard
              gameweeks={data.gameweeks}
              initialGameweek={data.currentGameweek}
            />
          ),
        },
      ]}
    />
  );
}

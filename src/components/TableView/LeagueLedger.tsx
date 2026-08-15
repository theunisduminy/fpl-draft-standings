import { Flame, Medal, Ruler, Trophy, Beer, Zap } from 'lucide-react';

import { buildLeagueLedger, type LedgerFact } from '@/utils/scoring';
import type { GameweekPerformance, PlayerDetails } from '@/interfaces/players';
import type { LeagueEntryId } from '@/interfaces/fpl';

/**
 * The strip's own grid: six cells, hairline-divided by a 1px gap over the
 * border colour. Exported because `StandingsSkeleton` draws the same block and
 * a restated copy is how a loading shape drifts a breakpoint away from the real
 * one — the same reason `SECTION_TABS_STRIP_CLASS` exists.
 */
export const LEDGER_GRID_CLASS =
  'grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-3 lg:grid-cols-6';

/**
 * Six facts about the season, in one row.
 *
 * This was four cards in a two-by-two block above the position chart, and the
 * block competed with the chart it was introducing. One bordered object with
 * hairline divisions reads as a single strip instead: six cells across on a
 * desktop, three by two on a phone, no card shadows stacking up.
 *
 * The facts themselves are derived in the scoring layer, where they are pure
 * and tested. In particular "most rumblers" counts last places the way the
 * rumblers page counts them — the worst rank present that week, never rank 8 —
 * so the two surfaces cannot disagree, and "steadiest" measures the spread of
 * someone's finishes rather than how close their average is to mid-table,
 * which is what the old "most consistent" card actually rewarded.
 *
 * Presentational and pure: it derives from data the page already has and holds
 * no state. It still ships to the browser, because everything under
 * `StandingsTabs` does — that file is `'use client'` for its tab state, so
 * there is no server subtree beneath it to preserve.
 */
export function LeagueLedger({
  players,
  performances,
}: {
  players: PlayerDetails[];
  performances: GameweekPerformance[];
}) {
  const ledger = buildLeagueLedger(performances);
  const names = new Map<LeagueEntryId, string>(
    players.map((player) => [player.id, player.player_name]),
  );

  const cells = [
    {
      label: 'Most wins',
      icon: <Trophy className='h-3.5 w-3.5 text-yellow-400' />,
      fact: ledger.mostWins,
      detail: (fact: LedgerFact) => `${fact.value} gameweeks won`,
    },
    {
      label: 'Most podiums',
      icon: <Medal className='h-3.5 w-3.5 text-amber-500' />,
      fact: ledger.mostPodiums,
      detail: (fact: LedgerFact) => `${fact.value} top-three finishes`,
    },
    {
      label: 'Best week',
      icon: <Zap className='h-3.5 w-3.5 text-primary' />,
      fact: ledger.bestWeek,
      detail: (fact: LedgerFact) => `${fact.value} pts in GW${fact.gameweek}`,
    },
    {
      label: 'Steadiest',
      icon: <Ruler className='h-3.5 w-3.5 text-positive' />,
      fact: ledger.steadiest,
      detail: (fact: LedgerFact) => `±${fact.value.toFixed(1)} places`,
    },
    {
      label: 'Hot streak',
      icon: <Flame className='h-3.5 w-3.5 text-orange-400' />,
      fact: ledger.hotStreak,
      detail: (fact: LedgerFact) => `${fact.value} podiums in a row`,
    },
    {
      label: 'Most rumblers',
      icon: <Beer className='h-3.5 w-3.5 text-negative' />,
      fact: ledger.mostRumblers,
      detail: (fact: LedgerFact) => `${fact.value} last places`,
    },
  ];

  return (
    <div className={LEDGER_GRID_CLASS}>
      {cells.map((cell) => (
        <div key={cell.label} className='bg-card p-3 md:p-3.5'>
          <div className='flex items-center gap-1.5'>
            {cell.icon}
            <span className='truncate text-[11px] tracking-wide text-muted-foreground uppercase'>
              {cell.label}
            </span>
          </div>
          <p className='mt-1.5 truncate text-sm font-semibold text-foreground'>
            {cell.fact ? (names.get(cell.fact.league_entry) ?? 'Unknown') : '–'}
          </p>
          <p className='truncate text-xs text-muted-foreground'>
            {cell.fact ? cell.detail(cell.fact) : 'Not yet'}
          </p>
        </div>
      ))}
    </div>
  );
}

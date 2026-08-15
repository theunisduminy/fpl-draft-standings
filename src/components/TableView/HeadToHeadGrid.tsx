'use client';

import { ChartCard } from '@/components/ChartCard';
import { CellTooltip, CellTooltipProvider } from '@/components/CellTooltip';
import { buildHeadToHead } from '@/utils/scoring';
import { versusBand, type VersusBand } from '@/utils/chart-scales';
import { initials, nameFor, nameLookup } from '@/utils/player-names';
import type { GameweekPerformance, PlayerDetails } from '@/interfaces/players';
import { cn } from '@/lib/utils';

/**
 * Who has outscored whom, every pair, all season.
 *
 * The league ranks on finishing positions, which means a manager can lose a
 * week to seven people and to one of them by a single point, and nothing else
 * on the site can tell those apart. Read a row across and it is one manager's
 * record against each of the others; read the totals column and it is a third
 * way to rank the league, after F1 score and after raw points.
 *
 * **Diverging colour, because the comparison is two-sided.** A dominant record
 * and a dominated one are opposites, not two points on one scale, so the ramp
 * runs green through a neutral middle to red with no hue at the midpoint. Green
 * and red are also the pair colourblind readers separate worst, which is why
 * every cell prints its record: the colour is the scan layer and the number is
 * the answer. Never the other way round.
 *
 * On a phone the column headings fall back to initials, with the full name in
 * each cell's tooltip. Eight names across simply does not fit, and a
 * horizontally scrolling grid hides exactly the comparison the grid exists to
 * make.
 */
export function HeadToHeadGrid({
  players,
  performances,
}: {
  players: PlayerDetails[];
  performances: GameweekPerformance[];
}) {
  const names = nameLookup(players);

  // `players` already carries league order, so walking it is the axis. Sorting
  // the rows from `buildHeadToHead` instead would mean a second ranking lookup
  // to sort by — and its `against` lists are positional, so re-sorting the rows
  // would silently break the correspondence anyway. Records are found by
  // opponent throughout.
  const byEntry = new Map(
    buildHeadToHead(performances).map((row) => [row.league_entry, row]),
  );
  // `map`, not `flatMap` with a drop. A manager present in `players` but not
  // yet in `performances` — pre-season, or before their first scored gameweek —
  // used to lose their row *and* their column, so the grid stayed square and
  // looked correct while quietly showing a seven-manager league.
  const ordered = [...players]
    .sort((a, b) => a.f1_ranking - b.f1_ranking)
    .map(
      (player) =>
        byEntry.get(player.id) ?? {
          league_entry: player.id,
          against: [],
          totalWon: 0,
          totalDrawn: 0,
          totalLost: 0,
        },
    );
  const columns = ordered.map((row) => row.league_entry);

  return (
    <ChartCard
      title='Head to head'
      caption='Gameweeks each manager has outscored each other, won to drawn to lost'
    >
      <CellTooltipProvider>
        <div className='space-y-1.5'>
          <div className='flex items-end gap-2'>
            <span className='w-16 md:w-24' />
            <div className='flex flex-1 gap-1'>
              {/* `min-w-0` is what actually stops these wrapping. A flex item
                  defaults to `min-width: auto`, so `flex-1` alone will not let a
                  column shrink below its longest name and the row breaks instead
                  of truncating. */}
              {columns.map((entry) => (
                <CellTooltip key={entry} label={nameFor(names, entry)}>
                  <span className='min-w-0 flex-1 truncate text-center text-[10px] whitespace-nowrap text-muted-foreground lg:text-xs'>
                    <span className='lg:hidden'>
                      {initials(nameFor(names, entry))}
                    </span>
                    <span className='hidden lg:inline'>
                      {nameFor(names, entry)}
                    </span>
                  </span>
                </CellTooltip>
              ))}
            </div>
            <span className='w-10 shrink-0 text-center text-[10px] whitespace-nowrap text-muted-foreground md:w-14 md:text-xs'>
              Total
            </span>
          </div>

          {ordered.map((row) => {
            const against = new Map(
              row.against.map((record) => [record.opponent, record]),
            );

            return (
              <div key={row.league_entry} className='flex items-center gap-2'>
                <span className='w-16 truncate text-xs font-medium text-muted-foreground md:w-24 md:text-sm'>
                  {nameFor(names, row.league_entry)}
                </span>
                <div className='flex flex-1 gap-1'>
                  {columns.map((opponent) => {
                    const record = against.get(opponent);

                    if (!record) {
                      // The diagonal. Left blank rather than filled, so the eye
                      // has a reference line running through the grid.
                      return (
                        <span
                          key={opponent}
                          className='h-8 min-w-0 flex-1 rounded-md border border-dashed border-border/60 md:h-9'
                        />
                      );
                    }

                    return (
                      <CellTooltip
                        key={opponent}
                        label={`${nameFor(names, row.league_entry)} v ${nameFor(
                          names,
                          opponent,
                        )}: ${record.won} won, ${record.drawn} drawn, ${
                          record.lost
                        } lost`}
                      >
                        <span
                          className={cn(
                            'flex h-8 min-w-0 flex-1 items-center justify-center rounded-md text-[10px] font-semibold whitespace-nowrap text-foreground tabular-nums md:h-9 md:text-xs',
                            VERSUS_SHADE[
                              versusBand(record.won, record.drawn, record.lost)
                            ],
                          )}
                        >
                          {record.won}–{record.drawn}–{record.lost}
                        </span>
                      </CellTooltip>
                    );
                  })}
                </div>
                <CellTooltip
                  label={`${nameFor(names, row.league_entry)} across the whole league: ${
                    row.totalWon
                  } won, ${row.totalDrawn} drawn, ${row.totalLost} lost`}
                >
                  <span className='w-10 shrink-0 text-center text-xs font-semibold whitespace-nowrap text-foreground tabular-nums md:w-14 md:text-sm'>
                    {row.totalWon}
                    <span className='text-muted-foreground'>
                      –{row.totalDrawn}–{row.totalLost}
                    </span>
                  </span>
                </CellTooltip>
              </div>
            );
          })}
        </div>
      </CellTooltipProvider>
    </ChartCard>
  );
}

/**
 * The diverging ramp, one fill per band.
 *
 * Which band a record falls in is decided by `versusBand` in the scoring
 * utilities, where it is pure and tested; this map is the only part that is a
 * presentation choice. That split is deliberate — the band rule had two defects
 * while it lived in here as an untested helper.
 */
const VERSUS_SHADE: Record<VersusBand, string> = {
  strong: 'bg-versus-strong',
  good: 'bg-versus-good',
  even: 'bg-versus-even',
  poor: 'bg-versus-poor',
  weak: 'bg-versus-weak',
};

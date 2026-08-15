'use client';

import { ChartCard } from '@/components/ChartCard';
import { CellTooltip, CellTooltipProvider } from '@/components/CellTooltip';
import { buildHeadToHead } from '@/utils/scoring';
import { versusBand, type VersusBand } from '@/utils/chart-scales';
import { nameFor, nameLookup } from '@/utils/player-names';
import type { GameweekPerformance, PlayerDetails } from '@/interfaces/players';
import { cn } from '@/lib/utils';

/**
 * Who has outscored whom, every pair, all season.
 *
 * The league ranks on finishing positions, which means a manager can lose a
 * week to seven people and to one of them by a single point, and nothing else
 * on the site can tell those apart. Read a row across and it is one manager's
 * record against each of the others.
 *
 * **Diverging colour, because the comparison is two-sided.** A dominant record
 * and a dominated one are opposites, not two points on one scale, so the ramp
 * runs green through a neutral middle to red with no hue at the midpoint. Green
 * and red are also the pair colourblind readers separate worst, which is why
 * every cell prints its record: the colour is the scan layer and the number is
 * the answer. Never the other way round.
 *
 * **One layout, and it scrolls.** Eight opponent columns plus a name gutter
 * need more width than a phone has, and squeezing them to fit produced cells
 * too narrow to hold `12-3-5` at all. Rather than a
 * second mobile layout to keep in step, the grid keeps its real width and
 * scrolls sideways inside the card, with the name column pinned so a row stays
 * identifiable however far across you swipe.
 *
 * Because it scrolls, the columns can afford real names at every width. They
 * were initials below `lg`, which made the top row of a grid *of managers* the
 * one place their names could not be read — and the tooltip that would resolve
 * a collision is the layer keyboard users never reach. A swipe is a cheaper
 * price than the axis.
 *
 * **Every column is a fixed width, and nothing in a row is `flex-1`.** That is
 * what makes the grid overflow rather than compress: a `flex-1` middle section
 * sizes itself to the space available, so the row always fitted, the cells were
 * crushed below legibility, and the scroll container had nothing to scroll.
 */
/**
 * The pinned name gutter.
 *
 * Three things here are load-bearing for the freeze, and the column looked
 * broken without them even though `sticky left-0` was already set:
 *
 * - `self-stretch` — the background must be as tall as the row. A span sized to
 *   its text painted a strip the height of the words, so the coloured cells
 *   scrolled *under the name and out the top and bottom of it*.
 * - `pr-2` instead of a gap on the row — a gap between the gutter and the cells
 *   is a transparent seam, and cells slide visibly through it.
 * - `bg-card` — the card's own colour, so the covered cells are hidden rather
 *   than tinted. Anything translucent shows the traffic underneath.
 */
const H2H_GUTTER =
  'sticky left-0 z-20 flex w-20 shrink-0 items-center md:w-24 self-stretch bg-card pr-2';

/**
 * One data column.
 *
 * Fixed below `lg` and flexible at or above it, which is the whole scroll
 * policy in one class list. A phone cannot fit eight columns at a legible
 * width, so there the column holds its size and the grid overflows into the
 * scroll container. A desktop can, so there the columns share the row and the
 * grid fits exactly — a horizontal scrollbar on a screen with room to spare is
 * just a worse table.
 *
 * `lg:min-w-0` is required for the truncate above to work once the column is
 * flexible; without it a long name sets the column's floor and the row starts
 * overflowing again on the one screen that should never scroll.
 */
const H2H_CELL = 'w-20 shrink-0 lg:w-auto lg:min-w-0 lg:flex-1';

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
        byEntry.get(player.id) ?? { league_entry: player.id, against: [] },
    );
  const columns = ordered.map((row) => row.league_entry);

  return (
    <ChartCard
      title='Head to head'
      caption='Gameweeks each manager has outscored each other, won to drawn to lost'
    >
      <CellTooltipProvider>
        {/* No horizontal padding on the scroll container: `left-0` pins to its
            content edge, so padding here would leave a gap the columns slide
            through beside the frozen name. */}
        <div className='overflow-x-auto'>
          <div className='w-max space-y-1.5 lg:w-full'>
            <div className='flex items-end'>
              <span className={H2H_GUTTER} aria-hidden />
              <div className='flex gap-1 lg:flex-1'>
                {columns.map((entry) => (
                  <CellTooltip key={entry} label={nameFor(names, entry)}>
                    <span
                      className={cn(
                        H2H_CELL,
                        'truncate text-center text-[10px] whitespace-nowrap text-muted-foreground md:text-xs',
                      )}
                    >
                      {nameFor(names, entry)}
                    </span>
                  </CellTooltip>
                ))}
              </div>
            </div>

            {ordered.map((row) => {
              const against = new Map(
                row.against.map((record) => [record.opponent, record]),
              );

              return (
                <div key={row.league_entry} className='flex items-center'>
                  {/* Pinned, and opaque: the cells scroll underneath it. */}
                  <span className={H2H_GUTTER}>
                    <span className='truncate text-xs font-medium text-muted-foreground md:text-sm'>
                      {nameFor(names, row.league_entry)}
                    </span>
                  </span>
                  <div className='flex gap-1 lg:flex-1'>
                    {columns.map((opponent) => {
                      const record = against.get(opponent);

                      if (!record) {
                        // The diagonal. Left blank rather than filled, so the
                        // eye has a reference line running through the grid.
                        return (
                          <span
                            key={opponent}
                            className={cn(
                              H2H_CELL,
                              'h-8 rounded-md border border-dashed border-border/60 md:h-9',
                            )}
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
                              H2H_CELL,
                              'flex h-8 items-center justify-center rounded-md text-[10px] font-semibold whitespace-nowrap text-foreground tabular-nums md:h-9 md:text-xs',
                              VERSUS_SHADE[
                                versusBand(
                                  record.won,
                                  record.drawn,
                                  record.lost,
                                )
                              ],
                            )}
                          >
                            {record.won}-{record.drawn}-{record.lost}
                          </span>
                        </CellTooltip>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
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

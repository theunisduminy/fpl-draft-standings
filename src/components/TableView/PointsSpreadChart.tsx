'use client';

import { ChartCard } from '@/components/ChartCard';
import { CellTooltip, CellTooltipProvider } from '@/components/CellTooltip';
import { CARD_ROW, CARD_ROW_GUTTER, CARD_ROW_NAME } from '@/components/shapes';
import { buildPointsSpread } from '@/utils/scoring';
import { nameFor, nameLookup } from '@/utils/player-names';
import type { GameweekPerformance, PlayerDetails } from '@/interfaces/players';
import { cn } from '@/lib/utils';

/**
 * Every manager's weekly scores, as a spread rather than an average.
 *
 * The league ledger already names the steadiest manager and the single best
 * week of the season. Those are facts; this is the shape they came out of, and
 * it answers what a fact cannot: whether a good average is a floor someone
 * rarely drops below, or two enormous weeks carrying a run of bad ones. Two
 * managers can average the same and have had nothing like the same season.
 *
 * **This is why it survives the no-duplication rule** the season tab is held
 * to. "Best week" is one number from one manager; the whiskers here are the
 * best and worst week of all eight, on one scale, next to the middle half of
 * each of their seasons. Neither says the other's thing.
 *
 * The bar is the interquartile range, the tick inside it is the median, the
 * whiskers reach the best and worst weeks, and each faint dot is one gameweek.
 * The scale is shared across every row and is the only way to read the chart,
 * so it is drawn once at the bottom rather than per row.
 *
 * Rows are ordered by median, best first, which is deliberately *not* league
 * order: the interesting readings here are the managers whose row sits higher
 * or lower than their league position, and sorting by the thing being drawn is
 * what makes those visible.
 *
 * Hand-built with CSS percentages rather than a chart library. A box plot is
 * five numbers on a shared axis, the rows have to match the grammar of the
 * grids on the other tabs, and `ChartContainer` would force an aspect ratio
 * onto something whose height is simply eight rows.
 */
export function PointsSpreadChart({
  players,
  performances,
}: {
  players: PlayerDetails[];
  performances: GameweekPerformance[];
}) {
  const spreads = buildPointsSpread(performances);

  if (spreads.length === 0) return null;

  const names = nameLookup(players);

  // One scale for every row, padded so the extremes are not flush to the edge.
  const lowest = Math.min(...spreads.map((spread) => spread.lowest));
  const highest = Math.max(...spreads.map((spread) => spread.highest));
  const pad = Math.max(2, Math.round((highest - lowest) * 0.06));
  const floor = Math.max(0, lowest - pad);
  const ceiling = highest + pad;
  const span = ceiling - floor || 1;

  const at = (points: number) => ((points - floor) / span) * 100;

  const ordered = [...spreads].sort((a, b) => b.median - a.median);

  return (
    <ChartCard
      title='Weekly scores'
      caption='The middle half of each season, best and worst week at the ends'
    >
      <CellTooltipProvider>
        <div className='space-y-2.5'>
          {ordered.map((spread) => {
            const name = nameFor(names, spread.league_entry);

            return (
              <div key={spread.league_entry} className={CARD_ROW}>
                <span className={cn(CARD_ROW_GUTTER, CARD_ROW_NAME)}>
                  {name}
                </span>
                <CellTooltip
                  label={`${name}: usually ${Math.round(spread.q1)} to ${Math.round(
                    spread.q3,
                  )}, median ${Math.round(spread.median)}. Best week ${
                    spread.highest
                  }, worst ${spread.lowest}`}
                >
                  <div className='relative h-8 flex-1 md:h-9'>
                    {/* Whisker: worst week to best week. */}
                    <span
                      className='absolute top-1/2 h-px -translate-y-1/2 bg-border'
                      style={{
                        left: `${at(spread.lowest)}%`,
                        width: `${at(spread.highest) - at(spread.lowest)}%`,
                      }}
                    />

                    {/* Every gameweek, so an outlier is visible as itself rather
                      than only as a whisker that reaches further than it should. */}
                    {spread.scores.map((score, index) => (
                      <span
                        key={`${score}-${index}`}
                        className='absolute top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-foreground/25'
                        style={{ left: `${at(score)}%` }}
                      />
                    ))}

                    {/* The middle half of the season. */}
                    <span
                      className='absolute top-1/2 h-5 -translate-y-1/2 rounded-md bg-primary/25 ring-1 ring-primary/40 md:h-6'
                      style={{
                        left: `${at(spread.q1)}%`,
                        width: `${Math.max(at(spread.q3) - at(spread.q1), 0.6)}%`,
                      }}
                    />

                    {/* Median. */}
                    <span
                      className='absolute top-1/2 h-5 w-0.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary md:h-6'
                      style={{ left: `${at(spread.median)}%` }}
                    />
                  </div>
                </CellTooltip>
              </div>
            );
          })}
        </div>
      </CellTooltipProvider>

      <div className={cn(CARD_ROW, 'mt-4 border-t border-border pt-3')}>
        <span className={CARD_ROW_GUTTER} />
        <div className='relative h-4 flex-1'>
          {scaleTicks(floor, ceiling).map((tick) => (
            <span
              key={tick}
              className='absolute -translate-x-1/2 text-[10px] text-muted-foreground tabular-nums md:text-xs'
              style={{ left: `${at(tick)}%` }}
            >
              {tick}
            </span>
          ))}
        </div>
      </div>
    </ChartCard>
  );
}

/**
 * Four or five round numbers across the scale.
 *
 * Stepped to a multiple of ten so the labels read as scores rather than as
 * whatever the extremes happened to be, and clipped to the ends so a tick never
 * hangs off the edge of the row it is labelling.
 */
function scaleTicks(floor: number, ceiling: number): number[] {
  const step = Math.max(10, Math.ceil((ceiling - floor) / 4 / 10) * 10);
  const first = Math.ceil(floor / step) * step;
  const ticks: number[] = [];

  for (let tick = first; tick <= ceiling; tick += step) ticks.push(tick);

  return ticks;
}

'use client';

import { ChartCard } from '@/components/ChartCard';
import { CellTooltip, CellTooltipProvider } from '@/components/CellTooltip';
import {
  CARD_CELL,
  CARD_COLUMN_HEADING,
  CARD_ROW,
  CARD_ROW_CELLS,
  CARD_ROW_GUTTER,
  CARD_ROW_NAME,
} from '@/components/shapes';
import {
  POSITION_KEYS,
  POSITION_LABELS,
  type PlayerDetails,
} from '@/interfaces/players';
import { heatStep, MIN_DECISIVE_MEETINGS } from '@/utils/chart-scales';
import { cn } from '@/lib/utils';

/**
 * How often each manager finished in each place, as a grid.
 *
 * This replaces a stacked bar chart, and the reason is worth keeping. Every
 * manager plays the same number of gameweeks, so every bar summed to the same
 * total and **bar length carried no information at all** — the only readable
 * thing was where the segment boundaries fell, which asked the reader to
 * compare eight lengths buried inside one bar. A grid puts the same eight
 * numbers on a shared scale where a column can be scanned down and a row
 * across, which is how the questions are actually asked: "who wins most" is a
 * column, "how streaky is this manager" is a row.
 *
 * It is also not a recharts chart, which is the second half of the fix. The
 * bar chart inherited `ChartContainer`'s `aspect-square` default and rendered
 * as a tall square in a half-width column, towering over the form guide beside
 * it. A CSS grid is as tall as its rows, and its rows are deliberately the same
 * height as the form guide's, so the pair sits flush.
 *
 * Colour is a single-hue ramp scaled to the busiest cell in the grid, not to a
 * fixed ceiling: early in a season nothing would light up otherwise. The
 * number is printed as well, so the colour is the scan layer and never the only
 * encoding.
 *
 * Rows are in league order, so the diagonal is the story: a tidy top-left to
 * bottom-right smear means the table is behaving, and a bright cell far off it
 * is someone whose season does not match their position.
 */

/** Ramp step 0 is "never", 1 to 5 climb to the busiest cell in the grid. */
const HEAT_STEPS = [
  'bg-heat-0',
  'bg-heat-1',
  'bg-heat-2',
  'bg-heat-3',
  'bg-heat-4',
  'bg-heat-5',
] as const;

/** Above this step the fill is bright enough to need dark ink on it. */
const DARK_INK_FROM = 4;

export function PositionHeatmap({ players }: { players: PlayerDetails[] }) {
  const rows = [...players].sort((a, b) => a.f1_ranking - b.f1_ranking);

  // The scale for the whole grid, so a cell's colour means the same thing in
  // every row. `heatStep` floors it, which is what stops a one-gameweek season
  // painting every played cell at full intensity.
  const busiest = Math.max(
    0,
    ...rows.flatMap((player) =>
      POSITION_KEYS.map((key) => player.position_placed[key]),
    ),
  );

  return (
    <ChartCard title='Season shape' caption='Gameweeks finished in each place'>
      <CellTooltipProvider>
        <div className='space-y-2.5'>
          {/* Column headings share the row grammar below so the cells line up:
              same name gutter, same gap, same flex-1 columns. */}
          <div className={CARD_ROW}>
            <span className={CARD_ROW_GUTTER} />
            <div className={CARD_ROW_CELLS}>
              {POSITION_LABELS.map((label) => (
                <span key={label} className={CARD_COLUMN_HEADING}>
                  {label}
                </span>
              ))}
            </div>
          </div>

          {rows.map((player) => (
            <div key={player.id} className={CARD_ROW}>
              <span className={cn(CARD_ROW_GUTTER, CARD_ROW_NAME)}>
                {player.player_name}
              </span>
              <div className={CARD_ROW_CELLS}>
                {POSITION_KEYS.map((key, index) => {
                  const count = player.position_placed[key];
                  const step = heatStep(count, busiest);

                  return (
                    <CellTooltip
                      key={key}
                      label={`${player.player_name}: ${count} ${
                        count === 1 ? 'finish' : 'finishes'
                      } in ${POSITION_LABELS[index]}`}
                    >
                      <div
                        className={cn(
                          CARD_CELL,
                          'flex items-center justify-center rounded-md text-xs font-bold tabular-nums md:text-sm',
                          HEAT_STEPS[step],
                          step === 0
                            ? 'text-muted-foreground/40'
                            : step >= DARK_INK_FROM
                              ? 'text-primary-foreground'
                              : 'text-foreground',
                        )}
                      >
                        {step === 0 ? '·' : count}
                      </div>
                    </CellTooltip>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </CellTooltipProvider>

      <div className='mt-4 flex items-center justify-end gap-2 border-t border-border pt-3'>
        <span className='text-xs text-muted-foreground'>Never</span>
        {HEAT_STEPS.map((step) => (
          <span key={step} className={cn('h-3 w-5 rounded-sm', step)} />
        ))}
        {/* What the brightest step actually stands for, which is the floored
            scale rather than the raw busiest cell — otherwise the legend
            promises an intensity the grid never reaches early in a season. */}
        <span className='text-xs text-muted-foreground'>
          {Math.max(MIN_DECISIVE_MEETINGS, busiest)} times
        </span>
      </div>
    </ChartCard>
  );
}

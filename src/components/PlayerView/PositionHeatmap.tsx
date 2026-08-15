'use client';

import { ChartCard } from '@/components/ChartCard';
import { CellTooltip, CellTooltipProvider } from '@/components/CellTooltip';
import { POSITION_KEYS, type PlayerDetails } from '@/interfaces/players';
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

const POSITION_LABELS = [
  '1st',
  '2nd',
  '3rd',
  '4th',
  '5th',
  '6th',
  '7th',
  '8th',
];

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

  const busiest = Math.max(
    1,
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
          <div className='flex items-center gap-3'>
            <span className='w-20 md:w-24' />
            <div className='flex flex-1 gap-1.5'>
              {POSITION_LABELS.map((label) => (
                <span
                  key={label}
                  className='flex-1 text-center text-[10px] text-muted-foreground md:text-xs'
                >
                  {label}
                </span>
              ))}
            </div>
          </div>

          {rows.map((player) => (
            <div key={player.id} className='flex items-center gap-3'>
              <span className='w-20 truncate text-xs font-medium text-muted-foreground md:w-24 md:text-sm'>
                {player.player_name}
              </span>
              <div className='flex flex-1 gap-1.5'>
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
                          'flex h-8 min-w-0 flex-1 items-center justify-center rounded-md text-xs font-bold tabular-nums md:h-9 md:text-sm',
                          HEAT_STEPS[step],
                          count === 0
                            ? 'text-muted-foreground/40'
                            : step >= DARK_INK_FROM
                              ? 'text-primary-foreground'
                              : 'text-foreground',
                        )}
                      >
                        {count === 0 ? '·' : count}
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
        <span className='text-xs text-muted-foreground'>
          {busiest}
          {busiest === 1 ? ' time' : ' times'}
        </span>
      </div>
    </ChartCard>
  );
}

/**
 * Map a count onto the ramp, scaled to the busiest cell present.
 *
 * Zero is its own step rather than the bottom of the ramp: "never finished
 * here" is a different statement from "finished here least often", and the
 * grid is much easier to scan when the empties recede completely.
 */
function heatStep(count: number, busiest: number): number {
  if (count === 0) return 0;

  return Math.max(1, Math.ceil((count / busiest) * (HEAT_STEPS.length - 1)));
}

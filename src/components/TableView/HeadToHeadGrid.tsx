'use client';

import { ChartCard } from '@/components/ChartCard';
import { CellTooltip, CellTooltipProvider } from '@/components/CellTooltip';
import { buildHeadToHead } from '@/utils/scoring';
import type { GameweekPerformance, PlayerDetails } from '@/interfaces/players';
import type { LeagueEntryId } from '@/interfaces/fpl';
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
  const rows = buildHeadToHead(performances);

  const names = new Map<LeagueEntryId, string>(
    players.map((player) => [player.id, player.player_name]),
  );
  const nameFor = (entry: LeagueEntryId) => names.get(entry) ?? `#${entry}`;

  // League order, so the grid agrees with the board rather than with whatever
  // order the performances happened to arrive in.
  const order = new Map<LeagueEntryId, number>(
    players.map((player) => [player.id, player.f1_ranking]),
  );
  const ordered = [...rows].sort(
    (a, b) =>
      (order.get(a.league_entry) ?? 0) - (order.get(b.league_entry) ?? 0),
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
                <CellTooltip key={entry} label={nameFor(entry)}>
                  <span className='min-w-0 flex-1 truncate text-center text-[10px] whitespace-nowrap text-muted-foreground lg:text-xs'>
                    <span className='lg:hidden'>
                      {initials(nameFor(entry))}
                    </span>
                    <span className='hidden lg:inline'>{nameFor(entry)}</span>
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
                  {nameFor(row.league_entry)}
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
                        label={`${nameFor(row.league_entry)} v ${nameFor(
                          opponent,
                        )}: ${record.won} won, ${record.drawn} drawn, ${
                          record.lost
                        } lost`}
                      >
                        <span
                          className={cn(
                            'flex h-8 min-w-0 flex-1 items-center justify-center rounded-md text-[10px] font-semibold whitespace-nowrap text-foreground tabular-nums md:h-9 md:text-xs',
                            versusShade(record.won, record.lost, record.played),
                          )}
                        >
                          {record.won}–{record.drawn}–{record.lost}
                        </span>
                      </CellTooltip>
                    );
                  })}
                </div>
                <CellTooltip
                  label={`${nameFor(row.league_entry)} across the whole league: ${
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
 * Pick a step on the diverging ramp from a record's win share.
 *
 * The bands are deliberately wide around the middle: with a dozen or so
 * meetings, six-five is noise, and colouring it as an advantage would invite
 * people to read a pattern that is not there. A pair who have never met is
 * neutral rather than even, which is the same shade for a different reason.
 */
function versusShade(won: number, lost: number, played: number): string {
  if (played === 0) return 'bg-versus-even';

  const share = won / (won + lost || 1);

  if (share >= 0.7) return 'bg-versus-strong';
  if (share >= 0.56) return 'bg-versus-good';
  if (share > 0.44) return 'bg-versus-even';
  if (share > 0.3) return 'bg-versus-poor';

  return 'bg-versus-weak';
}

/** First letters, for a column heading too narrow to hold a name. */
function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((part) => part[0] ?? '')
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

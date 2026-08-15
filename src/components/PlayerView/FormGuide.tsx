'use client';

import { ChartCard } from '@/components/ChartCard';
import { CellTooltip, CellTooltipProvider } from '@/components/CellTooltip';
import { GameweekPerformance } from '@/interfaces/players';

interface FormGuideProps {
  performances: GameweekPerformance[];
  playerNames: Record<number, string>;
}

const RANK_COLORS: Record<number, string> = {
  1: 'bg-yellow-400 text-[#1a0520]',
  2: 'bg-gray-300 text-[#1a0520]',
  3: 'bg-amber-500 text-[#1a0520]',
  4: 'bg-blue-400 text-white',
  5: 'bg-green-400 text-[#1a0520]',
  6: 'bg-orange-400 text-[#1a0520]',
  7: 'bg-purple-400 text-white',
  8: 'bg-red-400 text-white',
};

export function FormGuide({ performances, playerNames }: FormGuideProps) {
  // The five columns are gameweeks, decided once for the whole card rather than
  // per player. Slicing each manager's own last five would let two rows in the
  // same column mean different weeks the moment anyone is missing one, which is
  // exactly what the headings below now promise cannot happen.
  //
  // Newest on the left, so the card is read the way it is asked: "how is
  // everyone doing *now*" wants the latest result where the eye lands first,
  // not five columns away at the end of the row.
  const events = [...new Set(performances.map((p) => p.event))]
    .sort((a, b) => b - a)
    .slice(0, 5);

  const byPlayer: Record<number, GameweekPerformance[]> = {};
  performances.forEach((p) => {
    if (!byPlayer[p.league_entry]) byPlayer[p.league_entry] = [];
    byPlayer[p.league_entry].push(p);
  });

  const players = Object.entries(byPlayer)
    .map(([id, perf]) => {
      const byEvent = new Map(perf.map((p) => [p.event, p]));
      const last5 = events.map((event) => byEvent.get(event) ?? null);
      const played = last5.filter((p) => p !== null);
      const avgRank =
        played.reduce((sum, p) => sum + p.rank, 0) / (played.length || 1);

      return {
        playerId: parseInt(id),
        playerName: playerNames[parseInt(id)] || `Player ${id}`,
        last5,
        avgRank,
      };
    })
    .sort((a, b) => a.avgRank - b.avgRank);

  return (
    <ChartCard title='Form guide' caption='Last 5 gameweeks'>
      <CellTooltipProvider>
        <div className='space-y-2.5'>
          {/* Headings share the row grammar below — same name gutter, same gap,
              same flex-1 columns — so a chip sits under its gameweek. This row
              is also what levels the card against the heatmap beside it, which
              carries a heading row of its own. */}
          <div className='flex items-center gap-3'>
            <span className='w-20 md:w-24' />
            <div className='flex flex-1 gap-1.5'>
              {events.map((event) => (
                <span
                  key={event}
                  className='min-w-0 flex-1 text-center text-[10px] whitespace-nowrap text-muted-foreground md:text-xs'
                >
                  GW{event}
                </span>
              ))}
            </div>
          </div>

          {players.map((player) => (
            <div key={player.playerId} className='flex items-center gap-3'>
              <span className='w-20 truncate text-xs font-medium text-muted-foreground md:w-24 md:text-sm'>
                {player.playerName}
              </span>
              <div className='flex flex-1 gap-1.5'>
                {player.last5.map((perf, i) =>
                  perf ? (
                    <CellTooltip
                      key={events[i]}
                      label={`${player.playerName}, GW${perf.event}: finished ${ordinal(
                        perf.rank,
                      )} on ${perf.event_total} points`}
                    >
                      <div
                        className={`flex h-8 min-w-0 flex-1 items-center justify-center rounded-md text-xs font-bold md:h-9 md:text-sm ${
                          RANK_COLORS[perf.rank] || 'bg-white/10 text-white'
                        }`}
                      >
                        {perf.rank}
                      </div>
                    </CellTooltip>
                  ) : (
                    <CellTooltip
                      key={events[i]}
                      label={`${player.playerName}, GW${events[i]}: no result`}
                    >
                      <div className='flex h-8 min-w-0 flex-1 items-center justify-center rounded-md bg-white/5 text-xs text-white/20 md:h-9'>
                        -
                      </div>
                    </CellTooltip>
                  ),
                )}
              </div>
            </div>
          ))}
        </div>
      </CellTooltipProvider>
    </ChartCard>
  );
}

/** "1st", "2nd", "3rd", … for tooltip prose. The league is eight managers. */
function ordinal(rank: number): string {
  const suffixes = ['th', 'st', 'nd', 'rd'];
  const value = rank % 100;

  return `${rank}${suffixes[(value - 20) % 10] ?? suffixes[value] ?? suffixes[0]}`;
}

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
import { POSITION_LABELS, GameweekPerformance } from '@/interfaces/players';
import { asLeagueEntryId } from '@/interfaces/fpl';
import { nameFor } from '@/utils/player-names';
import { cn } from '@/lib/utils';

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
        playerName: nameFor(playerNames, asLeagueEntryId(parseInt(id))),
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
          <div className={CARD_ROW}>
            <span className={CARD_ROW_GUTTER} />
            <div className={CARD_ROW_CELLS}>
              {events.map((event) => (
                <span key={event} className={CARD_COLUMN_HEADING}>
                  GW{event}
                </span>
              ))}
            </div>
          </div>

          {players.map((player) => (
            <div key={player.playerId} className={CARD_ROW}>
              <span className={cn(CARD_ROW_GUTTER, CARD_ROW_NAME)}>
                {player.playerName}
              </span>
              <div className={CARD_ROW_CELLS}>
                {player.last5.map((perf, i) => (
                  <CellTooltip
                    key={events[i]}
                    label={
                      perf
                        ? `${player.playerName}, GW${perf.event}: finished ${
                            POSITION_LABELS[perf.rank - 1] ?? perf.rank
                          } on ${perf.event_total} points`
                        : `${player.playerName}, GW${events[i]}: no result`
                    }
                  >
                    <div
                      className={cn(
                        CARD_CELL,
                        'flex items-center justify-center rounded-md text-xs font-bold md:text-sm',
                        perf
                          ? (RANK_COLORS[perf.rank] ?? 'bg-white/10 text-white')
                          : 'bg-white/5 font-normal text-white/20',
                      )}
                    >
                      {perf ? perf.rank : '-'}
                    </div>
                  </CellTooltip>
                ))}
              </div>
            </div>
          ))}
        </div>
      </CellTooltipProvider>
    </ChartCard>
  );
}

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

/**
 * One chip style per finishing position.
 *
 * The colours are theme tokens rather than raw utilities, so the rank palette
 * is a one-file change; the ink flips to dark on the light chips only. The
 * values are unchanged from the eight Tailwind shades this replaced — the
 * point was to move where they live, not what they look like.
 */
const RANK_CLASSES: Record<number, string> = {
  1: 'bg-rank-1 text-rank-ink',
  2: 'bg-rank-2 text-rank-ink',
  3: 'bg-rank-3 text-rank-ink',
  4: 'bg-rank-4 text-foreground',
  5: 'bg-rank-5 text-rank-ink',
  6: 'bg-rank-6 text-rank-ink',
  7: 'bg-rank-7 text-foreground',
  8: 'bg-rank-8 text-foreground',
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

      // Infinity, not zero. Dividing by `played.length || 1` gave a manager
      // with no result in the shown window an average of 0, which is better
      // than first place — so a row of five dashes sorted above the actual
      // league leader on a card whose whole job is to say who is in form.
      const avgRank = played.length
        ? played.reduce((sum, p) => sum + p.rank, 0) / played.length
        : Number.POSITIVE_INFINITY;

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
                          ? (RANK_CLASSES[perf.rank] ??
                              'bg-muted text-foreground')
                          : 'bg-muted/40 font-normal text-muted-foreground/40',
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

import React from 'react';
import { TableColumn } from './base-table';
import { PlayerDetails } from '@/interfaces/players';
import type { LeagueEntryId } from '@/interfaces/fpl';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowUp, ArrowDown, Eye, Minus } from 'lucide-react';

// Utility function for rank badge styling
export const getRankBadgeClasses = (rank: number): string => {
  if (rank === 1)
    return 'bg-yellow-400/20 text-yellow-400 border-yellow-400/30';
  if (rank === 2) return 'bg-gray-300/20 text-gray-300 border-gray-300/30';
  if (rank === 3) return 'bg-amber-600/20 text-amber-500 border-amber-600/30';
  if (rank === 8) return 'bg-red-600/20 text-red-400 border-red-600/30';
  return 'bg-white/10 text-white/70 border-white/20';
};

/**
 * A rank badge. `md` is the default because the results table set the row
 * height for the whole app (see `TABLE_ROW_CLASS`), and a smaller badge in a
 * row of that height reads as a different table rather than the same one.
 */
export const renderRankBadge = (rank: number, size: 'sm' | 'md' = 'md') => {
  const sizeClasses = size === 'md' ? 'h-8 w-8 text-sm' : 'h-6 w-6 text-xs';

  return (
    <Badge
      variant='outline'
      className={`inline-flex ${sizeClasses} flex-shrink-0 items-center justify-center rounded-full border p-0 font-bold ${getRankBadgeClasses(rank)}`}
    >
      {rank}
    </Badge>
  );
};

/** What the standings board needs beyond the season itself. */
export interface StandingsContext {
  /** Places gained since the previous gameweek. Absent means no previous. */
  movement: Record<number, number>;
}

/**
 * The standings board.
 *
 * A factory rather than a constant because the board carries one thing the
 * season object does not know: the week-on-week move, which is a question
 * about the previous gameweek rather than about this one. Columns stay data
 * and stay in this file, exactly as `draftResultsColumns` does.
 *
 * Team name is its own column from `md` up and a sub-line under the manager
 * below it — the same split, and the same complementary `md:hidden` on the
 * sub-line, that the results table uses. Two boards on the same site that
 * differ only in where they put the team name is drift, not design.
 */
export function standingsColumns({
  movement,
}: StandingsContext): TableColumn<PlayerDetails>[] {
  return [
    {
      header: 'Manager',
      key: (player: PlayerDetails) => (
        <div className='flex min-w-0 items-center gap-3'>
          {renderRankBadge(player.f1_ranking)}
          <div className='min-w-0'>
            <div className='truncate font-medium text-foreground'>
              {player.player_name}
            </div>
            <div className='truncate text-xs text-muted-foreground md:hidden'>
              {player.team_name}
            </div>
          </div>
        </div>
      ),
      width: 'w-[46%] md:w-[30%]',
    },
    {
      header: 'Team',
      key: (player: PlayerDetails) => (
        <div className='truncate text-muted-foreground'>{player.team_name}</div>
      ),
      width: 'md:w-[20%]',
      hideBelow: 'md',
    },
    {
      header: 'Move',
      key: (player: PlayerDetails) =>
        renderPositionMovement(movement[player.id]),
      align: 'center',
      width: 'md:w-[14%]',
      hideBelow: 'md',
    },
    {
      header: 'F1',
      key: (player: PlayerDetails) => (
        <span className='text-base font-bold text-primary'>
          {player.f1_score}
        </span>
      ),
      align: 'center',
      width: 'w-[26%] md:w-[18%]',
    },
    {
      header: 'Points',
      key: (player: PlayerDetails) => (
        <span className='text-base font-bold text-positive'>
          {player.total_points || 0}
        </span>
      ),
      align: 'center',
      width: 'w-[28%] md:w-[18%]',
    },
  ];
}

// Draft Results Table Configuration
export interface GameweekResult {
  rank: number;
  player_name: string;
  team_name: string;
  points: number;
  /** The manager, branded — the drawer feeds it straight back to upstream. */
  league_entry: LeagueEntryId;
  position_movement?: number;
}

/**
 * Places gained or lost, as a glyph and a number.
 *
 * `undefined` is "no previous position to compare against" — a first gameweek,
 * or a manager who was not in the last one. It reads as "new" rather than as no
 * movement, because those are different facts.
 */
export const renderPositionMovement = (movement?: number) => {
  if (movement === undefined)
    return <span className='text-xs text-muted-foreground'>New</span>;

  if (movement === 0)
    return (
      <span className='inline-flex items-center text-muted-foreground'>
        <Minus className='h-3.5 w-3.5' />
        <span className='sr-only'>No change</span>
      </span>
    );

  if (movement > 0)
    return (
      <span className='inline-flex items-center gap-1 text-xs font-medium text-positive'>
        <ArrowUp className='h-3 w-3' />
        {movement}
        <span className='sr-only'>places gained</span>
      </span>
    );

  return (
    <span className='inline-flex items-center gap-1 text-xs font-medium text-negative'>
      <ArrowDown className='h-3 w-3' />
      {Math.abs(movement)}
      <span className='sr-only'>places lost</span>
    </span>
  );
};

/**
 * The results columns, given what "view team" should do.
 *
 * A factory because the last column needs a callback the component owns, the
 * same reason `standingsColumns` takes its context. Columns stay data and stay
 * in this file either way.
 *
 * Team name is its own column from `md` up (`hideBelow`) and a sub-line under
 * the player below it, which is why the sub-line carries the complementary
 * `md:hidden`. Both halves name the same breakpoint on purpose.
 */
export function draftResultsColumns(
  onViewTeam: (result: GameweekResult) => void,
): TableColumn<GameweekResult>[] {
  return [
    {
      header: 'Player',
      key: (result: GameweekResult) => (
        <div className='flex min-w-0 items-center gap-3'>
          {renderRankBadge(result.rank, 'md')}
          <div className='min-w-0'>
            <div className='truncate font-medium text-white'>
              {result.player_name}
            </div>
            <div className='truncate text-xs text-white/50 md:hidden'>
              {result.team_name}
            </div>
          </div>
        </div>
      ),
      width: 'w-[45%] md:w-[34%]',
    },
    {
      header: 'Team',
      key: (result: GameweekResult) => (
        <div className='truncate text-white/70'>{result.team_name}</div>
      ),
      width: 'md:w-[24%]',
      hideBelow: 'md',
    },
    {
      header: 'Move',
      key: (result: GameweekResult) =>
        renderPositionMovement(result.position_movement),
      align: 'center',
      width: 'w-[20%] md:w-[15%]',
    },
    {
      header: 'Points',
      key: (result: GameweekResult) => (
        <span
          className={`text-base font-bold ${
            result.rank === 1
              ? 'text-yellow-400'
              : result.rank === 8
                ? 'text-red-400'
                : 'text-white'
          }`}
        >
          {result.points}
        </span>
      ),
      align: 'center',
      width: 'w-[20%] md:w-[15%]',
    },
    {
      header: '',
      key: (result: GameweekResult) => (
        <Button
          variant='outline'
          size='sm'
          className='h-8 gap-1.5 border-white/10 bg-white/5 px-2 text-xs text-white/70 hover:border-[#00edfd]/50 hover:text-[#00edfd]'
          onClick={() => onViewTeam(result)}
        >
          <Eye className='h-3.5 w-3.5' />
          <span className='hidden md:inline'>View team</span>
          <span className='sr-only md:hidden'>
            View {result.player_name}&apos;s team
          </span>
        </Button>
      ),
      align: 'right',
      width: 'w-[15%] md:w-[12%]',
    },
  ];
}

// Table wrapper configurations
export interface TableConfig {
  title: string;
  subtitle: string;
  emptyMessage?: string;
  className?: string;
  tableClassName?: string;
}

export const tableConfigs: Record<string, TableConfig> = {
  draftResults: {
    title: 'Gameweek results',
    subtitle: 'Previous gameweek rankings and points for the Draft league.',
    emptyMessage: 'No gameweek results available yet.',
  },
};

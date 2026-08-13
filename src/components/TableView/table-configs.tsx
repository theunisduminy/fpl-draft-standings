import React from 'react';
import { TableColumn } from './base-table';
import { PlayerDetails } from '@/interfaces/players';
import type { LeagueEntryId } from '@/interfaces/fpl';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowUp, ArrowDown, Eye, Minus } from 'lucide-react';

// Truncate text helper
const truncate = (str: string, maxLen: number) =>
  str.length > maxLen ? str.slice(0, maxLen) + '…' : str;

// Utility function for rank badge styling
export const getRankBadgeClasses = (rank: number): string => {
  if (rank === 1)
    return 'bg-yellow-400/20 text-yellow-400 border-yellow-400/30';
  if (rank === 2) return 'bg-gray-300/20 text-gray-300 border-gray-300/30';
  if (rank === 3) return 'bg-amber-600/20 text-amber-500 border-amber-600/30';
  if (rank === 8) return 'bg-red-600/20 text-red-400 border-red-600/30';
  return 'bg-white/10 text-white/70 border-white/20';
};

// Utility function for rendering rank badges
export const renderRankBadge = (rank: number, size: 'sm' | 'md' = 'sm') => {
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

// Standings Table Configuration
export const standingsTableConfig: TableColumn<PlayerDetails>[] = [
  {
    header: 'Player',
    key: (player: PlayerDetails) => (
      <div className='flex min-w-0 items-center gap-3'>
        {renderRankBadge(player.f1_ranking)}
        <div className='min-w-0'>
          <div className='truncate font-medium text-white'>
            {player.player_name}
          </div>
          <div className='truncate text-xs text-white/50'>
            {player.team_name}
          </div>
        </div>
      </div>
    ),
    width: 'w-[50%]',
  },
  {
    header: 'F1 score',
    key: (player: PlayerDetails) => (
      <span className='text-base font-bold text-[#00edfd]'>
        {player.f1_score}
      </span>
    ),
    align: 'center',
    width: 'w-[25%]',
  },
  {
    // The league ranks on finishes, so "2nd on points" beside a first place is
    // the disagreement the standings page is built around.
    header: 'Points',
    key: (player: PlayerDetails) => (
      <div>
        <span className='text-base font-bold text-[#75fa95]'>
          {player.total_points || 0}
        </span>
        <div className='text-xs text-white/40'>
          {ordinal(player.points_ranking)} on points
        </div>
      </div>
    ),
    align: 'center',
    width: 'w-[25%]',
  },
];

// Position Placed Table Configuration
export const positionPlacedTableConfig: TableColumn<PlayerDetails>[] = [
  {
    header: 'Player',
    key: (player: PlayerDetails) => (
      <span className='font-medium text-white'>
        {truncate(player.player_name, 12)}
      </span>
    ),
    width: 'w-[20%]',
  },
  {
    header: '1st',
    key: (player) => (
      <span className='font-semibold text-yellow-400'>
        {player.position_placed['first'] || 0}
      </span>
    ),
    align: 'center' as const,
  },
  {
    header: '2nd',
    key: (player) => (
      <span className='font-semibold text-gray-300'>
        {player.position_placed['second'] || 0}
      </span>
    ),
    align: 'center' as const,
  },
  {
    header: '3rd',
    key: (player) => (
      <span className='font-semibold text-amber-500'>
        {player.position_placed['third'] || 0}
      </span>
    ),
    align: 'center' as const,
  },
  {
    header: '4th',
    key: (player) => player.position_placed['fourth'] || 0,
    align: 'center' as const,
  },
  {
    header: '5th',
    key: (player) => player.position_placed['fifth'] || 0,
    align: 'center' as const,
  },
  {
    header: '6th',
    key: (player) => player.position_placed['sixth'] || 0,
    align: 'center' as const,
  },
  {
    header: '7th',
    key: (player) => player.position_placed['seventh'] || 0,
    align: 'center' as const,
  },
  {
    header: '8th',
    key: (player) => (
      <span className='font-semibold text-red-400'>
        {player.position_placed['eighth'] || 0}
      </span>
    ),
    align: 'center' as const,
  },
];

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

// Utility function for position movement display
export const renderPositionMovement = (movement?: number) => {
  if (movement === undefined)
    return (
      <span className='inline-flex items-center gap-1 text-xs text-white/40'>
        <Minus className='h-3 w-3' />
        NEW
      </span>
    );
  if (movement === 0)
    return (
      <span className='inline-flex items-center gap-1 text-xs text-white/40'>
        <Minus className='h-3 w-3' />
        SAME
      </span>
    );
  if (movement > 0)
    return (
      <span className='inline-flex items-center gap-1 text-xs font-medium text-[#75fa95]'>
        <ArrowUp className='h-3 w-3' />
        {movement}
      </span>
    );
  return (
    <span className='inline-flex items-center gap-1 text-xs font-medium text-red-400'>
      <ArrowDown className='h-3 w-3' />
      {Math.abs(movement)}
    </span>
  );
};

/**
 * The results columns, given what "view team" should do.
 *
 * A factory because the last column needs a callback the component owns — the
 * same reason the standings columns would take a parameter if they needed one.
 * Columns stay data and stay in this file either way.
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

/** 1 → 1st, 2 → 2nd. The league is eight managers, so this need not be clever. */
function ordinal(rank: number): string {
  return `${rank}${['th', 'st', 'nd', 'rd'][rank] ?? 'th'}`;
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
  standings: {
    title: '🏆 F1 Draft Standings',
    subtitle:
      'Rankings based on F1-style points system: 20-15-12-10-8-6-4-2 points for positions 1st-8th each gameweek.',
  },
  positionPlaced: {
    title: '🎖️ Position Placed',
    subtitle:
      'Frequency of position placed, based on total points, for the previous gameweeks.',
    className: '',
    tableClassName: '',
  },
  draftResults: {
    title: '📊 Gameweek Results',
    subtitle: 'Previous gameweek rankings and points for the Draft league.',
    emptyMessage: 'No gameweek results available yet.',
  },
};

import React from 'react';
import { TableColumn } from './base-table';
import { PlayerDetails } from '@/interfaces/players';

// Utility function for rank badge styling
export const getRankBadgeClasses = (rank: number): string => {
  if (rank === 1) return 'bg-yellow-400 text-black';
  if (rank === 2) return 'bg-gray-300 text-black';
  if (rank === 3) return 'bg-amber-600 text-white';
  if (rank === 8) return 'bg-red-600 text-white';
  return 'bg-gray-600 text-white';
};

// Utility function for rendering rank badges
export const renderRankBadge = (rank: number, size: 'sm' | 'md' = 'sm') => {
  const sizeClasses = size === 'md' ? 'h-8 w-8 text-sm' : 'h-6 w-6 text-xs';

  return (
    <span
      className={`inline-flex ${sizeClasses} flex-shrink-0 items-center justify-center rounded-full font-bold ${getRankBadgeClasses(rank)}`}
    >
      {rank}
    </span>
  );
};

// Standings Table Configuration
export const standingsTableConfig: TableColumn<PlayerDetails>[] = [
  {
    header: 'Player Ranking',
    key: (player: PlayerDetails) => (
      <div className='flex items-center gap-3'>
        {renderRankBadge(player.f1_ranking)}
        <div>
          <div className='font-medium'>{player.player_name}</div>
          <div className='text-xs text-gray-300'>{player.team_name}</div>
        </div>
      </div>
    ),
    width: '50%',
    className: 'border-r-2 border-white pl-4',
  },
  {
    header: 'Score',
    key: (player: PlayerDetails) => (
      <span className='text-lg font-bold text-yellow-300'>
        {player.f1_score}
      </span>
    ),
    align: 'center',
    width: '25%',
    className: 'border-r-2 border-white',
  },
  {
    header: 'TP',
    key: (player: PlayerDetails) => (
      <span className='text-lg font-bold text-blue-300'>
        {player.total_points || 0}
      </span>
    ),
    align: 'center',
    width: '25%',
  },
];

// Position Placed Table Configuration
export const positionPlacedTableConfig: TableColumn<PlayerDetails>[] = [
  {
    header: 'Player',
    key: 'player_name',
    width: '16.67%',
    className: 'border-r-2 border-white',
  },
  {
    header: '1st',
    key: (player) => player.position_placed['first'] || 0,
    align: 'center' as const,
  },
  {
    header: '2nd',
    key: (player) => player.position_placed['second'] || 0,
    align: 'center' as const,
  },
  {
    header: '3rd',
    key: (player) => player.position_placed['third'] || 0,
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
    key: (player) => player.position_placed['eighth'] || 0,
    align: 'center' as const,
  },
];

// Draft Results Table Configuration
export interface GameweekResult {
  rank: number;
  player_name: string;
  points: number;
  league_entry: number;
}

export const draftResultsTableConfig: TableColumn<GameweekResult>[] = [
  {
    header: 'Rank',
    key: (result: GameweekResult) => renderRankBadge(result.rank, 'md'),
    align: 'left',
  },
  {
    header: 'Player',
    key: 'player_name',
    cellClassName: () => 'font-medium',
  },
  {
    header: 'Points',
    key: (result: GameweekResult) => (
      <span
        className={`font-bold ${
          result.rank === 1
            ? 'text-yellow-300'
            : result.rank === 8
              ? 'text-red-300'
              : 'text-white'
        }`}
      >
        {result.points}
      </span>
    ),
    align: 'right',
  },
];

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
    className: 'flex w-[350px] flex-col md:w-[600px]',
    tableClassName: 'mb-8',
  },
  draftResults: {
    title: '📊 Gameweek Results',
    subtitle: 'Previous gameweek rankings and points for the Draft league.',
    emptyMessage: 'No gameweek results available yet.',
  },
};

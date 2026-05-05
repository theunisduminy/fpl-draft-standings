'use client';
import React from 'react';
import { useTableData } from '@/hooks/use-table-data';
import { PositionDistributionChart } from '@/components/PlayerView/PositionDistributionChart';
import { FormGuide } from '@/components/PlayerView/FormGuide';
import { PositionTrajectory } from '@/components/PlayerView/PositionTrajectory';
import { PodiumRace } from '@/components/PlayerView/PodiumRace';
import { GameweekDataResponse } from '@/interfaces/players';
import { SkeletonCard } from '@/components/SkeletonTable';
import { ErrorDisplay } from '@/components/ErrorDisplay';

export default function PositionPlacedTable() {
  const { data, loading, error, refetch } = useTableData<GameweekDataResponse>({
    endpoints: ['gameweek-data'],
    transform: (response) => response[0],
  });

  if (loading) return <SkeletonCard />;
  if (error) return <ErrorDisplay message={error} onRetry={refetch} />;
  if (!data || !data.players || data.players.length === 0) {
    return (
      <ErrorDisplay
        message='No position data available yet.'
        onRetry={refetch}
      />
    );
  }

  const playerNames = Object.fromEntries(
    data.players.map((p) => [p.id, p.player_name]),
  );

  return (
    <div className='w-full space-y-4'>
      <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
        <PositionDistributionChart players={data.players} />
        <FormGuide
          performances={data.gameweekPerformances}
          playerNames={playerNames}
        />
      </div>
      <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
        <PositionTrajectory
          performances={data.gameweekPerformances}
          playerNames={playerNames}
        />
        <PodiumRace
          performances={data.gameweekPerformances}
          playerNames={playerNames}
        />
      </div>
    </div>
  );
}

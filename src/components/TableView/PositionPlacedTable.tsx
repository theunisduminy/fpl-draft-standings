import React from 'react';
import { PositionDistributionChart } from '@/components/PlayerView/PositionDistributionChart';
import { FormGuide } from '@/components/PlayerView/FormGuide';
import { PositionTrajectory } from '@/components/PlayerView/PositionTrajectory';
import { PodiumRace } from '@/components/PlayerView/PodiumRace';
import { GameweekDataResponse } from '@/interfaces/players';
import { EmptyState } from '@/components/EmptyState';

export default function PositionPlacedTable({
  data,
}: {
  data: GameweekDataResponse;
}) {
  if (data.players.length === 0) {
    return <EmptyState>No position data available yet.</EmptyState>;
  }

  const playerNames = Object.fromEntries(
    data.players.map((player) => [player.id, player.player_name]),
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

import React from 'react';
import { PositionDistributionChart } from '@/components/PlayerView/PositionDistributionChart';
import { FormGuide } from '@/components/PlayerView/FormGuide';
import { PositionTrajectory } from '@/components/PlayerView/PositionTrajectory';
import { PodiumRace } from '@/components/PlayerView/PodiumRace';
import { GameweekDataResponse } from '@/interfaces/players';
import { Card, CardContent } from '@/components/ui/card';

export default function PositionPlacedTable({
  data,
}: {
  data: GameweekDataResponse;
}) {
  if (data.players.length === 0) {
    return (
      <Card className='w-full border-white/10 bg-[#2a0d33]'>
        <CardContent className='p-6 text-center text-sm text-white/60'>
          No position data available yet.
        </CardContent>
      </Card>
    );
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

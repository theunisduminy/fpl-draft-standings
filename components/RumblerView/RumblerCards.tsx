'use client';
import React, { useState, useEffect, useMemo } from 'react';
import { useTableData } from '@/hooks/use-table-data';
import { SkeletonCard } from '@/components/SkeletonTable';
import { ErrorDisplay } from '@/components/ErrorDisplay';
import { GameweekSelector } from '@/components/GameweekSelector';
import { getRandomBlurb } from '@/utils/lossBlurb';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { RumblerGameweekData } from '@/interfaces/players';
import { Beer, TrendingDown, Calendar } from 'lucide-react';

export default function RumblerDataCards(): JSX.Element {
  const [selectedGameweek, setSelectedGameweek] = useState<number>(0);
  const [currentBlurb, setCurrentBlurb] = useState<string>('');

  const {
    data: gameweekData,
    loading,
    error,
    refetch,
  } = useTableData<RumblerGameweekData[]>({
    endpoints: ['rumbler'],
    transform: (response) => response[0], // Extract first element from response array
  });

  // Extract all gameweeks and set default selection
  const gameweeks = useMemo(() => {
    if (!gameweekData || gameweekData.length === 0) return [];

    const allGameweeks = gameweekData
      .map((item) => item.gameweek)
      .sort((a, b) => b - a);

    // Set the default selected gameweek to the most recent one
    if (allGameweeks.length > 0 && selectedGameweek === 0) {
      setSelectedGameweek(allGameweeks[0]);
      setCurrentBlurb(getRandomBlurb());
    }

    return allGameweeks;
  }, [gameweekData, selectedGameweek]);

  useEffect(() => {
    // Set a new random blurb when gameweek changes
    if (gameweeks.length > 0) {
      setCurrentBlurb(getRandomBlurb());
    }
  }, [selectedGameweek, gameweeks.length]);

  if (loading) return <SkeletonCard />;
  if (error) return <ErrorDisplay message={error} onRetry={refetch} />;
  if (!gameweekData || gameweekData.length === 0) {
    return (
      <div className='flex w-[350px] flex-col md:w-[600px]'>
        <h1 className='pb-2 text-2xl font-semibold text-[#310639]'>
          🍺 Rumbler Victim
        </h1>
        <p className='pb-5 text-sm'>No rumbler data available yet.</p>
      </div>
    );
  }

  // Find the data for the selected gameweek
  const selectedData = gameweekData.find(
    (gw) => gw.gameweek === selectedGameweek,
  );

  // Calculate rumbler frequency
  const rumblerFrequency: Record<string, number> = {};
  gameweekData.forEach((gw) => {
    gw.player_names.forEach((playerName) => {
      rumblerFrequency[playerName] = (rumblerFrequency[playerName] || 0) + 1;
    });
  });

  // Get rumbler count for the current players
  const getCurrentRumblerCount = (playerName: string): number => {
    return rumblerFrequency[playerName] || 0;
  };

  // Get average points for rumbler victims
  const rumblerAverage =
    gameweekData.reduce((sum, gw) => sum + gw.points, 0) / gameweekData.length;

  if (!selectedData) {
    return (
      <div className='flex w-[350px] flex-col md:w-[600px]'>
        <h1 className='pb-2 text-2xl font-semibold text-[#310639]'>
          🍺 Rumbler Victim
        </h1>
        <p className='pb-5 text-sm'>
          The player who needs to take a rumbler, per gameweek.
        </p>

        <GameweekSelector
          gameweeks={gameweeks}
          selectedGameweek={selectedGameweek}
          onSelectGameweek={setSelectedGameweek}
          label='Select Gameweek'
        />

        <div className='mt-6'>
          <Card>
            <CardHeader>
              <CardTitle>Gameweek {selectedGameweek}</CardTitle>
              <CardDescription>
                No rumbler data for this gameweek
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className='flex w-[350px] flex-col md:w-[600px]'>
      <h1 className='pb-2 text-2xl font-semibold text-[#310639]'>
        🍺 Rumbler Victim
      </h1>
      <p className='pb-5 text-sm'>
        The player who needs to take a rumbler, per gameweek.
      </p>

      <GameweekSelector
        gameweeks={gameweeks}
        selectedGameweek={selectedGameweek}
        onSelectGameweek={setSelectedGameweek}
        label='Select Gameweek'
      />

      <div className='mt-6'>
        <Card className='w-full overflow-hidden'>
          <CardHeader className='pb-4'>
            <div className='flex items-center justify-between'>
              <div className='flex items-center gap-2'>
                <Calendar className='h-5 w-5 text-white' />
                <CardTitle className='text-white'>
                  Gameweek {selectedData.gameweek}
                </CardTitle>
              </div>
              <Badge variant='secondary' className='text-lg'>
                {selectedData.points} pts
              </Badge>
            </div>
            <div className='mt-2 flex items-center gap-2'>
              <TrendingDown className='h-4 w-4 text-white' />
              <CardDescription className='text-white'>
                {selectedData.points < rumblerAverage
                  ? `${(rumblerAverage - selectedData.points).toFixed(1)} pts below average`
                  : `${(selectedData.points - rumblerAverage).toFixed(1)} pts above average`}
              </CardDescription>
            </div>
            <CardDescription className='mt-2 text-white'>
              {selectedData.entry_names.length > 1
                ? '😥 Rumbler Victims'
                : '😥 Rumbler Victim'}
            </CardDescription>
          </CardHeader>

          <CardContent className='p-5'>
            <div className='space-y-3'>
              {selectedData.entry_names.map((entry, index) => (
                <div
                  key={index}
                  className='rounded-lg p-4 text-white shadow-md transition-colors'
                >
                  <div className='flex items-center justify-between'>
                    <div>
                      <div className='flex items-center gap-2'>
                        <span className='text-xl font-bold'>
                          {selectedData.player_names[index]}
                        </span>
                        <Beer className='h-5 w-5 text-yellow-300' />
                      </div>
                      <span className='text-gray-200'>{entry}</span>
                    </div>
                    <div className='rounded-full px-3 py-1 text-xs'>
                      {getCurrentRumblerCount(selectedData.player_names[index])}{' '}
                      rumblers this season
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>

          <CardFooter className='flex-col items-start gap-3 p-5 text-white'>
            <div className='flex w-full items-start gap-3'>
              <div className='flex-1'>
                <p className='text-lg italic text-white'>
                  &ldquo;{currentBlurb}&ldquo;
                </p>
              </div>
            </div>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}

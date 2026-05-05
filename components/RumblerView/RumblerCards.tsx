'use client';
import React, { useState, useMemo, useEffect } from 'react';
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
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { RumblerGameweekData } from '@/interfaces/players';
import { Beer, TrendingDown, Calendar, Quote } from 'lucide-react';

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
    transform: (response) => response[0],
  });

  const gameweeks = useMemo(() => {
    if (!gameweekData || gameweekData.length === 0) return [];
    const allGameweeks = gameweekData
      .map((item) => item.gameweek)
      .sort((a, b) => b - a);

    if (allGameweeks.length > 0 && selectedGameweek === 0) {
      setSelectedGameweek(allGameweeks[0]);
      setCurrentBlurb(getRandomBlurb());
    }
    return allGameweeks;
  }, [gameweekData, selectedGameweek]);

  useEffect(() => {
    if (gameweeks.length > 0) {
      setCurrentBlurb(getRandomBlurb());
    }
  }, [selectedGameweek, gameweeks.length]);

  if (loading) return <SkeletonCard />;
  if (error) return <ErrorDisplay message={error} onRetry={refetch} />;
  if (!gameweekData || gameweekData.length === 0) {
    return (
      <Card className='w-full border-white/10 bg-[#2a0d33]'>
        <CardHeader>
          <CardTitle className='text-white'>Rumbler Victim</CardTitle>
          <CardDescription className='text-white/60'>
            No rumbler data available yet.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const selectedData = gameweekData.find(
    (gw) => gw.gameweek === selectedGameweek,
  );

  const rumblerFrequency: Record<string, number> = {};
  gameweekData.forEach((gw) => {
    gw.player_names.forEach((playerName) => {
      rumblerFrequency[playerName] = (rumblerFrequency[playerName] || 0) + 1;
    });
  });

  const getCurrentRumblerCount = (playerName: string): number => {
    return rumblerFrequency[playerName] || 0;
  };

  const rumblerAverage =
    gameweekData.reduce((sum, gw) => sum + gw.points, 0) / gameweekData.length;

  if (!selectedData) {
    return (
      <div className='w-full space-y-4'>
        <GameweekSelector
          gameweeks={gameweeks}
          selectedGameweek={selectedGameweek}
          onSelectGameweek={setSelectedGameweek}
          label='Select Gameweek'
        />
        <Card className='w-full border-white/10 bg-[#2a0d33]'>
          <CardHeader>
            <CardTitle className='text-white'>
              Gameweek {selectedGameweek}
            </CardTitle>
            <CardDescription className='text-white/60'>
              No rumbler data for this gameweek
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className='w-full space-y-4'>
      <GameweekSelector
        gameweeks={gameweeks}
        selectedGameweek={selectedGameweek}
        onSelectGameweek={setSelectedGameweek}
        label='Select Gameweek'
      />

      <Card className='w-full overflow-hidden border-white/10 bg-[#2a0d33]'>
        <CardHeader className='pb-3'>
          <div className='flex items-center justify-between'>
            <div className='flex items-center gap-2'>
              <Calendar className='h-4 w-4 text-white/60' />
              <CardTitle className='text-base text-white md:text-lg'>
                Gameweek {selectedData.gameweek}
              </CardTitle>
            </div>
            <Badge
              variant='outline'
              className='border-amber-500/30 bg-amber-500/10 text-amber-400'
            >
              {selectedData.points} pts
            </Badge>
          </div>
          <div className='mt-1 flex items-center gap-2'>
            <TrendingDown className='h-3 w-3 text-white/40' />
            <CardDescription className='text-xs text-white/50'>
              {selectedData.points < rumblerAverage
                ? `${(rumblerAverage - selectedData.points).toFixed(1)} pts below average`
                : `${(selectedData.points - rumblerAverage).toFixed(1)} pts above average`}
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent className='p-4 pt-0'>
          <div className='space-y-3'>
            {selectedData.entry_names.map((entry, index) => {
              const playerName = selectedData.player_names[index];
              const count = getCurrentRumblerCount(playerName);
              return (
                <div
                  key={index}
                  className='flex items-center justify-between rounded-lg bg-[#1a0520] p-3 transition-colors hover:bg-[#1a0520]/80'
                >
                  <div className='flex items-center gap-3'>
                    <Avatar className='h-10 w-10 border border-amber-500/30'>
                      <AvatarFallback className='bg-amber-500/10 text-sm font-bold text-amber-400'>
                        {playerName.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <div className='flex items-center gap-2'>
                        <span className='text-sm font-bold text-white'>
                          {playerName}
                        </span>
                        <Beer className='h-4 w-4 text-amber-400' />
                      </div>
                      <span className='text-xs text-white/50'>{entry}</span>
                    </div>
                  </div>
                  <Badge
                    variant='outline'
                    className='border-white/10 bg-[#1a0520] text-xs text-white/60'
                  >
                    {count} rumblers
                  </Badge>
                </div>
              );
            })}
          </div>
        </CardContent>

        <Separator className='bg-white/10' />

        <CardFooter className='p-4'>
          <div className='flex items-start gap-2'>
            <Quote className='mt-0.5 h-4 w-4 flex-shrink-0 text-white/30' />
            <p className='text-sm italic text-white/60'>
              &ldquo;{currentBlurb}&rdquo;
            </p>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}

'use client';
import React, { useState, useEffect } from 'react';
import { fetchWithDelay } from '@/utils/fetchWithDelay';
import { SkeletonCard } from '@/components/SkeletonTable';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { GameweekData } from '@/interfaces/match';

export default function RumblerDataCards(): JSX.Element {
  const [gameweekData, setGameweekData] = useState<GameweekData[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    async function fetchData(): Promise<void> {
      const [data] = (await fetchWithDelay(['rumbler'])) as [GameweekData[]];
      setGameweekData(data);
      setLoading(false);
    }

    fetchData();
  }, []);

  if (loading) return <SkeletonCard />;

  const sortedData = [...gameweekData].sort((a, b) => b.gameweek - a.gameweek);

  return (
    <div className='flex w-[350px] flex-col md:w-[600px]'>
      <h1 className='pb-2 text-2xl font-semibold text-[#310639]'>
        🍺 Rumbler Victim
      </h1>
      <p className='pb-5 text-sm'>
        The player who needs to take a rumbler, per gameweek.
      </p>
      <div className='space-y-6'>
        {sortedData.map((gameweek) => (
          <Card key={gameweek.gameweek} className='w-full'>
            <CardHeader>
              <CardTitle className='flex items-center justify-between text-gray-100'>
                Gameweek {gameweek.gameweek}
                <Badge variant='secondary' className='text-lg'>
                  {gameweek.points} pts
                </Badge>
              </CardTitle>
              <CardDescription>
                {gameweek.entry_names.length > 1
                  ? '😥 Rumbler Victims'
                  : '😥 Rumbler Victim'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className='space-y-2 pt-4'>
                {gameweek.entry_names.map((entry, index) => (
                  <div
                    key={index}
                    className='flex items-center justify-between'
                  >
                    <span className='text-lg font-medium text-gray-900'>
                      {gameweek.player_names[index]}
                    </span>
                    <span className='text-md text-gray-900'>{entry}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

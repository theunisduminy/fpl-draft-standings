'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { PlayerSummaryCard } from '@/components/PlayerView/PlayerSummaryCard';
import { PlayerPerformanceChart } from '@/components/PlayerView/PlayerPerformanceChart';
import { HeadToHeadRecord } from '@/components/PlayerView/HeadToHeadRecord';
import { ErrorDisplay } from '@/components/ErrorDisplay';
import { SkeletonCard } from '@/components/SkeletonTable';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';

export default function PlayerStatistics() {
  const { playerId } = useParams();
  const [playerData, setPlayerData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPlayerData = useCallback(async () => {
    try {
      setLoading(true);
      const data = await fetch(`/api/player/${playerId}`).then((res) => {
        if (!res.ok) {
          throw new Error(`Failed to fetch player data: ${res.status}`);
        }
        return res.json();
      });
      setPlayerData(data);
      setError(null);
    } catch (err) {
      setError('Failed to load player data. Please try again later.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [playerId]);

  useEffect(() => {
    fetchPlayerData();
  }, [fetchPlayerData]);

  if (loading) {
    return (
      <div>
        <div className='flex flex-col space-y-8'>
          <div className='flex items-center space-x-2'>
            <Link
              href='/'
              className='rounded-lg bg-premPurple p-2 text-white hover:bg-opacity-90'
            >
              <ChevronLeft className='h-5 w-5' />
            </Link>
            <h1 className='text-4xl font-semibold text-[#310639]'>
              Player Statistics
            </h1>
          </div>
          <div className='w-full space-y-8'>
            <div className='grid grid-cols-1 gap-8 md:grid-cols-2'>
              <SkeletonCard />
              <SkeletonCard />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <div className='flex items-center space-x-2 pb-8'>
          <Link
            href='/'
            className='rounded-lg bg-premPurple p-2 text-white hover:bg-opacity-90'
          >
            <ChevronLeft className='h-5 w-5' />
          </Link>
          <h1 className='text-4xl font-semibold text-[#310639]'>
            Player Statistics
          </h1>
        </div>
        <ErrorDisplay message={error} onRetry={fetchPlayerData} />
      </div>
    );
  }

  if (!playerData) {
    return (
      <div>
        <div className='flex items-center space-x-2 pb-8'>
          <Link
            href='/'
            className='rounded-lg bg-premPurple p-2 text-white hover:bg-opacity-90'
          >
            <ChevronLeft className='h-5 w-5' />
          </Link>
          <h1 className='text-4xl font-semibold text-[#310639]'>
            Player Statistics
          </h1>
        </div>
        <div className='flex h-64 w-full items-center justify-center rounded-lg border-2 border-[#310639] bg-white p-8'>
          <p className='text-xl text-[#310639]'>Player not found</p>
        </div>
      </div>
    );
  }

  return (
    <div className='w-full max-w-6xl space-y-8'>
      <div className='flex flex-col space-y-2 md:flex-row md:items-center md:justify-between md:space-y-0'>
        <div className='flex items-center space-x-2 pb-6 md:pb-0'>
          <Link
            href='/'
            className='rounded-lg bg-premPurple p-2 text-white hover:bg-opacity-90'
          >
            <ChevronLeft className='h-5 w-5' />
          </Link>
          <h1 className='text-4xl font-semibold text-[#310639]'>
            {playerData.player_name}&apos;s Stats
          </h1>
        </div>
        <div className='rounded-lg bg-cyan-600 px-4 py-2 text-lg font-medium text-white'>
          {playerData.team_name}
        </div>
      </div>

      <div className='space-y-8'>
        <div className='w-full'>
          <PlayerPerformanceChart
            data={playerData.performance}
            playerName={playerData.player_name}
          />
        </div>

        {/* Two column layout below for Player Stats and Head-to-Head */}
        <div className='grid grid-cols-1 gap-8 md:grid-cols-2'>
          <PlayerSummaryCard player={playerData} />
          <HeadToHeadRecord records={playerData.headToHead} />
        </div>
      </div>
    </div>
  );
}

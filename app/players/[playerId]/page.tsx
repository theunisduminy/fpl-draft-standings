'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { PlayerSummaryCard } from '@/components/PlayerView/PlayerSummaryCard';
import { PlayerPerformanceChart } from '@/components/PlayerView/PlayerPerformanceChart';
import { PositionStatsCard } from '@/components/PlayerView/PositionStatsCard';
import { ErrorDisplay } from '@/components/ErrorDisplay';
import { SkeletonCard, SkeletonStats } from '@/components/SkeletonTable';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ChevronLeft, User } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

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
      <div className='w-full space-y-6'>
        <div className='flex items-center gap-3'>
          <Link href='/'>
            <Button
              variant='ghost'
              size='icon'
              className='text-white hover:bg-white/10'
            >
              <ChevronLeft className='h-5 w-5' />
            </Button>
          </Link>
          <h1 className='text-xl font-bold text-white md:text-2xl'>
            Player Statistics
          </h1>
        </div>
        <SkeletonCard />
        <SkeletonStats />
      </div>
    );
  }

  if (error) {
    return (
      <div className='w-full space-y-6'>
        <div className='flex items-center gap-3'>
          <Link href='/'>
            <Button
              variant='ghost'
              size='icon'
              className='text-white hover:bg-white/10'
            >
              <ChevronLeft className='h-5 w-5' />
            </Button>
          </Link>
          <h1 className='text-xl font-bold text-white md:text-2xl'>
            Player Statistics
          </h1>
        </div>
        <ErrorDisplay message={error} onRetry={fetchPlayerData} />
      </div>
    );
  }

  if (!playerData) {
    return (
      <div className='w-full space-y-6'>
        <div className='flex items-center gap-3'>
          <Link href='/'>
            <Button
              variant='ghost'
              size='icon'
              className='text-white hover:bg-white/10'
            >
              <ChevronLeft className='h-5 w-5' />
            </Button>
          </Link>
          <h1 className='text-xl font-bold text-white md:text-2xl'>
            Player Statistics
          </h1>
        </div>
        <div className='flex h-64 items-center justify-center rounded-xl border border-white/10 bg-[#2a0d33]'>
          <p className='text-white/50'>Player not found</p>
        </div>
      </div>
    );
  }

  return (
    <div className='w-full space-y-6'>
      {/* Header */}
      <div className='flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between'>
        <div className='flex items-center gap-3'>
          <Link href='/'>
            <Button
              variant='ghost'
              size='icon'
              className='text-white hover:bg-white/10'
            >
              <ChevronLeft className='h-5 w-5' />
            </Button>
          </Link>
          <div>
            <h1 className='text-xl font-bold text-white md:text-2xl'>
              {playerData.player_name}
            </h1>
            <p className='text-sm text-white/50'>Season performance</p>
          </div>
        </div>
        <Badge
          variant='outline'
          className='w-fit border-[#00edfd]/30 bg-[#00edfd]/10 text-[#00edfd]'
        >
          <User className='mr-1 h-3 w-3' />
          {playerData.team_name}
        </Badge>
      </div>

      {/* Performance Chart */}
      <PlayerPerformanceChart
        data={playerData.performance}
        playerName={playerData.player_name}
      />

      {/* Stats Grid */}
      <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
        <PlayerSummaryCard player={playerData} />
        <PositionStatsCard stats={playerData.stats} />
      </div>
    </div>
  );
}

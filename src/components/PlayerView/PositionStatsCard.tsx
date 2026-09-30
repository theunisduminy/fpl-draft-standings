// components/PlayerView/PositionStatsCard.tsx
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { LiveGameweekBadge } from '@/components/LiveGameweekBadge';
import { Progress } from '@/components/ui/progress';
import { Trophy, Target, TrendingUp, Calendar } from 'lucide-react';

import type { PlayerStats } from '@/interfaces/players';

interface PositionStatsCardProps {
  stats: PlayerStats;
  /** The gameweek still being played, or `null`; every tally here includes it. */
  provisionalGameweek: number | null;
}

export function PositionStatsCard({
  stats,
  provisionalGameweek,
}: PositionStatsCardProps) {
  const positionData = [
    {
      position: '1st',
      count: stats.positionStats.first,
      color: 'bg-rank-1',
    },
    {
      position: '2nd',
      count: stats.positionStats.second,
      color: 'bg-rank-2',
    },
    {
      position: '3rd',
      count: stats.positionStats.third,
      color: 'bg-rank-3',
    },
    {
      position: '4th',
      count: stats.positionStats.fourth,
      color: 'bg-rank-4',
    },
    {
      position: '5th',
      count: stats.positionStats.fifth,
      color: 'bg-rank-5',
    },
    {
      position: '6th',
      count: stats.positionStats.sixth,
      color: 'bg-rank-6',
    },
    {
      position: '7th',
      count: stats.positionStats.seventh,
      color: 'bg-rank-7',
    },
    {
      position: '8th',
      count: stats.positionStats.eighth,
      color: 'bg-rank-8',
    },
  ];

  const maxCount = Math.max(...positionData.map((p) => p.count), 1);

  const keyStats = [
    {
      icon: <Trophy className='h-4 w-4 text-rank-1' />,
      value: stats.totalWins,
      label: 'Wins',
    },
    {
      icon: <Target className='h-4 w-4 text-rank-4' />,
      value: stats.averageRank.toFixed(1),
      label: 'Average rank',
    },
    {
      icon: <TrendingUp className='h-4 w-4 text-positive' />,
      value: stats.averagePoints.toFixed(0),
      label: 'Average points',
    },
    {
      icon: <Calendar className='h-4 w-4 text-negative' />,
      value: stats.totalGameweeks,
      label: 'Gameweeks',
    },
  ];

  return (
    <Card className='h-full border-white/10 bg-[#2a0d33]'>
      <CardHeader className='pb-3'>
        <CardTitle className='text-base text-white md:text-lg'>
          Position statistics
        </CardTitle>
        {provisionalGameweek != null && (
          <LiveGameweekBadge
            gameweek={provisionalGameweek}
            className='self-start'
          />
        )}
      </CardHeader>
      <CardContent className='space-y-6'>
        {/* Key Stats */}
        <div className='grid grid-cols-2 gap-3'>
          {keyStats.map((stat) => (
            <div
              key={stat.label}
              className='rounded-md bg-[#1a0520] p-3 text-center'
            >
              <div className='mb-1 flex items-center justify-center gap-1'>
                {stat.icon}
                <span className='text-lg font-bold text-white tabular-nums'>
                  {stat.value}
                </span>
              </div>
              <p className='text-xs text-white/50'>{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Position Distribution */}
        <div className='space-y-3'>
          <h4 className='text-sm font-medium text-white/80'>
            Position distribution
          </h4>
          <div className='space-y-2'>
            {positionData.map((pos) => (
              <div key={pos.position} className='flex items-center gap-3'>
                <div className='w-8 text-right text-xs font-medium text-white/60'>
                  {pos.position}
                </div>
                <div className='flex-1'>
                  <Progress
                    value={(pos.count / maxCount) * 100}
                    className='h-2 bg-white/10'
                  />
                </div>
                <div className='w-6 text-right text-xs font-bold text-white tabular-nums'>
                  {pos.count}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Best/Worst Performance */}
        <div className='grid grid-cols-2 gap-3'>
          <div className='rounded-md border border-emerald-500/20 bg-emerald-500/10 p-3'>
            <h5 className='mb-1 text-xs font-medium text-emerald-400'>Best</h5>
            <p className='text-base font-bold text-white tabular-nums'>
              {stats.bestGameweek.points} pts
            </p>
            <p className='text-[10px] text-white/50 tabular-nums'>
              GW{stats.bestGameweek.gameweek} (Rank {stats.bestGameweek.rank})
            </p>
          </div>
          <div className='rounded-md border border-red-500/20 bg-red-500/10 p-3'>
            <h5 className='mb-1 text-xs font-medium text-red-400'>Worst</h5>
            <p className='text-base font-bold text-white tabular-nums'>
              {stats.worstGameweek.points} pts
            </p>
            <p className='text-[10px] text-white/50 tabular-nums'>
              GW{stats.worstGameweek.gameweek} (Rank {stats.worstGameweek.rank})
            </p>
          </div>
        </div>

        {/* Rumbler Warning */}
        {stats.rumblerCount > 0 && (
          <div className='rounded-md border border-amber-500/20 bg-amber-500/10 p-3 text-center'>
            <p className='text-sm text-amber-400'>
              <span className='font-bold'>{stats.rumblerCount}</span> Rumbler
              {stats.rumblerCount !== 1 ? 's' : ''}
              <span className='ml-2 text-xs text-white/40'>
                (rumbler: last in the gameweek)
              </span>
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

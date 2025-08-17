// components/PlayerView/PositionStatsCard.tsx
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Trophy, Target, TrendingUp, Calendar } from 'lucide-react';

interface PositionStats {
  first: number;
  second: number;
  third: number;
  fourth: number;
  fifth: number;
  sixth: number;
  seventh: number;
  eighth: number;
}

interface PlayerStats {
  totalGameweeks: number;
  totalWins: number;
  totalPoints: number;
  averagePoints: number;
  averageRank: number;
  bestGameweek: {
    gameweek: number;
    points: number;
    rank: number;
  };
  worstGameweek: {
    gameweek: number;
    points: number;
    rank: number;
  };
  rumblerCount: number;
  consistency: number;
  positionStats: PositionStats;
}

interface PositionStatsCardProps {
  stats: PlayerStats;
}

export function PositionStatsCard({ stats }: PositionStatsCardProps) {
  const positionData = [
    {
      position: '1st',
      count: stats.positionStats.first,
      color: 'text-yellow-400',
      bgColor: 'bg-yellow-400',
    },
    {
      position: '2nd',
      count: stats.positionStats.second,
      color: 'text-gray-300',
      bgColor: 'bg-gray-300',
    },
    {
      position: '3rd',
      count: stats.positionStats.third,
      color: 'text-amber-600',
      bgColor: 'bg-amber-600',
    },
    {
      position: '4th',
      count: stats.positionStats.fourth,
      color: 'text-blue-400',
      bgColor: 'bg-blue-400',
    },
    {
      position: '5th',
      count: stats.positionStats.fifth,
      color: 'text-green-400',
      bgColor: 'bg-green-400',
    },
    {
      position: '6th',
      count: stats.positionStats.sixth,
      color: 'text-orange-400',
      bgColor: 'bg-orange-400',
    },
    {
      position: '7th',
      count: stats.positionStats.seventh,
      color: 'text-purple-400',
      bgColor: 'bg-purple-400',
    },
    {
      position: '8th',
      count: stats.positionStats.eighth,
      color: 'text-red-400',
      bgColor: 'bg-red-400',
    },
  ];

  const maxCount = Math.max(...positionData.map((p) => p.count));

  return (
    <Card className='h-full'>
      <CardHeader>
        <CardTitle>Position Statistics</CardTitle>
      </CardHeader>
      <CardContent className='space-y-6'>
        {/* Key Stats */}
        <div className='grid grid-cols-2 gap-4'>
          <div className='text-center'>
            <div className='flex items-center justify-center space-x-1 text-yellow-400'>
              <Trophy className='h-4 w-4' />
              <span className='text-2xl font-bold'>{stats.totalWins}</span>
            </div>
            <p className='text-sm text-gray-400'>Wins (1st Place)</p>
          </div>
          <div className='text-center'>
            <div className='flex items-center justify-center space-x-1 text-blue-400'>
              <Target className='h-4 w-4' />
              <span className='text-2xl font-bold'>
                {stats.averageRank.toFixed(1)}
              </span>
            </div>
            <p className='text-sm text-gray-400'>Average Rank</p>
          </div>
          <div className='text-center'>
            <div className='flex items-center justify-center space-x-1 text-green-400'>
              <TrendingUp className='h-4 w-4' />
              <span className='text-2xl font-bold'>
                {stats.averagePoints.toFixed(0)}
              </span>
            </div>
            <p className='text-sm text-gray-400'>Avg Points</p>
          </div>
          <div className='text-center'>
            <div className='flex items-center justify-center space-x-1 text-purple-400'>
              <Calendar className='h-4 w-4' />
              <span className='text-2xl font-bold'>{stats.totalGameweeks}</span>
            </div>
            <p className='text-sm text-gray-400'>Gameweeks</p>
          </div>
        </div>

        {/* Position Distribution */}
        <div>
          <h4 className='mb-3 font-medium text-white'>Position Distribution</h4>
          <div className='space-y-2'>
            {positionData.map((pos) => (
              <div key={pos.position} className='flex items-center space-x-3'>
                <div className='w-8 text-right text-sm font-medium text-gray-300'>
                  {pos.position}
                </div>
                <div className='flex-1'>
                  <div className='relative h-6 rounded-full bg-gray-700'>
                    <div
                      className={`absolute left-0 top-0 h-full rounded-full ${pos.bgColor} transition-all duration-300`}
                      style={{
                        width:
                          maxCount > 0
                            ? `${(pos.count / maxCount) * 100}%`
                            : '0%',
                      }}
                    />
                  </div>
                </div>
                <div className='w-8 text-right text-sm font-bold text-white'>
                  {pos.count}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Best/Worst Performance */}
        <div className='grid grid-cols-2 gap-4 rounded-lg bg-gray-800 p-4'>
          <div>
            <h5 className='mb-1 text-sm font-medium text-green-400'>
              Best Performance
            </h5>
            <p className='text-lg font-bold text-white'>
              {stats.bestGameweek.points} pts
            </p>
            <p className='text-xs text-gray-400'>
              GW{stats.bestGameweek.gameweek} (Rank {stats.bestGameweek.rank})
            </p>
          </div>
          <div>
            <h5 className='mb-1 text-sm font-medium text-red-400'>
              Worst Performance
            </h5>
            <p className='text-lg font-bold text-white'>
              {stats.worstGameweek.points} pts
            </p>
            <p className='text-xs text-gray-400'>
              GW{stats.worstGameweek.gameweek} (Rank {stats.worstGameweek.rank})
            </p>
          </div>
        </div>

        {/* Additional Stats */}
        {stats.rumblerCount > 0 && (
          <div className='rounded-lg bg-red-900/30 p-3 text-center'>
            <p className='text-sm text-red-400'>
              <span className='font-bold'>{stats.rumblerCount}</span> Rumbler
              {stats.rumblerCount !== 1 ? 's' : ''}
              <span className='ml-2 text-xs text-gray-400'>
                (Lowest scorer)
              </span>
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

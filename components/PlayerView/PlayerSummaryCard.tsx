// components/PlayerView/PlayerSummaryCard.tsx
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import {
  Trophy,
  Users,
  Zap,
  Award,
  Frown,
  BarChart3,
  BeerIcon,
} from 'lucide-react';

interface PlayerSummaryCardProps {
  player: any; // We'll properly type this later
}

export function PlayerSummaryCard({ player }: PlayerSummaryCardProps) {
  const { stats } = player;

  return (
    <Card className='h-full'>
      <CardHeader>
        <CardTitle className='text-2xl'>Player Stats</CardTitle>
      </CardHeader>
      <CardContent>
        <div className='flex h-full flex-col justify-between space-y-6'>
          <div className='grid grid-cols-2 gap-6'>
            <div className='rounded-lg bg-blue-400 p-4'>
              <div className='flex flex-col items-start gap-2'>
                <div className='flex flex-row gap-2'>
                  <Trophy className='h-6 w-6 text-yellow-400' />
                  <p className='text-sm text-gray-300'>Win Rate</p>
                </div>
                <div>
                  <p className='text-lg font-medium text-white'>
                    {stats.winPercentage}%
                  </p>
                </div>
              </div>
            </div>

            <div className='rounded-lg bg-blue-400 p-4'>
              <div className='flex flex-col items-start gap-2'>
                <div className='flex flex-row gap-2'>
                  <Users className='h-6 w-6 text-white' />
                  <p className='text-sm text-gray-300'>Record</p>
                </div>
                <div>
                  <p className='text-lg font-medium text-white'>
                    {stats.totalWins}W - {stats.totalLosses}L -{' '}
                    {stats.totalDraws}D
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className='grid grid-cols-2 gap-6'>
            <div className='rounded-lg bg-blue-400 p-4'>
              <div className='flex flex-col items-start gap-2'>
                <div className='flex flex-row gap-2'>
                  <Zap className='h-6 w-6 text-amber-400' />
                  <p className='text-sm text-gray-300'>Avg. Points</p>
                </div>
                <div>
                  <p className='text-lg font-medium text-white'>
                    {stats.averagePoints}
                  </p>
                </div>
              </div>
            </div>

            <div className='rounded-lg bg-blue-400 p-4'>
              <div className='flex flex-col items-start gap-2'>
                <div className='flex flex-row gap-2'>
                  <Award className='h-6 w-6 text-emerald-400' />
                  <p className='text-sm text-gray-300'>Best GW</p>
                </div>
                <div>
                  <p className='text-lg font-medium text-white'>
                    GW{stats.bestGameweek.gameweek}: {stats.bestGameweek.points}
                    pts
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className='grid grid-cols-2 gap-6'>
            <div className='rounded-lg bg-blue-400 p-4'>
              <div className='flex flex-col items-start gap-2'>
                <div className='flex flex-row gap-2'>
                  <Frown className='h-6 w-6 text-red-600' />
                  <p className='text-sm text-gray-300'>Worst GW</p>
                </div>
                <div>
                  <p className='text-lg font-medium text-white'>
                    GW{stats.worstGameweek.gameweek}:{' '}
                    {stats.worstGameweek.points}pts
                  </p>
                </div>
              </div>
            </div>

            <div className='rounded-lg bg-blue-400 p-4'>
              <div className='flex flex-col items-start gap-2'>
                <div className='flex flex-row gap-2'>
                  <BeerIcon className='h-6 w-6 text-yellow-400' />
                  <p className='text-sm text-gray-300'>Rumblers</p>
                </div>
                <div>
                  <p className='text-lg font-medium text-white'>
                    {stats.rumblerCount}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className='grid grid-cols-1 gap-6'>
            <div className='rounded-lg bg-blue-400 p-4'>
              <div className='flex flex-col items-start gap-2'>
                <div className='flex flex-row gap-2'>
                  <BarChart3 className='h-6 w-6 text-purple-800' />
                  <p className='text-sm text-gray-300'>Total Points</p>
                </div>
                <div>
                  <p className='text-lg font-medium text-white'>
                    {stats.totalPoints}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

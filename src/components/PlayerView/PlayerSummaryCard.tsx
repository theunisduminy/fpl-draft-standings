// components/PlayerView/PlayerSummaryCard.tsx
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import {
  Trophy,
  Zap,
  Award,
  Frown,
  BarChart3,
  BeerIcon,
  Target,
} from 'lucide-react';

interface PlayerSummaryCardProps {
  player: any;
}

export function PlayerSummaryCard({ player }: PlayerSummaryCardProps) {
  const { stats } = player;

  const statItems = [
    {
      icon: <Trophy className='h-5 w-5 text-yellow-400' />,
      label: 'F1 Score',
      value: player.f1_score || 0,
      color: 'text-yellow-400',
    },
    {
      icon: <Target className='h-5 w-5 text-[#00edfd]' />,
      label: 'F1 Ranking',
      value: `#${player.f1_ranking || 'N/A'}`,
      color: 'text-[#00edfd]',
    },
    {
      icon: <Zap className='h-5 w-5 text-[#75fa95]' />,
      label: 'Avg. Points',
      value: stats.averagePoints,
      color: 'text-[#75fa95]',
    },
    {
      icon: <Award className='h-5 w-5 text-emerald-400' />,
      label: 'Best GW',
      value: `GW${stats.bestGameweek.gameweek}: ${stats.bestGameweek.points}pts`,
      color: 'text-emerald-400',
    },
    {
      icon: <Frown className='h-5 w-5 text-red-400' />,
      label: 'Worst GW',
      value: `GW${stats.worstGameweek.gameweek}: ${stats.worstGameweek.points}pts`,
      color: 'text-red-400',
    },
    {
      icon: <BeerIcon className='h-5 w-5 text-amber-400' />,
      label: 'Rumblers',
      value: stats.rumblerCount,
      color: 'text-amber-400',
    },
    {
      icon: <BarChart3 className='h-5 w-5 text-purple-400' />,
      label: 'Total Points',
      value: stats.totalPoints,
      color: 'text-purple-400',
    },
  ];

  return (
    <Card className='h-full border-white/10 bg-[#2a0d33]'>
      <CardHeader className='pb-3'>
        <CardTitle className='text-base text-white md:text-lg'>
          Player Stats
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className='grid grid-cols-2 gap-3'>
          {statItems.map((item) => (
            <div
              key={item.label}
              className='rounded-lg bg-[#1a0520] p-3 transition-colors hover:bg-[#1a0520]/80'
            >
              <div className='mb-2 flex items-center gap-2'>
                {item.icon}
                <p className='text-xs text-white/50'>{item.label}</p>
              </div>
              <p className={`text-sm font-bold md:text-base ${item.color}`}>
                {item.value}
              </p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

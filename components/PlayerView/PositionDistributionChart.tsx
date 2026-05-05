'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
  Cell,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ChartConfig,
  ChartContainer,
  ChartTooltipContent,
} from '@/components/ui/chart';
import { PlayerDetails } from '@/interfaces/players';
import { Trophy, Medal, Beer, Target } from 'lucide-react';

const POSITION_COLORS: Record<string, string> = {
  first: '#facc15', // yellow-400
  second: '#d1d5db', // gray-300
  third: '#f59e0b', // amber-500
  fourth: '#60a5fa', // blue-400
  fifth: '#4ade80', // green-400
  sixth: '#fb923c', // orange-400
  seventh: '#c084fc', // purple-400
  eighth: '#f87171', // red-400
};

const POSITION_LABELS: Record<string, string> = {
  first: '1st',
  second: '2nd',
  third: '3rd',
  fourth: '4th',
  fifth: '5th',
  sixth: '6th',
  seventh: '7th',
  eighth: '8th',
};

interface PositionDistributionChartProps {
  players: PlayerDetails[];
}

export function PositionDistributionChart({
  players,
}: PositionDistributionChartProps) {
  // Build chart data: each row is a player with counts per position
  const chartData = players.map((player) => ({
    name: player.player_name,
    ...player.position_placed,
  }));

  // Compute summary stats
  const mostWins = [...players].sort(
    (a, b) => b.position_placed.first - a.position_placed.first,
  )[0];
  const mostPodiums = [...players].sort(
    (a, b) =>
      b.position_placed.first +
      b.position_placed.second +
      b.position_placed.third -
      (a.position_placed.first +
        a.position_placed.second +
        a.position_placed.third),
  )[0];
  const mostRumblers = [...players].sort(
    (a, b) => b.position_placed.eighth - a.position_placed.eighth,
  )[0];
  const mostConsistent = [...players].sort((a, b) => {
    const aTotal = Object.values(a.position_placed).reduce((s, v) => s + v, 0);
    const bTotal = Object.values(b.position_placed).reduce((s, v) => s + v, 0);
    const aAvg =
      Object.entries(a.position_placed).reduce(
        (s, [k, v]) => s + (parseInt(k) || 0) * v,
        0,
      ) / aTotal;
    const bAvg =
      Object.entries(b.position_placed).reduce(
        (s, [k, v]) => s + (parseInt(k) || 0) * v,
        0,
      ) / bTotal;
    return Math.abs(aAvg - 4.5) - Math.abs(bAvg - 4.5);
  })[0];

  const stats = [
    {
      icon: <Trophy className='h-4 w-4 text-yellow-400' />,
      label: 'Most Wins',
      value: mostWins?.player_name || '-',
      detail: `${mostWins?.position_placed.first || 0} wins`,
    },
    {
      icon: <Medal className='h-4 w-4 text-amber-500' />,
      label: 'Most Podiums',
      value: mostPodiums?.player_name || '-',
      detail: `${
        (mostPodiums?.position_placed.first || 0) +
        (mostPodiums?.position_placed.second || 0) +
        (mostPodiums?.position_placed.third || 0)
      } podiums`,
    },
    {
      icon: <Beer className='h-4 w-4 text-red-400' />,
      label: 'Most Rumblers',
      value: mostRumblers?.player_name || '-',
      detail: `${mostRumblers?.position_placed.eighth || 0} rumblers`,
    },
    {
      icon: <Target className='h-4 w-4 text-[#00edfd]' />,
      label: 'Most Consistent',
      value: mostConsistent?.player_name || '-',
      detail: 'Closest to mid-table',
    },
  ];

  const chartConfig = Object.fromEntries(
    Object.keys(POSITION_COLORS).map((key) => [
      key,
      { label: POSITION_LABELS[key], color: POSITION_COLORS[key] },
    ]),
  ) satisfies ChartConfig;

  return (
    <div className='w-full space-y-4'>
      {/* Summary stat cards */}
      <div className='grid grid-cols-2 gap-3 md:grid-cols-4'>
        {stats.map((stat) => (
          <Card key={stat.label} className='border-white/10 bg-[#2a0d33]'>
            <CardContent className='p-3 pt-3 md:p-4 md:pt-4'>
              <div className='mb-1 flex items-center gap-2'>
                {stat.icon}
                <span className='text-xs text-white/50'>{stat.label}</span>
              </div>
              <p className='truncate text-sm font-bold text-white md:text-base'>
                {stat.value}
              </p>
              <p className='text-[10px] text-white/40'>{stat.detail}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Stacked bar chart */}
      <Card className='w-full border-white/10 bg-[#2a0d33]'>
        <CardHeader className='pb-2'>
          <CardTitle className='text-base text-white md:text-lg'>
            Position Distribution
          </CardTitle>
        </CardHeader>
        <CardContent className='p-2 md:p-4'>
          <ChartContainer config={chartConfig}>
            <BarChart
              layout='vertical'
              data={chartData}
              margin={{ top: 0, right: 10, left: -10, bottom: 0 }}
              height={chartData.length * 50}
            >
              <CartesianGrid
                horizontal={false}
                stroke='rgba(255,255,255,0.05)'
              />
              <XAxis
                type='number'
                tickLine={false}
                axisLine={false}
                tick={{
                  fill: 'rgba(255,255,255,0.5)',
                  fontSize: 11,
                }}
              />
              <YAxis
                type='category'
                dataKey='name'
                tickLine={false}
                axisLine={false}
                width={70}
                tick={{
                  fill: 'rgba(255,255,255,0.7)',
                  fontSize: 12,
                }}
              />
              <Tooltip
                cursor={{ fill: 'rgba(255,255,255,0.03)' }}
                content={<ChartTooltipContent hideLabel />}
              />
              {Object.keys(POSITION_COLORS).map((posKey) => (
                <Bar
                  key={posKey}
                  dataKey={posKey}
                  stackId='positions'
                  fill={POSITION_COLORS[posKey]}
                  radius={posKey === 'eighth' ? [0, 4, 4, 0] : [0, 0, 0, 0]}
                  barSize={28}
                />
              ))}
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>
    </div>
  );
}

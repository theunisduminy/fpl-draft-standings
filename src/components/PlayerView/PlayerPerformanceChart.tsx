// components/PlayerView/PlayerPerformanceChart.tsx
'use client';

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';

interface PerformanceData {
  gameweek: number;
  points: number;
}

interface PlayerPerformanceChartProps {
  data: PerformanceData[];
  playerName?: string;
}

const chartConfig = {
  points: {
    label: 'Points',
    color: '#75fa95',
  },
} satisfies ChartConfig;

export function PlayerPerformanceChart({
  data,
  playerName,
}: PlayerPerformanceChartProps) {
  const chartData = data.map((item) => ({
    ...item,
    name: `GW ${item.gameweek}`,
  }));

  const totalPoints = data.reduce((sum, item) => sum + item.points, 0);
  const averagePoints = data.length > 0 ? totalPoints / data.length : 0;

  return (
    <Card className='w-full border-white/10 bg-[#2a0d33]'>
      <CardHeader className='pb-2'>
        <CardTitle className='flex items-center justify-between text-base text-white md:text-lg'>
          <span>Gameweek Performance</span>
          <span className='text-xs font-normal text-white/50 md:text-sm'>
            Avg: {averagePoints.toFixed(1)} pts
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className='p-2 md:p-4'>
        <ChartContainer
          config={chartConfig}
          className='aspect-[4/3] w-full md:aspect-[3/1] md:min-h-[300px]'
        >
          <ResponsiveContainer width='100%' height='100%'>
            <LineChart
              data={chartData}
              margin={{
                top: 10,
                right: 10,
                left: 0,
                bottom: 10,
              }}
            >
              <CartesianGrid
                strokeDasharray='3 3'
                stroke='rgba(255,255,255,0.1)'
              />
              <XAxis
                dataKey='name'
                tick={{
                  fill: 'rgba(255,255,255,0.5)',
                  fontSize: 11,
                }}
                tickMargin={8}
                axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                interval='preserveStartEnd'
              />
              <YAxis
                tick={{
                  fill: 'rgba(255,255,255,0.5)',
                  fontSize: 11,
                }}
                domain={['auto', 'auto']}
                allowDecimals={false}
                width={30}
                axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
              />
              <ChartTooltip content={<ChartTooltipContent />} />
              <ReferenceLine
                y={averagePoints}
                stroke='rgba(255,255,255,0.3)'
                strokeDasharray='3 3'
                label={{
                  value: 'Avg',
                  position: 'insideTopRight',
                  fill: 'rgba(255,255,255,0.5)',
                  fontSize: 11,
                }}
              />
              <Line
                type='monotone'
                dataKey='points'
                stroke='#75fa95'
                strokeWidth={2.5}
                dot={{ fill: '#75fa95', r: 4, strokeWidth: 0 }}
                activeDot={{
                  r: 6,
                  fill: '#00edfd',
                  strokeWidth: 0,
                }}
              />
            </LineChart>
          </ResponsiveContainer>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}

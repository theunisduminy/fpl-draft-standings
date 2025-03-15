// components/PlayerView/PlayerPerformanceChart.tsx
'use client';

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
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
  // Add gameweek label to make the chart more readable
  const chartData = data.map((item) => ({
    ...item,
    name: `GW ${item.gameweek}`,
  }));

  // Calculate the average points
  const totalPoints = data.reduce((sum, item) => sum + item.points, 0);
  const averagePoints = data.length > 0 ? totalPoints / data.length : 0;

  return (
    <Card className='w-full'>
      <CardHeader>
        <CardTitle className='flex items-center justify-between'>
          <span>Gameweek Performance</span>
          <span className='text-sm font-normal text-gray-200'>
            Average: {averagePoints.toFixed(1)} pts
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className='p-2'>
        <div className='w-full md:h-full'>
          <ChartContainer config={chartConfig}>
            <ResponsiveContainer width='100%' height='100%'>
              <LineChart
                data={chartData}
                margin={{
                  top: 10,
                  right: 10,
                  left: 10,
                  bottom: 30,
                }}
              >
                <CartesianGrid strokeDasharray='3 3' />
                <XAxis
                  dataKey='name'
                  tick={{ fill: '#FFFFFF', fontSize: '12px' }}
                  tickMargin={10}
                  angle={-45}
                  textAnchor='end'
                  height={60}
                  interval={'preserveStartEnd'}
                />
                <YAxis
                  tick={{ fill: '#FFFFFF', fontSize: '12px' }}
                  domain={['auto', 'auto']}
                  allowDecimals={false}
                  width={35}
                />
                <ChartTooltip content={<ChartTooltipContent />} />
                <ReferenceLine
                  y={averagePoints}
                  stroke='#FFFFFF'
                  strokeDasharray='3 3'
                  label={{
                    value: 'Average',
                    position: 'insideTopRight',
                    fill: '#FFFFFF',
                  }}
                />
                <Line
                  type='monotone'
                  dataKey='points'
                  stroke='#75fa95'
                  strokeWidth={3}
                  dot={{ fill: '#75fa95', r: 5 }}
                  activeDot={{ r: 8, fill: '#00edfd' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </ChartContainer>
        </div>
      </CardContent>
    </Card>
  );
}

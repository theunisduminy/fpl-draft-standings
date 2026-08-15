'use client';

import { Bar, BarChart, CartesianGrid, XAxis, YAxis, Tooltip } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ChartConfig,
  ChartContainer,
  ChartTooltipContent,
} from '@/components/ui/chart';
import { PlayerDetails } from '@/interfaces/players';

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

  const chartConfig = Object.fromEntries(
    Object.keys(POSITION_COLORS).map((key) => [
      key,
      { label: POSITION_LABELS[key], color: POSITION_COLORS[key] },
    ]),
  ) satisfies ChartConfig;

  return (
    <Card className='w-full border-border bg-card'>
      <CardHeader className='pb-2'>
        <CardTitle className='text-base text-foreground md:text-lg'>
          Position distribution
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
            <CartesianGrid horizontal={false} stroke='rgba(255,255,255,0.05)' />
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

        {/* Legend */}
        <div className='mt-4 grid grid-cols-4 gap-2 border-t border-border pt-3'>
          {Object.entries(POSITION_COLORS).map(([key, color]) => (
            <div key={key} className='flex items-center justify-center gap-1.5'>
              <div
                className='h-3 w-3 rounded-sm'
                style={{ backgroundColor: color }}
              />
              <span className='text-xs text-muted-foreground'>
                {POSITION_LABELS[key]}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

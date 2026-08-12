'use client';

import { TrendingUp, TrendingDown } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import { RumblerGameweekData } from '@/interfaces/players';

interface RumblerFrequencyChartProps {
  data: RumblerGameweekData[];
}

const chartConfig = {
  count: {
    label: 'Count',
    color: '#75fa95',
  },
} satisfies ChartConfig;

export function RumblerFrequencyChart({ data }: RumblerFrequencyChartProps) {
  const rumblerFrequency = data.reduce(
    (acc, gameweek) => {
      gameweek.player_names.forEach((player) => {
        acc[player] = (acc[player] || 0) + 1;
      });
      return acc;
    },
    {} as Record<string, number>,
  );

  const chartData = Object.entries(rumblerFrequency)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  const totalRumblers = chartData.reduce((sum, item) => sum + item.count, 0);
  const averageRumblers =
    chartData.length > 0 ? totalRumblers / chartData.length : 1;
  const topPlayerRumblers = chartData[0]?.count || 0;
  const trend = ((topPlayerRumblers - averageRumblers) / averageRumblers) * 100;

  return (
    <div className='w-full space-y-4'>
      <div>
        <h2 className='text-lg font-semibold text-white md:text-xl'>
          Who had the most rumblers?
        </h2>
        <p className='mt-1 text-sm text-white/60'>
          Who has to make up for their Draft skills with drinking.
        </p>
      </div>
      <Card className='w-full border-white/10 bg-[#2a0d33]'>
        <CardHeader className='pb-2'>
          <CardTitle className='text-base text-white md:text-lg'>
            Rumbler Frequency
          </CardTitle>
        </CardHeader>
        <CardContent className='p-3 pt-0 md:p-4 md:pt-0'>
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
              <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
              <Bar dataKey='count' fill='#75fa95' radius={4} barSize={24} />
            </BarChart>
          </ChartContainer>
        </CardContent>
        <CardFooter className='flex-col items-start gap-2 border-t border-white/10 pt-4'>
          <div className='flex gap-2 text-xs font-medium text-white/60 md:text-sm'>
            {trend > 0 ? 'Trending up' : 'Trending down'} by{' '}
            {Math.abs(trend).toFixed(1)}% compared to average
            {trend > 0 ? (
              <TrendingUp className='h-4 w-4 text-[#75fa95]' />
            ) : (
              <TrendingDown className='h-4 w-4 text-red-400' />
            )}
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}

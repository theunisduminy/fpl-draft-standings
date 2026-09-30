'use client';

import { TrendingUp, TrendingDown } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';

import { ChartCard } from '@/components/ChartCard';
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
    color: 'hsl(var(--positive))',
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
  const above = trend >= 0;

  return (
    <ChartCard
      title='Rumbler frequency'
      caption='Who has finished last most often this season'
      contentClassName='p-3 pt-0 md:p-4 md:pt-0'
    >
      {/* Explicit, because `ChartContainer`'s default is now `aspect-video`
          — right for a time series, wrong for a categorical bar list, where
          a wide short box squeezes one row per manager into nothing. */}
      <div
        role='img'
        aria-label={`Rumbler frequency: ${chartData
          .map((item) => `${item.name} ${item.count}`)
          .join(', ')}`}
      >
        <ChartContainer
          config={chartConfig}
          className='aspect-square w-full md:aspect-[2/1] md:min-h-[320px]'
        >
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
            <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
            <Bar
              dataKey='count'
              fill='var(--color-positive)'
              radius={4}
              barSize={24}
              isAnimationActive={false}
            />
          </BarChart>
        </ChartContainer>
        <ul className='sr-only'>
          {chartData.map((item) => (
            <li key={item.name}>
              {item.name}: {item.count}
            </li>
          ))}
        </ul>
      </div>

      <div className='mt-4 flex gap-2 border-t border-white/10 pt-4 text-xs font-medium text-white/60 md:text-sm'>
        {Math.abs(trend).toFixed(1)} percent {above ? 'above' : 'below'} the
        average rumbler count
        {above ? (
          <TrendingUp className='h-4 w-4 text-positive' />
        ) : (
          <TrendingDown className='h-4 w-4 text-negative' />
        )}
      </div>
    </ChartCard>
  );
}

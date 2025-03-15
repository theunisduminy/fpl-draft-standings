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

export const description =
  'A bar chart showing the frequency of rumbler victims';

interface GameweekData {
  gameweek: number;
  points: number;
  entry_names: string[];
  player_names: string[];
}

interface RumblerFrequencyChartProps {
  data: GameweekData[];
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
    .slice(0, 8); // Top 10 players

  const totalRumblers = chartData.reduce((sum, item) => sum + item.count, 0);
  const averageRumblers = totalRumblers / chartData.length;
  const topPlayerRumblers = chartData[0]?.count || 0;
  const trend = ((topPlayerRumblers - averageRumblers) / averageRumblers) * 100;

  return (
    <div className='flex w-[350px] flex-col md:w-[600px]'>
      <h1 className='pb-2 text-xl font-semibold text-[#310639]'>
        👀 Who had the most rumblers?
      </h1>
      <p className='pb-5 text-sm'>
        Visualed, who has to make up for their Draft skills with drinking.
      </p>
      <Card>
        <CardHeader>
          <CardTitle>Rumbler Frequency</CardTitle>
          {/* <CardDescription>Top rumbler victims</CardDescription> */}
        </CardHeader>
        <CardContent>
          <ChartContainer config={chartConfig}>
            <BarChart
              layout='vertical' // Keep the layout as vertical for better use of mobile space
              data={chartData}
              margin={{ top: 0, right: 0, left: -50, bottom: 0 }}
              width={350} // Set a width suitable for mobile devices
              height={chartData.length * 80} // Dynamically adjust height, giving more room per label
            >
              <CartesianGrid horizontal={false} />
              <XAxis
                type='number'
                tickLine={false}
                axisLine={false}
                tick={{ fill: '#FFFFFF' }}
              />
              <YAxis
                type='category'
                dataKey='name'
                tickLine={false}
                axisLine={false}
                width={100} // Ensure the full name is visible
                tick={{ fill: '#FFFFFF' }}
              />
              <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
              <Bar dataKey='count' fill='#75fa95' radius={6} barSize={30} />
            </BarChart>
          </ChartContainer>
        </CardContent>
        <CardFooter className='flex-col items-start gap-2 text-sm'>
          <div className='flex gap-2 font-medium leading-none text-gray-200'>
            {trend > 0 ? 'Trending up' : 'Trending down'} by{' '}
            {Math.abs(trend).toFixed(1)}% compared to average
            {trend > 0 ? (
              <TrendingUp className='h-4 w-4' />
            ) : (
              <TrendingDown className='h-4 w-4' />
            )}
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}

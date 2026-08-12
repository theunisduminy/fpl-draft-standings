'use client';

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  Area,
  AreaChart,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ChartConfig,
  ChartContainer,
  ChartTooltipContent,
} from '@/components/ui/chart';
import { GameweekPerformance } from '@/interfaces/players';

interface PodiumRaceProps {
  performances: GameweekPerformance[];
  playerNames: Record<number, string>;
}

const PLAYER_COLORS = [
  '#facc15',
  '#00edfd',
  '#75fa95',
  '#f87171',
  '#c084fc',
  '#fb923c',
  '#60a5fa',
  '#4ade80',
];

export function PodiumRace({ performances, playerNames }: PodiumRaceProps) {
  // Group by player
  const byPlayer: Record<number, GameweekPerformance[]> = {};
  performances.forEach((p) => {
    if (!byPlayer[p.league_entry]) byPlayer[p.league_entry] = [];
    byPlayer[p.league_entry].push(p);
  });

  Object.values(byPlayer).forEach((arr) =>
    arr.sort((a, b) => a.event - b.event),
  );

  // All events
  const allEvents = Array.from(new Set(performances.map((p) => p.event))).sort(
    (a, b) => a - b,
  );

  // Compute cumulative podium count (1st + 2nd + 3rd) per gameweek
  const chartData = allEvents.map((event) => {
    const point: Record<string, any> = { event: `GW${event}` };

    Object.entries(byPlayer).forEach(([playerId, playerPerf]) => {
      const perfUpToEvent = playerPerf.filter((p) => p.event <= event);
      const podiumCount = perfUpToEvent.filter((p) => p.rank <= 3).length;
      point[playerNames[parseInt(playerId)] || `P${playerId}`] = podiumCount;
    });

    return point;
  });

  const players = Object.keys(byPlayer).map((id) => ({
    id: parseInt(id),
    name: playerNames[parseInt(id)] || `Player ${id}`,
  }));

  const chartConfig = Object.fromEntries(
    players.map((p, i) => [
      p.name,
      { label: p.name, color: PLAYER_COLORS[i % PLAYER_COLORS.length] },
    ]),
  ) satisfies ChartConfig;

  return (
    <Card className='w-full border-white/10 bg-[#2a0d33]'>
      <CardHeader className='pb-2'>
        <CardTitle className='text-base text-white md:text-lg'>
          Podium Race
        </CardTitle>
        <p className='text-xs text-white/50'>
          Cumulative top-3 finishes over the season
        </p>
      </CardHeader>
      <CardContent className='p-2 md:p-4'>
        <ChartContainer config={chartConfig}>
          <LineChart
            data={chartData}
            margin={{ top: 10, right: 10, left: 0, bottom: 10 }}
          >
            <CartesianGrid
              strokeDasharray='3 3'
              stroke='rgba(255,255,255,0.1)'
            />
            <XAxis
              dataKey='event'
              tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 11 }}
              tickMargin={8}
              axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
              interval='preserveStartEnd'
            />
            <YAxis
              tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 11 }}
              allowDecimals={false}
              width={30}
              axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
            />
            <Tooltip content={<ChartTooltipContent />} />
            {players.map((player, i) => (
              <Line
                key={player.id}
                type='stepAfter'
                dataKey={player.name}
                stroke={PLAYER_COLORS[i % PLAYER_COLORS.length]}
                strokeWidth={2.5}
                dot={false}
                activeDot={{ r: 5, strokeWidth: 0 }}
              />
            ))}
          </LineChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}

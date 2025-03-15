'use client';
import { TrendingUp } from 'lucide-react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
} from '@/components/ui/card';
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  Radar,
  ResponsiveContainer,
} from 'recharts';
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import { PlayerDetails } from '@/interfaces/players';
import { Match } from '@/interfaces/match';

interface GameweekScoreChartProps {
  gameweek: number;
  matches: Match[];
  players: PlayerDetails[];
}

const chartConfig = {
  score: {
    label: 'Points',
    color: '#75fa95',
  },
} satisfies ChartConfig;

export function GameweekScoreChart({
  gameweek,
  matches,
  players,
}: GameweekScoreChartProps) {
  // Filter matches for the selected gameweek
  const gameweekMatches = matches.filter(
    (m) => m.event === gameweek && m.finished,
  );

  if (gameweekMatches.length === 0) {
    return null;
  }

  // Calculate player scores for this gameweek
  const playerScores: Record<number, number> = {};

  gameweekMatches.forEach((match) => {
    if (match.league_entry_1_points) {
      playerScores[match.league_entry_1] = match.league_entry_1_points;
    }
    if (match.league_entry_2_points) {
      playerScores[match.league_entry_2] = match.league_entry_2_points;
    }
  });

  // Prepare data for the chart - sort by score (highest first)
  const chartData = Object.entries(playerScores)
    .map(([playerId, score]) => {
      const playerIdNumber = parseInt(playerId);
      const player = players.find((p) => p.id === playerIdNumber);
      return {
        name: player ? player.player_name : `Player ${playerId}`,
        score,
      };
    })
    .sort((a, b) => b.score - a.score);

  // Calculate average score for the trend
  const averageScore =
    chartData.reduce((acc, curr) => acc + curr.score, 0) / chartData.length;
  const previousGameweekMatches = matches.filter(
    (m) => m.event === gameweek - 1 && m.finished,
  );
  const previousScores = previousGameweekMatches
    .flatMap((match) => [
      match.league_entry_1_points,
      match.league_entry_2_points,
    ])
    .filter(Boolean) as number[];
  const previousAverage = previousScores.length
    ? previousScores.reduce((acc, curr) => acc + curr, 0) /
      previousScores.length
    : 0;
  const trend = ((averageScore - previousAverage) / previousAverage) * 100;

  return (
    <Card className='mt-6'>
      <CardHeader>
        <CardTitle>Gameweek {gameweek} Player Scores</CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer
          config={chartConfig}
          className='mx-auto aspect-square max-h-[400px]'
        >
          <ResponsiveContainer width='100%' height='100%'>
            <RadarChart data={chartData}>
              <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
              <PolarAngleAxis dataKey='name' tick={{ fill: '#FFFFFF' }} />
              <PolarGrid />
              <Radar
                dataKey='score'
                fill='#75fa95'
                fillOpacity={0.6}
                dot={{
                  r: 4,
                  fillOpacity: 1,
                }}
              />
            </RadarChart>
          </ResponsiveContainer>
        </ChartContainer>
      </CardContent>
      <CardFooter className='flex-col gap-2 text-sm text-white'>
        <div className='flex items-center gap-2 font-medium leading-none'>
          {trend > 0 ? 'Trending up' : 'Trending down'} by{' '}
          {Math.abs(trend).toFixed(1)}% this gameweek{' '}
          <TrendingUp className={`h-4 w-4 ${trend < 0 ? 'rotate-180' : ''}`} />
        </div>
        <div className='flex items-center gap-2 leading-none'>
          Average score: {Math.round(averageScore)} points
        </div>
      </CardFooter>
    </Card>
  );
}

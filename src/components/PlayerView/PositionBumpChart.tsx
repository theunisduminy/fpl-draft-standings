'use client';

import { useState } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ChartConfig,
  ChartContainer,
  ChartTooltipContent,
} from '@/components/ui/chart';
import { playerColour } from '@/utils/player-colours';
import type { SeasonSnapshot } from '@/utils/scoring';
import type { LeagueEntryId } from '@/interfaces/fpl';

/**
 * League position, gameweek by gameweek.
 *
 * This replaces two charts that were saying the same thing in different units:
 * podium race counted cumulative top-three finishes, position trajectory
 * plotted a running average rank, and both drew eight lines that climbed
 * together without ever showing who was actually in front. A bump chart does:
 * a line crossing another is an overtake, which is the only event in this
 * league worth drawing.
 *
 * Rank 1 sits at the top, so the axis is reversed. Without that the chart reads
 * upside down to anyone who has seen a league table.
 *
 * Eight lines is a lot at GW38, so hovering a name in the key dims the rest.
 * The key is buttons rather than a recharts legend, because it has to be
 * reachable from the keyboard.
 */
export function PositionBumpChart({
  snapshots,
  playerNames,
}: {
  snapshots: SeasonSnapshot[];
  playerNames: Record<number, string>;
}) {
  const [focused, setFocused] = useState<string | null>(null);

  // Every snapshot holds every manager, so the first one is the full cast.
  const managers = (snapshots[0]?.places ?? []).map((place) => ({
    id: place.league_entry,
    name: nameFor(playerNames, place.league_entry),
  }));

  const chartData = snapshots.map((snapshot) => {
    const point: Record<string, string | number> = {
      event: `GW${snapshot.gameweek}`,
    };

    snapshot.places.forEach((place) => {
      point[nameFor(playerNames, place.league_entry)] = place.rank;
    });

    return point;
  });

  const chartConfig = Object.fromEntries(
    managers.map((manager, index) => [
      manager.name,
      { label: manager.name, color: playerColour(index) },
    ]),
  ) satisfies ChartConfig;

  return (
    <Card className='w-full border-border bg-card'>
      <CardHeader className='pb-2'>
        <CardTitle className='text-base text-foreground md:text-lg'>
          Position by gameweek
        </CardTitle>
        <p className='text-xs text-muted-foreground'>
          Where everyone stood in the table after each gameweek
        </p>
      </CardHeader>
      <CardContent className='p-2 md:p-4'>
        <ChartContainer config={chartConfig}>
          <LineChart
            data={chartData}
            margin={{ top: 10, right: 12, left: 0, bottom: 10 }}
          >
            <CartesianGrid vertical={false} stroke='rgba(255,255,255,0.06)' />
            <XAxis
              dataKey='event'
              tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 11 }}
              tickMargin={8}
              axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
              interval='preserveStartEnd'
            />
            <YAxis
              reversed
              domain={[1, Math.max(managers.length, 1)]}
              ticks={managers.map((_, index) => index + 1)}
              tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 11 }}
              width={28}
              axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
            />
            <Tooltip content={<ChartTooltipContent />} />
            {managers.map((manager, index) => (
              <Line
                key={manager.id}
                type='monotone'
                dataKey={manager.name}
                stroke={playerColour(index)}
                strokeWidth={focused === manager.name ? 3.5 : 2.5}
                strokeOpacity={
                  focused === null || focused === manager.name ? 1 : 0.15
                }
                dot={false}
                activeDot={{ r: 4, strokeWidth: 0 }}
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        </ChartContainer>

        <div className='mt-4 flex flex-wrap gap-x-4 gap-y-2 border-t border-border pt-3'>
          {managers.map((manager, index) => (
            <button
              key={manager.id}
              type='button'
              onMouseEnter={() => setFocused(manager.name)}
              onMouseLeave={() => setFocused(null)}
              onFocus={() => setFocused(manager.name)}
              onBlur={() => setFocused(null)}
              className='flex items-center gap-1.5 rounded-sm text-xs text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none'
            >
              <span
                className='h-2.5 w-2.5 rounded-full'
                style={{ backgroundColor: playerColour(index) }}
              />
              {manager.name}
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function nameFor(
  playerNames: Record<number, string>,
  entry: LeagueEntryId,
): string {
  return playerNames[entry] || `Player ${entry}`;
}

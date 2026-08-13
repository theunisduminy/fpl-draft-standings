'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { GameweekPerformance } from '@/interfaces/players';
import { Flame, Snowflake, TrendingUp, TrendingDown } from 'lucide-react';

interface StreaksTrackerProps {
  performances: GameweekPerformance[];
  playerNames: Record<number, string>;
}

interface StreakInfo {
  playerId: number;
  playerName: string;
  type: 'hot' | 'cold';
  streakLength: number;
  description: string;
}

export function StreaksTracker({
  performances,
  playerNames,
}: StreaksTrackerProps) {
  // Group performances by player and sort by event
  const byPlayer: Record<number, GameweekPerformance[]> = {};
  performances.forEach((p) => {
    if (!byPlayer[p.league_entry]) byPlayer[p.league_entry] = [];
    byPlayer[p.league_entry].push(p);
  });

  Object.values(byPlayer).forEach((arr) =>
    arr.sort((a, b) => a.event - b.event),
  );

  const streaks: StreakInfo[] = [];

  Object.entries(byPlayer).forEach(([playerIdStr, playerPerf]) => {
    const playerId = parseInt(playerIdStr);
    const playerName = playerNames[playerId] || `Player ${playerId}`;

    // Find longest win streak (rank === 1)
    let maxWinStreak = 0;
    let currentWinStreak = 0;
    playerPerf.forEach((p) => {
      if (p.rank === 1) {
        currentWinStreak++;
        maxWinStreak = Math.max(maxWinStreak, currentWinStreak);
      } else {
        currentWinStreak = 0;
      }
    });

    if (maxWinStreak >= 2) {
      streaks.push({
        playerId,
        playerName,
        type: 'hot',
        streakLength: maxWinStreak,
        description: `${maxWinStreak} win streak`,
      });
    }

    // Find longest bottom-3 streak (rank >= 6)
    let maxColdStreak = 0;
    let currentColdStreak = 0;
    playerPerf.forEach((p) => {
      if (p.rank >= 6) {
        currentColdStreak++;
        maxColdStreak = Math.max(maxColdStreak, currentColdStreak);
      } else {
        currentColdStreak = 0;
      }
    });

    if (maxColdStreak >= 3) {
      streaks.push({
        playerId,
        playerName,
        type: 'cold',
        streakLength: maxColdStreak,
        description: `${maxColdStreak} gameweeks in bottom 3`,
      });
    }

    // Current form streak (last 3+ gameweeks all top 3 or all bottom 3)
    const last5 = playerPerf.slice(-5);
    if (last5.length >= 3) {
      const allTop3 = last5.every((p) => p.rank <= 3);
      const allBottom3 = last5.every((p) => p.rank >= 6);

      if (allTop3) {
        streaks.push({
          playerId,
          playerName,
          type: 'hot',
          streakLength: last5.length,
          description: `Last ${last5.length} all top 3`,
        });
      } else if (allBottom3) {
        streaks.push({
          playerId,
          playerName,
          type: 'cold',
          streakLength: last5.length,
          description: `Last ${last5.length} all bottom 3`,
        });
      }
    }
  });

  // Sort by streak length desc
  streaks.sort((a, b) => b.streakLength - a.streakLength);
  const topStreaks = streaks.slice(0, 6);

  if (topStreaks.length === 0) {
    return (
      <Card className='w-full border-white/10 bg-[#2a0d33]'>
        <CardHeader className='pb-2'>
          <CardTitle className='text-base text-white md:text-lg'>
            Streaks
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className='text-sm text-white/50'>
            No significant streaks yet. Check back after a few more gameweeks.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className='w-full border-white/10 bg-[#2a0d33]'>
      <CardHeader className='pb-2'>
        <CardTitle className='text-base text-white md:text-lg'>
          Streaks
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className='space-y-2'>
          {topStreaks.map((streak, index) => (
            <div
              key={`${streak.playerId}-${index}`}
              className={`flex items-center gap-3 rounded-lg p-2.5 ${
                streak.type === 'hot'
                  ? 'border border-orange-500/20 bg-orange-500/10'
                  : 'border border-blue-500/20 bg-blue-500/10'
              }`}
            >
              <div className='flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-[#1a0520]'>
                {streak.type === 'hot' ? (
                  <Flame className='h-4 w-4 text-orange-400' />
                ) : (
                  <Snowflake className='h-4 w-4 text-blue-400' />
                )}
              </div>
              <div className='min-w-0 flex-1'>
                <p className='truncate text-sm font-medium text-white'>
                  {streak.playerName}
                </p>
                <p className='text-xs text-white/50'>{streak.description}</p>
              </div>
              <div
                className={`flex items-center gap-1 text-xs font-bold ${
                  streak.type === 'hot' ? 'text-orange-400' : 'text-blue-400'
                }`}
              >
                {streak.type === 'hot' ? (
                  <TrendingUp className='h-3 w-3' />
                ) : (
                  <TrendingDown className='h-3 w-3' />
                )}
                {streak.streakLength}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { GameweekPerformance } from '@/interfaces/players';

interface FormGuideProps {
  performances: GameweekPerformance[];
  playerNames: Record<number, string>;
}

const RANK_COLORS: Record<number, string> = {
  1: 'bg-yellow-400 text-[#1a0520]',
  2: 'bg-gray-300 text-[#1a0520]',
  3: 'bg-amber-500 text-[#1a0520]',
  4: 'bg-blue-400 text-white',
  5: 'bg-green-400 text-[#1a0520]',
  6: 'bg-orange-400 text-[#1a0520]',
  7: 'bg-purple-400 text-white',
  8: 'bg-red-400 text-white',
};

export function FormGuide({ performances, playerNames }: FormGuideProps) {
  // Group by player, sort by event, take last 5
  const byPlayer: Record<number, GameweekPerformance[]> = {};
  performances.forEach((p) => {
    if (!byPlayer[p.league_entry]) byPlayer[p.league_entry] = [];
    byPlayer[p.league_entry].push(p);
  });

  Object.values(byPlayer).forEach((arr) =>
    arr.sort((a, b) => a.event - b.event),
  );

  const players = Object.entries(byPlayer)
    .map(([id, perf]) => {
      const last5 = perf.slice(-5);
      const avgRank =
        last5.reduce((sum, p) => sum + p.rank, 0) / (last5.length || 1);
      return {
        playerId: parseInt(id),
        playerName: playerNames[parseInt(id)] || `Player ${id}`,
        last5,
        avgRank,
      };
    })
    .sort((a, b) => a.avgRank - b.avgRank);

  return (
    <Card className='w-full border-white/10 bg-[#2a0d33]'>
      <CardHeader className='pb-2'>
        <CardTitle className='text-base text-white md:text-lg'>
          Form Guide
        </CardTitle>
        <p className='text-xs text-white/50'>Last 5 gameweeks</p>
      </CardHeader>
      <CardContent>
        <div className='space-y-2.5'>
          {players.map((player) => (
            <div key={player.playerId} className='flex items-center gap-3'>
              <span className='w-20 truncate text-xs font-medium text-white/70 md:w-24 md:text-sm'>
                {player.playerName}
              </span>
              <div className='flex flex-1 gap-1.5'>
                {player.last5.map((perf, i) => (
                  <div
                    key={i}
                    className={`flex h-8 flex-1 items-center justify-center rounded-md text-xs font-bold md:h-9 md:text-sm ${
                      RANK_COLORS[perf.rank] || 'bg-white/10 text-white'
                    }`}
                    title={`GW${perf.event}: Rank ${perf.rank} (${perf.event_total} pts)`}
                  >
                    {perf.rank}
                  </div>
                ))}
                {/* Pad with empty slots if less than 5 */}
                {Array.from({ length: 5 - player.last5.length }).map((_, i) => (
                  <div
                    key={`empty-${i}`}
                    className='flex h-8 flex-1 items-center justify-center rounded-md bg-white/5 text-xs text-white/20 md:h-9'
                  >
                    -
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

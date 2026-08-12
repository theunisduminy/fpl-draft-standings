'use client';
import { Trophy, ArrowDown, BarChart3 } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { PlayerDetails } from '@/interfaces/players';
import { Match } from '@/interfaces/match';

interface GameweekSummaryProps {
  gameweek: number;
  matches: Match[];
  players: PlayerDetails[];
}

export function GameweekSummaryCard({
  gameweek,
  matches,
  players,
}: GameweekSummaryProps) {
  const gameweekMatches = matches.filter(
    (m) => m.event === gameweek && m.finished,
  );

  if (gameweekMatches.length === 0) {
    return (
      <Card className='border-white/10 bg-[#2a0d33]'>
        <CardHeader className='pb-2'>
          <CardTitle className='text-base text-white md:text-lg'>
            Gameweek {gameweek} Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className='flex items-center justify-center p-8 text-center text-white/50'>
            <p className='text-sm'>
              No results available for this gameweek yet.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const playerScores: Record<number, number> = {};

  gameweekMatches.forEach((match) => {
    if (match.league_entry_1_points) {
      playerScores[match.league_entry_1] = match.league_entry_1_points;
    }
    if (match.league_entry_2_points) {
      playerScores[match.league_entry_2] = match.league_entry_2_points;
    }
  });

  const scores = Object.values(playerScores);
  const averageScore =
    scores.reduce((sum, score) => sum + score, 0) / scores.length;

  let highestScore = -1;
  let lowestScore = Infinity;
  let highestScoringPlayer: PlayerDetails | undefined;
  let lowestScoringPlayer: PlayerDetails | undefined;

  Object.entries(playerScores).forEach(([playerId, score]) => {
    const playerIdNumber = parseInt(playerId);
    const player = players.find((p) => p.id === playerIdNumber);

    if (score > highestScore && player) {
      highestScore = score;
      highestScoringPlayer = player;
    }

    if (score < lowestScore && player) {
      lowestScore = score;
      lowestScoringPlayer = player;
    }
  });

  return (
    <Card className='mb-6 border-white/10 bg-[#2a0d33]'>
      <CardHeader className='pb-2'>
        <CardTitle className='text-base text-white md:text-lg'>
          Gameweek {gameweek} Summary
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className='grid grid-cols-1 gap-3 md:grid-cols-3'>
          <div className='rounded-lg border border-white/10 bg-[#1a0520] p-4'>
            <div className='flex flex-col items-start gap-2'>
              <div className='flex items-center gap-2'>
                <BarChart3 className='h-5 w-5 text-[#00edfd]' />
                <p className='text-xs text-white/50'>Average Score</p>
              </div>
              <p className='text-lg font-bold text-white'>
                {averageScore.toFixed(1)}
              </p>
            </div>
          </div>

          {highestScoringPlayer && (
            <div className='rounded-lg border border-yellow-500/20 bg-[#1a0520] p-4'>
              <div className='flex flex-col items-start gap-2'>
                <div className='flex items-center gap-2'>
                  <Trophy className='h-5 w-5 text-yellow-400' />
                  <p className='text-xs text-white/50'>Top Performer</p>
                </div>
                <p className='text-sm font-bold text-white md:text-base'>
                  {highestScoringPlayer.player_name}{' '}
                  <span className='text-yellow-400'>({highestScore})</span>
                </p>
              </div>
            </div>
          )}

          {lowestScoringPlayer && (
            <div className='rounded-lg border border-red-500/20 bg-[#1a0520] p-4'>
              <div className='flex flex-col items-start gap-2'>
                <div className='flex items-center gap-2'>
                  <ArrowDown className='h-5 w-5 text-red-400' />
                  <p className='text-xs text-white/50'>Lowest Score</p>
                </div>
                <p className='text-sm font-bold text-white md:text-base'>
                  {lowestScoringPlayer.player_name}{' '}
                  <span className='text-red-400'>({lowestScore})</span>
                </p>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

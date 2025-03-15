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
  // Filter matches for the selected gameweek
  const gameweekMatches = matches.filter(
    (m) => m.event === gameweek && m.finished,
  );

  if (gameweekMatches.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Gameweek {gameweek} Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className='flex items-center justify-center p-8 text-center text-gray-200'>
            <p>No results available for this gameweek yet.</p>
          </div>
        </CardContent>
      </Card>
    );
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

  // Calculate average score
  const scores = Object.values(playerScores);
  const averageScore =
    scores.reduce((sum, score) => sum + score, 0) / scores.length;

  // Find highest and lowest scoring players
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
    <Card className='mb-6'>
      <CardHeader>
        <CardTitle>Gameweek {gameweek} Summary</CardTitle>
      </CardHeader>
      <CardContent>
        <div className='grid grid-cols-1 gap-4 md:grid-cols-3'>
          <div className='rounded-lg bg-ruddyBlue p-4'>
            <div className='flex flex-col items-start gap-2'>
              <div className='flex items-center gap-2'>
                <BarChart3 className='h-6 w-6 text-white' />
                <p className='text-sm text-gray-300'>Average Score</p>
              </div>
              <p className='text-xl font-medium text-white'>
                {averageScore.toFixed(1)}
              </p>
            </div>
          </div>

          {highestScoringPlayer && (
            <div className='rounded-lg bg-ruddyBlue p-4'>
              <div className='flex flex-col items-start gap-2'>
                <div className='flex items-center gap-2'>
                  <Trophy className='h-6 w-6 text-amber-400' />
                  <p className='text-sm text-gray-300'>Top Performer</p>
                </div>
                <p className='text-xl font-medium text-white'>
                  {highestScoringPlayer.player_name} ({highestScore})
                </p>
              </div>
            </div>
          )}

          {lowestScoringPlayer && (
            <div className='rounded-lg bg-ruddyBlue p-4'>
              <div className='flex flex-col items-start gap-2'>
                <div className='flex items-center gap-2'>
                  <ArrowDown className='h-6 w-6 text-red-400' />
                  <p className='text-sm text-gray-300'>Lowest Score</p>
                </div>
                <p className='text-xl font-medium text-white'>
                  {lowestScoringPlayer.player_name} ({lowestScore})
                </p>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

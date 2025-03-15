'use client';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { PlayerDetails } from '@/interfaces/players';
import { Match } from '@/interfaces/match';
import { ArrowLeft, ArrowRight } from 'lucide-react';

interface MatchOddsCardProps {
  gameweek: number;
  matches: Match[];
  players: PlayerDetails[];
  finishedMatches: Match[];
}

interface MatchupOdds {
  home: {
    id: number;
    name: string;
    winProbability: number;
    averageScore: number;
  };
  away: {
    id: number;
    name: string;
    winProbability: number;
    averageScore: number;
  };
}

export function MatchOddsCard({
  gameweek,
  matches,
  players,
  finishedMatches,
}: MatchOddsCardProps) {
  // Filter upcoming matches for the selected gameweek
  const upcomingMatches = matches.filter(
    (m) => m.event === gameweek && !m.finished,
  );

  if (upcomingMatches.length === 0) {
    return (
      <Card className='mt-6'>
        <CardHeader>
          <CardTitle>Match Predictions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className='flex items-center justify-center p-8 text-center text-gray-200'>
            <p>No upcoming matches found for this gameweek.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Calculate average score for each player
  const playerStats: Record<
    number,
    {
      totalPoints: number;
      matchesPlayed: number;
      wins: number;
      losses: number;
      draws: number;
    }
  > = {};

  // Initialize stats for all players
  players.forEach((player) => {
    playerStats[player.id] = {
      totalPoints: 0,
      matchesPlayed: 0,
      wins: 0,
      losses: 0,
      draws: 0,
    };
  });

  // Calculate stats from finished matches
  finishedMatches.forEach((match) => {
    if (!match.finished) return;

    const home = playerStats[match.league_entry_1];
    const away = playerStats[match.league_entry_2];

    if (home) {
      home.totalPoints += match.league_entry_1_points;
      home.matchesPlayed += 1;
    }

    if (away) {
      away.totalPoints += match.league_entry_2_points;
      away.matchesPlayed += 1;
    }

    // Record win/loss/draw
    if (match.league_entry_1_points > match.league_entry_2_points) {
      if (home) home.wins += 1;
      if (away) away.losses += 1;
    } else if (match.league_entry_1_points < match.league_entry_2_points) {
      if (home) home.losses += 1;
      if (away) away.wins += 1;
    } else {
      if (home) home.draws += 1;
      if (away) away.draws += 1;
    }
  });

  // Calculate head-to-head records
  const h2hRecords: Record<
    string,
    { homeWins: number; awayWins: number; draws: number }
  > = {};

  finishedMatches.forEach((match) => {
    if (!match.finished) return;

    const matchupKey = `${match.league_entry_1}-${match.league_entry_2}`;
    const reverseMatchupKey = `${match.league_entry_2}-${match.league_entry_1}`;

    if (!h2hRecords[matchupKey] && !h2hRecords[reverseMatchupKey]) {
      h2hRecords[matchupKey] = { homeWins: 0, awayWins: 0, draws: 0 };
    }

    const record = h2hRecords[matchupKey] || h2hRecords[reverseMatchupKey];

    if (match.league_entry_1_points > match.league_entry_2_points) {
      record.homeWins += 1;
    } else if (match.league_entry_1_points < match.league_entry_2_points) {
      record.awayWins += 1;
    } else {
      record.draws += 1;
    }
  });

  // Calculate odds for upcoming matches
  const matchOdds: MatchupOdds[] = upcomingMatches.map((match) => {
    const homePlayer = players.find((p) => p.id === match.league_entry_1);
    const awayPlayer = players.find((p) => p.id === match.league_entry_2);

    const homeStats = playerStats[match.league_entry_1] || {
      totalPoints: 0,
      matchesPlayed: 1,
      wins: 0,
      losses: 0,
      draws: 0,
    };
    const awayStats = playerStats[match.league_entry_2] || {
      totalPoints: 0,
      matchesPlayed: 1,
      wins: 0,
      losses: 0,
      draws: 0,
    };

    // Calculate average scores
    const homeAvg =
      homeStats.matchesPlayed > 0
        ? homeStats.totalPoints / homeStats.matchesPlayed
        : 0;
    const awayAvg =
      awayStats.matchesPlayed > 0
        ? awayStats.totalPoints / awayStats.matchesPlayed
        : 0;

    // Calculate win percentages
    const homeTotalMatches =
      homeStats.wins + homeStats.losses + homeStats.draws;
    const awayTotalMatches =
      awayStats.wins + awayStats.losses + awayStats.draws;

    const homeWinPct =
      homeTotalMatches > 0 ? (homeStats.wins / homeTotalMatches) * 100 : 50;
    const awayWinPct =
      awayTotalMatches > 0 ? (awayStats.wins / awayTotalMatches) * 100 : 50;

    // Check head-to-head record
    const matchupKey = `${match.league_entry_1}-${match.league_entry_2}`;
    const reverseMatchupKey = `${match.league_entry_2}-${match.league_entry_1}`;
    const h2hRecord = h2hRecords[matchupKey] ||
      h2hRecords[reverseMatchupKey] || {
        homeWins: 0,
        awayWins: 0,
        draws: 0,
      };

    // Factor in head-to-head record
    const totalH2H = h2hRecord.homeWins + h2hRecord.awayWins + h2hRecord.draws;
    const h2hFactor = totalH2H > 0 ? 0.3 : 0; // Weight H2H more if they've played before

    let homeH2HPct = 50;
    let awayH2HPct = 50;

    if (totalH2H > 0) {
      homeH2HPct = (h2hRecord.homeWins / totalH2H) * 100;
      awayH2HPct = (h2hRecord.awayWins / totalH2H) * 100;
    }

    // Calculate overall probability (weighted combination of season performance and H2H)
    // 60% based on season form, 30% based on head-to-head if they've played before, 10% random factor
    const avgFactor = 0.6;
    const randomFactor = 0.1;

    // Combine factors: Form (Average points compared to opponent) + Win % + H2H record + Random factor
    // First normalize the average points to percentages
    const totalAvg = homeAvg + awayAvg;
    const homeAvgPct = totalAvg > 0 ? (homeAvg / totalAvg) * 100 : 50;
    const awayAvgPct = totalAvg > 0 ? (awayAvg / totalAvg) * 100 : 50;

    // Calculate combined probability
    const homeProb =
      (homeAvgPct * 0.4 +
        homeWinPct * 0.2 +
        homeH2HPct * h2hFactor +
        Math.random() * 10 * randomFactor) /
      (avgFactor + h2hFactor + randomFactor);

    const awayProb =
      (awayAvgPct * 0.4 +
        awayWinPct * 0.2 +
        awayH2HPct * h2hFactor +
        Math.random() * 10 * randomFactor) /
      (avgFactor + h2hFactor + randomFactor);

    // Normalize to ensure they sum to 100%
    const totalProb = homeProb + awayProb;
    const normalizedHomeProb = (homeProb / totalProb) * 100;
    const normalizedAwayProb = (awayProb / totalProb) * 100;

    return {
      home: {
        id: match.league_entry_1,
        name: homePlayer?.player_name || `Player ${match.league_entry_1}`,
        winProbability: normalizedHomeProb,
        averageScore: homeAvg,
      },
      away: {
        id: match.league_entry_2,
        name: awayPlayer?.player_name || `Player ${match.league_entry_2}`,
        winProbability: normalizedAwayProb,
        averageScore: awayAvg,
      },
    };
  });

  return (
    <Card className='mt-6'>
      <CardHeader>
        <CardTitle>Match Predictions</CardTitle>
      </CardHeader>
      <CardContent>
        <div className='space-y-6'>
          {matchOdds.map((matchup, index) => (
            <div
              key={index}
              className='overflow-hidden rounded-lg border border-gray-700 bg-blue-500'
            >
              <div className='bg-blue-600 p-3 text-center font-medium text-white'>
                {matchup.home.name} vs {matchup.away.name}
              </div>

              <div className='grid grid-cols-1 gap-3 p-4 md:grid-cols-2'>
                {/* Home player */}
                <div className='rounded-lg bg-blue-400 p-4'>
                  <div className='flex items-center justify-between'>
                    <div>
                      <p className='font-medium text-white'>
                        {matchup.home.name}
                      </p>
                      <p className='text-sm text-gray-200'>
                        Avg: {matchup.home.averageScore.toFixed(1)} pts
                      </p>
                    </div>
                    <div className='flex h-14 w-14 items-center justify-center rounded-full bg-blue-500 text-xl font-bold text-white'>
                      {matchup.home.winProbability.toFixed(0)}%
                    </div>
                  </div>

                  <div className='mt-3 h-2 w-full overflow-hidden rounded-full bg-blue-600'>
                    <div
                      className='h-full bg-premGreen'
                      style={{ width: `${matchup.home.winProbability}%` }}
                    ></div>
                  </div>
                </div>

                {/* Away player */}
                <div className='rounded-lg bg-blue-400 p-4'>
                  <div className='flex items-center justify-between'>
                    <div>
                      <p className='font-medium text-white'>
                        {matchup.away.name}
                      </p>
                      <p className='text-sm text-gray-200'>
                        Avg: {matchup.away.averageScore.toFixed(1)} pts
                      </p>
                    </div>
                    <div className='flex h-14 w-14 items-center justify-center rounded-full bg-blue-500 text-xl font-bold text-white'>
                      {matchup.away.winProbability.toFixed(0)}%
                    </div>
                  </div>

                  <div className='mt-3 h-2 w-full overflow-hidden rounded-full bg-blue-600'>
                    <div
                      className='h-full bg-premTurquoise'
                      style={{ width: `${matchup.away.winProbability}%` }}
                    ></div>
                  </div>
                </div>
              </div>

              <div className='hidden items-center justify-center bg-blue-500 p-2 md:flex'>
                {matchup.home.winProbability > matchup.away.winProbability ? (
                  <div className='flex items-center text-sm text-white'>
                    <ArrowLeft className='mr-1 h-4 w-4' />
                    Favoured to win
                  </div>
                ) : (
                  <div className='flex items-center text-sm text-white'>
                    Favoured to win
                    <ArrowRight className='ml-1 h-4 w-4' />
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

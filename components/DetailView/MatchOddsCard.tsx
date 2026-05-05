'use client';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { PlayerDetails } from '@/interfaces/players';
import { Match } from '@/interfaces/match';
import { ArrowLeft, ArrowRight, Swords } from 'lucide-react';

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
  const upcomingMatches = matches.filter(
    (m) => m.event === gameweek && !m.finished,
  );

  if (upcomingMatches.length === 0) {
    return (
      <Card className='mt-6 border-white/10 bg-[#2a0d33]'>
        <CardHeader className='pb-2'>
          <CardTitle className='text-base text-white md:text-lg'>
            Match Predictions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className='flex items-center justify-center p-8 text-center text-white/50'>
            <p className='text-sm'>
              No upcoming matches found for this gameweek.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

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

  players.forEach((player) => {
    playerStats[player.id] = {
      totalPoints: 0,
      matchesPlayed: 0,
      wins: 0,
      losses: 0,
      draws: 0,
    };
  });

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

    const homeAvg =
      homeStats.matchesPlayed > 0
        ? homeStats.totalPoints / homeStats.matchesPlayed
        : 0;
    const awayAvg =
      awayStats.matchesPlayed > 0
        ? awayStats.totalPoints / awayStats.matchesPlayed
        : 0;

    const homeTotalMatches =
      homeStats.wins + homeStats.losses + homeStats.draws;
    const awayTotalMatches =
      awayStats.wins + awayStats.losses + awayStats.draws;

    const homeWinPct =
      homeTotalMatches > 0 ? (homeStats.wins / homeTotalMatches) * 100 : 50;
    const awayWinPct =
      awayTotalMatches > 0 ? (awayStats.wins / awayTotalMatches) * 100 : 50;

    const matchupKey = `${match.league_entry_1}-${match.league_entry_2}`;
    const reverseMatchupKey = `${match.league_entry_2}-${match.league_entry_1}`;
    const h2hRecord = h2hRecords[matchupKey] ||
      h2hRecords[reverseMatchupKey] || {
        homeWins: 0,
        awayWins: 0,
        draws: 0,
      };

    const totalH2H = h2hRecord.homeWins + h2hRecord.awayWins + h2hRecord.draws;
    const h2hFactor = totalH2H > 0 ? 0.3 : 0;

    let homeH2HPct = 50;
    let awayH2HPct = 50;

    if (totalH2H > 0) {
      homeH2HPct = (h2hRecord.homeWins / totalH2H) * 100;
      awayH2HPct = (h2hRecord.awayWins / totalH2H) * 100;
    }

    const avgFactor = 0.6;
    const randomFactor = 0.1;
    const totalAvg = homeAvg + awayAvg;
    const homeAvgPct = totalAvg > 0 ? (homeAvg / totalAvg) * 100 : 50;
    const awayAvgPct = totalAvg > 0 ? (awayAvg / totalAvg) * 100 : 50;

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
    <Card className='mt-6 border-white/10 bg-[#2a0d33]'>
      <CardHeader className='pb-2'>
        <CardTitle className='text-base text-white md:text-lg'>
          Match Predictions
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className='space-y-4'>
          {matchOdds.map((matchup, index) => (
            <div
              key={index}
              className='overflow-hidden rounded-xl border border-white/10 bg-[#1a0520]'
            >
              <div className='flex items-center justify-center gap-2 bg-[#2a0d33] p-3 text-sm font-medium text-white'>
                <Swords className='h-4 w-4 text-white/50' />
                {matchup.home.name} vs {matchup.away.name}
              </div>

              <div className='grid grid-cols-1 gap-3 p-3 md:grid-cols-2'>
                {/* Home player */}
                <div className='rounded-lg border border-white/5 bg-[#2a0d33] p-3'>
                  <div className='mb-2 flex items-center justify-between'>
                    <div>
                      <p className='text-sm font-medium text-white'>
                        {matchup.home.name}
                      </p>
                      <p className='text-xs text-white/50'>
                        Avg: {matchup.home.averageScore.toFixed(1)} pts
                      </p>
                    </div>
                    <div className='flex h-12 w-12 items-center justify-center rounded-full bg-[#75fa95]/10 text-lg font-bold text-[#75fa95]'>
                      {matchup.home.winProbability.toFixed(0)}%
                    </div>
                  </div>
                  <Progress
                    value={matchup.home.winProbability}
                    className='h-1.5 bg-white/10'
                  />
                </div>

                {/* Away player */}
                <div className='rounded-lg border border-white/5 bg-[#2a0d33] p-3'>
                  <div className='mb-2 flex items-center justify-between'>
                    <div>
                      <p className='text-sm font-medium text-white'>
                        {matchup.away.name}
                      </p>
                      <p className='text-xs text-white/50'>
                        Avg: {matchup.away.averageScore.toFixed(1)} pts
                      </p>
                    </div>
                    <div className='flex h-12 w-12 items-center justify-center rounded-full bg-[#00edfd]/10 text-lg font-bold text-[#00edfd]'>
                      {matchup.away.winProbability.toFixed(0)}%
                    </div>
                  </div>
                  <Progress
                    value={matchup.away.winProbability}
                    className='h-1.5 bg-white/10'
                  />
                </div>
              </div>

              <div className='flex items-center justify-center bg-[#2a0d33] px-2 pb-3'>
                {matchup.home.winProbability > matchup.away.winProbability ? (
                  <div className='flex items-center text-xs text-white/60'>
                    <ArrowLeft className='mr-1 h-3 w-3 text-[#75fa95]' />
                    {matchup.home.name} is favoured
                  </div>
                ) : (
                  <div className='flex items-center text-xs text-white/60'>
                    {matchup.away.name} is favoured
                    <ArrowRight className='ml-1 h-3 w-3 text-[#00edfd]' />
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

'use client';
import React, { useState, useEffect } from 'react';
import { PlayerDetails } from '@/interfaces/players';
import { Match } from '@/interfaces/match';
import { fetchWithDelay } from '@/utils/fetchWithDelay';
import { SkeletonCard } from '@/components/SkeletonTable';
import { ErrorDisplay } from '@/components/ErrorDisplay';
import { GameweekSelector } from '@/components/GameweekSelector';
import { GameweekSummaryCard } from '@/components/DetailView/GameweekSummaryCard';
import { GameweekScoreChart } from '@/components/DetailView/GameweekScoreChart';
import { tableGradient } from '@/utils/tailwindVars';
export default function DraftResultsTable() {
  const [standings, setStandings] = useState<PlayerDetails[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [gameweeks, setGameweeks] = useState<number[]>([]);
  const [selectedGameweek, setSelectedGameweek] = useState<number>(0);

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        const [standingsData, matchesData] = (await fetchWithDelay([
          'standings',
          'matches',
        ])) as [PlayerDetails[], Match[]];

        setStandings(standingsData);
        setMatches(matchesData);

        // Extract all completed gameweeks
        const completedGameweeks = Array.from(
          new Set(
            matchesData
              .filter((match) => match.finished)
              .map((match) => match.event),
          ),
        ).sort((a, b) => b - a); // Sort in descending order (latest first)

        setGameweeks(completedGameweeks);

        // Set the default selected gameweek to the most recent one
        if (completedGameweeks.length > 0) {
          setSelectedGameweek(completedGameweeks[0]);
        }

        setError(null);
      } catch (err) {
        setError('Failed to load data. Please try again later.');
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  const handleRetry = () => {
    setLoading(true);
    setError(null);
    fetchWithDelay(['standings', 'matches'])
      .then((data: unknown) => {
        const [standingsData, matchesData] = data as [PlayerDetails[], Match[]];
        setStandings(standingsData);
        setMatches(matchesData);

        const completedGameweeks = Array.from(
          new Set(
            matchesData
              .filter((match: Match) => match.finished)
              .map((match: Match) => match.event),
          ),
        ).sort((a: number, b: number) => b - a);

        setGameweeks(completedGameweeks);

        if (completedGameweeks.length > 0) {
          setSelectedGameweek(completedGameweeks[0]);
        }
      })
      .catch((err) => {
        setError('Failed to load data. Please try again later.');
        console.error(err);
      })
      .finally(() => {
        setLoading(false);
      });
  };

  if (loading) return <SkeletonCard />;
  if (error) return <ErrorDisplay message={error} onRetry={handleRetry} />;
  if (gameweeks.length === 0) {
    return (
      <div className='flex w-[350px] flex-col md:w-[600px]'>
        <h1 className='pb-2 text-xl font-semibold text-[#310639]'>
          ⚔️ Head-to-Head Results
        </h1>
        <p className='pb-5 text-sm'>No results available yet.</p>
      </div>
    );
  }

  // Filter matches for the selected gameweek
  const gameweekMatches = matches.filter(
    (match) => match.event === selectedGameweek && match.finished,
  );

  const formattedMatches = gameweekMatches.map((match) => {
    const homePlayer = standings.find(
      (player) => player.id === match.league_entry_1,
    );
    const awayPlayer = standings.find(
      (player) => player.id === match.league_entry_2,
    );

    return {
      home_player_name: homePlayer ? homePlayer.player_name : 'Unknown',
      away_player_name: awayPlayer ? awayPlayer.player_name : 'Unknown',
      home_player_points: match.league_entry_1_points,
      away_player_points: match.league_entry_2_points,
      home_wins: match.league_entry_1_points > match.league_entry_2_points,
      away_wins: match.league_entry_2_points > match.league_entry_1_points,
    };
  });

  return (
    <div className='flex w-[350px] flex-col md:w-[600px]'>
      <h1 className='pb-2 text-xl font-semibold text-[#310639]'>
        ⚔️ Head-to-Head Results
      </h1>
      <p className='pb-5 text-sm'>
        Previous gameweeks head-to-head results for the Draft league.
      </p>

      <GameweekSelector
        gameweeks={gameweeks}
        selectedGameweek={selectedGameweek}
        onSelectGameweek={setSelectedGameweek}
        label='Select Gameweek'
      />

      <div className='mt-6 space-y-6'>
        {/* Gameweek Summary Card */}
        <GameweekSummaryCard
          gameweek={selectedGameweek}
          matches={matches}
          players={standings}
        />

        {/* Results Table */}
        <div
          className={`rounded-lg border-2 border-black ${tableGradient} p-6 shadow-2xl`}
        >
          <h2 className='pb-3 text-xl font-medium text-white'>
            Gameweek {selectedGameweek} Results
          </h2>
          <table className='w-full text-sm font-light text-white'>
            <thead>
              <tr className='border-b-2 border-white'>
                <th className='py-2 font-medium'>Home</th>
                <th></th>
                <th className='py-2 font-medium'>Away</th>
              </tr>
            </thead>
            <tbody>
              {formattedMatches.map((match, index) => (
                <tr
                  key={index}
                  className={index % 2 === 0 ? '' : 'bg-ruddyBlue'}
                >
                  <td
                    className={`py-4 ${match.home_wins ? 'font-bold text-yellow-300' : ''}`}
                  >{`${match.home_player_name} (${match.home_player_points})`}</td>
                  <td className='py-4'>vs.</td>
                  <td
                    className={`py-4 ${match.away_wins ? 'font-bold text-yellow-300' : ''}`}
                  >{`${match.away_player_name} (${match.away_player_points})`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Score Chart */}
        <GameweekScoreChart
          gameweek={selectedGameweek}
          matches={matches}
          players={standings}
        />
      </div>
    </div>
  );
}

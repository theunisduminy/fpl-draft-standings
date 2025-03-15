'use client';
import React, { useState, useEffect } from 'react';
import { PlayerDetails } from '@/interfaces/players';
import { Match } from '@/interfaces/match';
import { fetchWithDelay } from '@/utils/fetchWithDelay';
import { SkeletonCard } from '@/components/SkeletonTable';
import { ErrorDisplay } from '@/components/ErrorDisplay';
import { GameweekSelector } from '@/components/GameweekSelector';
import { MatchOddsCard } from '@/components/DetailView/MatchOddsCard';
import { tableGradient } from '@/utils/tailwindVars';

export default function DraftFixturesTable() {
  const [standings, setStandings] = useState<PlayerDetails[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [futureGameweeks, setFutureGameweeks] = useState<number[]>([]);
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

        // Extract all upcoming gameweeks
        const upcoming = Array.from(
          new Set(
            matchesData
              .filter((match) => !match.finished)
              .map((match) => match.event),
          ),
        ).sort((a, b) => a - b); // Sort in ascending order (earliest first)

        setFutureGameweeks(upcoming);

        // Set the default selected gameweek to the next upcoming one
        if (upcoming.length > 0) {
          setSelectedGameweek(upcoming[0]);
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

        const upcoming = Array.from(
          new Set(
            matchesData
              .filter((match: Match) => !match.finished)
              .map((match: Match) => match.event),
          ),
        ).sort((a: number, b: number) => a - b);

        setFutureGameweeks(upcoming);

        if (upcoming.length > 0) {
          setSelectedGameweek(upcoming[0]);
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
  if (futureGameweeks.length === 0) {
    return (
      <div className='flex w-[350px] flex-col md:w-[600px]'>
        <h1 className='pb-2 text-xl font-semibold text-[#310639]'>
          🏟️ Upcoming Fixtures
        </h1>
        <p className='pb-5 text-sm'>No upcoming fixtures available.</p>
      </div>
    );
  }

  // Filter matches for the selected gameweek
  const gameweekMatches = matches.filter(
    (match) => match.event === selectedGameweek && !match.finished,
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
    };
  });

  // Get all finished matches for prediction calculations
  const finishedMatches = matches.filter((match) => match.finished);

  return (
    <div className='flex w-[350px] flex-col md:w-[600px]'>
      <h1 className='pb-2 text-xl font-semibold text-[#310639]'>
        🏟️ Upcoming Fixtures
      </h1>
      <p className='pb-5 text-sm'>
        Upcoming head-to-head fixtures in the Draft league.
      </p>

      <GameweekSelector
        gameweeks={futureGameweeks}
        selectedGameweek={selectedGameweek}
        onSelectGameweek={setSelectedGameweek}
        label='Select Gameweek'
      />

      <div className='mt-6 space-y-6'>
        {/* Fixtures Table */}
        <div
          className={`w-full rounded-lg border-2 border-black ${tableGradient} p-6 shadow-2xl`}
        >
          <h2 className='pb-3 text-xl font-medium text-white'>
            Gameweek {selectedGameweek} Fixtures
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
                  <td className='py-4'>{match.home_player_name}</td>
                  <td className='py-4'>vs.</td>
                  <td className='py-4'>{match.away_player_name}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Match Odds Card */}
        <MatchOddsCard
          gameweek={selectedGameweek}
          matches={matches}
          players={standings}
          finishedMatches={finishedMatches}
        />
      </div>
    </div>
  );
}

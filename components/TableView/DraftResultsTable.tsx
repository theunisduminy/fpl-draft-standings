'use client';
import React, { useState, useEffect } from 'react';
import { PlayerDetails } from '@/interfaces/players';
import { fetchWithDelay } from '@/utils/fetchWithDelay';
import { SkeletonCard } from '@/components/SkeletonTable';
import { ErrorDisplay } from '@/components/ErrorDisplay';
import { GameweekSelector } from '@/components/GameweekSelector';
import { tableGradient } from '@/utils/tailwindVars';

// Interface for gameweek performance data (matching the updated matches API)
interface GameweekPerformance {
  event: number;
  league_entry: number;
  event_total: number;
  rank: number;
  finished: boolean;
}
export default function DraftResultsTable() {
  const [standings, setStandings] = useState<PlayerDetails[]>([]);
  const [gameweekData, setGameweekData] = useState<GameweekPerformance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [gameweeks, setGameweeks] = useState<number[]>([]);
  const [selectedGameweek, setSelectedGameweek] = useState<number>(0);

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        const [standingsData, gameweekPerformanceData] = (await fetchWithDelay([
          'standings',
          'matches', // This now returns gameweek performance data
        ])) as [PlayerDetails[], GameweekPerformance[]];

        setStandings(standingsData);
        setGameweekData(gameweekPerformanceData);

        // Extract all completed gameweeks
        const completedGameweeks = Array.from(
          new Set(
            gameweekPerformanceData
              .filter((gw) => gw.finished)
              .map((gw) => gw.event),
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
        const [standingsData, gameweekPerformanceData] = data as [
          PlayerDetails[],
          GameweekPerformance[],
        ];
        setStandings(standingsData);
        setGameweekData(gameweekPerformanceData);

        const completedGameweeks = Array.from(
          new Set(
            gameweekPerformanceData
              .filter((gw: GameweekPerformance) => gw.finished)
              .map((gw: GameweekPerformance) => gw.event),
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
          📊 Gameweek Results
        </h1>
        <p className='pb-5 text-sm'>No gameweek results available yet.</p>
      </div>
    );
  }

  // Filter gameweek data for the selected gameweek and sort by rank
  const gameweekResults = gameweekData
    .filter((gw) => gw.event === selectedGameweek && gw.finished)
    .sort((a, b) => a.rank - b.rank);

  // Create formatted results with player names
  const formattedResults = gameweekResults.map((gw) => {
    const player = standings.find((p) => p.id === gw.league_entry);
    return {
      rank: gw.rank,
      player_name: player ? player.player_name : 'Unknown',
      team_name: player ? player.team_name : 'Unknown',
      points: gw.event_total,
      league_entry: gw.league_entry,
    };
  });

  return (
    <div className='flex w-[350px] flex-col md:w-[600px]'>
      <h1 className='pb-2 text-xl font-semibold text-[#310639]'>
        📊 Gameweek Results
      </h1>
      <p className='pb-5 text-sm'>
        Previous gameweek rankings and points for the Draft league.
      </p>

      <GameweekSelector
        gameweeks={gameweeks}
        selectedGameweek={selectedGameweek}
        onSelectGameweek={setSelectedGameweek}
        label='Select Gameweek'
      />

      <div className='mt-6 space-y-6'>
        {/* Results Table */}
        <div
          className={`rounded-lg border-2 border-black ${tableGradient} p-6 shadow-2xl`}
        >
          <h2 className='pb-3 text-xl font-medium text-white'>
            Gameweek {selectedGameweek} Rankings
          </h2>
          <table className='w-full text-sm font-light text-white'>
            <thead>
              <tr className='border-b-2 border-white'>
                <th className='py-2 text-left font-medium'>Rank</th>
                <th className='py-2 text-left font-medium'>Player</th>
                <th className='py-2 text-left font-medium'>Team</th>
                <th className='py-2 text-right font-medium'>Points</th>
              </tr>
            </thead>
            <tbody>
              {formattedResults.map((result, index) => (
                <tr
                  key={result.league_entry}
                  className={index % 2 === 0 ? '' : 'bg-ruddyBlue'}
                >
                  <td className='py-4'>
                    <span
                      className={`inline-flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${
                        result.rank === 1
                          ? 'bg-yellow-400 text-black'
                          : result.rank === 2
                            ? 'bg-gray-300 text-black'
                            : result.rank === 3
                              ? 'bg-amber-600 text-white'
                              : result.rank === 8
                                ? 'bg-red-600 text-white'
                                : 'bg-gray-600 text-white'
                      }`}
                    >
                      {result.rank}
                    </span>
                  </td>
                  <td className='py-4 font-medium'>{result.player_name}</td>
                  <td className='py-4 text-gray-300'>{result.team_name}</td>
                  <td className='py-4 text-right'>
                    <span
                      className={`font-bold ${
                        result.rank === 1
                          ? 'text-yellow-300'
                          : result.rank === 8
                            ? 'text-red-300'
                            : 'text-white'
                      }`}
                    >
                      {result.points}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Summary Stats */}
        {formattedResults.length > 0 && (
          <div
            className={`rounded-lg border-2 border-black ${tableGradient} p-6 shadow-2xl`}
          >
            <h3 className='pb-3 text-lg font-medium text-white'>
              Gameweek {selectedGameweek} Summary
            </h3>
            <div className='grid grid-cols-2 gap-4 text-white'>
              <div>
                <p className='text-sm text-gray-300'>Highest Score</p>
                <p className='text-lg font-bold text-yellow-300'>
                  {formattedResults[0]?.points} pts (
                  {formattedResults[0]?.player_name})
                </p>
              </div>
              <div>
                <p className='text-sm text-gray-300'>Lowest Score</p>
                <p className='text-lg font-bold text-red-300'>
                  {formattedResults[formattedResults.length - 1]?.points} pts (
                  {formattedResults[formattedResults.length - 1]?.player_name})
                </p>
              </div>
              <div>
                <p className='text-sm text-gray-300'>Average Score</p>
                <p className='text-lg font-bold'>
                  {(
                    formattedResults.reduce((sum, r) => sum + r.points, 0) /
                    formattedResults.length
                  ).toFixed(1)}{' '}
                  pts
                </p>
              </div>
              <div>
                <p className='text-sm text-gray-300'>Point Difference</p>
                <p className='text-lg font-bold'>
                  {formattedResults[0]?.points -
                    formattedResults[formattedResults.length - 1]?.points}{' '}
                  pts
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

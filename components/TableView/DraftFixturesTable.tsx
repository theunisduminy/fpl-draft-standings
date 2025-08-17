'use client';
import React, { useState, useEffect } from 'react';
import { PlayerDetails } from '@/interfaces/players';
import { fetchWithDelay } from '@/utils/fetchWithDelay';
import { SkeletonCard } from '@/components/SkeletonTable';
import { ErrorDisplay } from '@/components/ErrorDisplay';
import { tableGradient } from '@/utils/tailwindVars';

// Interface for gameweek performance data (matching the updated matches API)
interface GameweekPerformance {
  event: number;
  league_entry: number;
  event_total: number;
  rank: number;
  finished: boolean;
}

export default function DraftFixturesTable() {
  const [standings, setStandings] = useState<PlayerDetails[]>([]);
  const [gameweekData, setGameweekData] = useState<GameweekPerformance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentGameweek, setCurrentGameweek] = useState<number>(0);

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

        // Get the current/next gameweek
        const completedGameweeks = gameweekPerformanceData
          .filter((gw) => gw.finished)
          .map((gw) => gw.event);
        const maxCompletedGameweek = completedGameweeks.length > 0 
          ? Math.max(...completedGameweeks) 
          : 0;
        
        setCurrentGameweek(maxCompletedGameweek + 1);
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

        const completedGameweeks = gameweekPerformanceData
          .filter((gw: GameweekPerformance) => gw.finished)
          .map((gw: GameweekPerformance) => gw.event);
        const maxCompletedGameweek = completedGameweeks.length > 0 
          ? Math.max(...completedGameweeks) 
          : 0;
        
        setCurrentGameweek(maxCompletedGameweek + 1);
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

  // Sort standings by current total points
  const currentStandings = standings.slice().sort((a, b) => {
    return (b.total_points || 0) - (a.total_points || 0);
  });

  // Calculate recent form (last 3 gameweeks if available)
  const recentForm = currentStandings.map(player => {
    const playerGameweeks = gameweekData
      .filter(gw => gw.league_entry === player.id && gw.finished)
      .sort((a, b) => b.event - a.event)
      .slice(0, 3); // Last 3 gameweeks
    
    const averageRecentPoints = playerGameweeks.length > 0
      ? playerGameweeks.reduce((sum, gw) => sum + gw.event_total, 0) / playerGameweeks.length
      : 0;
    
    return {
      ...player,
      recentForm: averageRecentPoints,
      recentGameweeks: playerGameweeks.length,
    };
  });

  return (
    <div className='flex w-[350px] flex-col md:w-[600px]'>
      <h1 className='pb-2 text-xl font-semibold text-[#310639]'>
        📅 Upcoming Gameweek
      </h1>
      <p className='pb-5 text-sm'>
        Current standings and form ahead of Gameweek {currentGameweek}.
      </p>

      <div className='mt-6 space-y-6'>
        {/* Current Standings Table */}
        <div
          className={`rounded-lg border-2 border-black ${tableGradient} p-6 shadow-2xl`}
        >
          <h2 className='pb-3 text-xl font-medium text-white'>
            Current Standings (Going into GW {currentGameweek})
          </h2>
          <table className='w-full text-sm font-light text-white'>
            <thead>
              <tr className='border-b-2 border-white'>
                <th className='py-2 text-left font-medium'>Pos</th>
                <th className='py-2 text-left font-medium'>Player</th>
                <th className='py-2 text-left font-medium'>Team</th>
                <th className='py-2 text-right font-medium'>Total Pts</th>
                <th className='py-2 text-right font-medium'>Recent Form</th>
              </tr>
            </thead>
            <tbody>
              {recentForm.map((player, index) => (
                <tr
                  key={player.id}
                  className={index % 2 === 0 ? '' : 'bg-ruddyBlue'}
                >
                  <td className='py-4'>
                    <span
                      className={`inline-flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${
                        index === 0
                          ? 'bg-yellow-400 text-black'
                          : index === 1
                          ? 'bg-gray-300 text-black'
                          : index === 2
                          ? 'bg-amber-600 text-white'
                          : 'bg-gray-600 text-white'
                      }`}
                    >
                      {index + 1}
                    </span>
                  </td>
                  <td className='py-4 font-medium'>{player.player_name}</td>
                  <td className='py-4 text-gray-300'>{player.team_name}</td>
                  <td className='py-4 text-right'>
                    <span className='font-bold text-white'>
                      {player.total_points || 0}
                    </span>
                  </td>
                  <td className='py-4 text-right'>
                    <span
                      className={`font-bold ${
                        player.recentForm >= 15
                          ? 'text-green-300'
                          : player.recentForm >= 10
                          ? 'text-yellow-300'
                          : 'text-red-300'
                      }`}
                    >
                      {player.recentForm.toFixed(1)}
                      <span className='text-xs text-gray-400 ml-1'>
                        ({player.recentGameweeks}GW)
                      </span>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Gameweek Preview */}
        <div
          className={`rounded-lg border-2 border-black ${tableGradient} p-6 shadow-2xl`}
        >
          <h3 className='pb-3 text-lg font-medium text-white'>
            Gameweek {currentGameweek} Preview
          </h3>
          <div className='grid grid-cols-1 gap-4 text-white md:grid-cols-2'>
            <div>
              <p className='text-sm text-gray-300'>Current Leader</p>
              <p className='text-lg font-bold text-yellow-300'>
                {recentForm[0]?.player_name} ({recentForm[0]?.total_points || 0} pts)
              </p>
            </div>
            <div>
              <p className='text-sm text-gray-300'>Best Recent Form</p>
              <p className='text-lg font-bold text-green-300'>
                {recentForm.sort((a, b) => b.recentForm - a.recentForm)[0]?.player_name} 
                ({recentForm.sort((a, b) => b.recentForm - a.recentForm)[0]?.recentForm.toFixed(1)} avg)
              </p>
            </div>
            <div>
              <p className='text-sm text-gray-300'>Points Gap (1st to Last)</p>
              <p className='text-lg font-bold'>
                {(recentForm[0]?.total_points || 0) - (recentForm[recentForm.length - 1]?.total_points || 0)} pts
              </p>
            </div>
            <div>
              <p className='text-sm text-gray-300'>Average Points</p>
              <p className='text-lg font-bold'>
                {(recentForm.reduce((sum, p) => sum + (p.total_points || 0), 0) / recentForm.length).toFixed(1)} pts
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
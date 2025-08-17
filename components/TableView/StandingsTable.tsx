'use client';
import React, { useState, useEffect } from 'react';
import { PlayerDetails } from '@/interfaces/players';
import { fetchWithDelay } from '@/utils/fetchWithDelay';
import { SkeletonCard } from '@/components/SkeletonTable';
import { ErrorDisplay } from '@/components/ErrorDisplay';
import Link from 'next/link';
import { tableGradient } from '@/utils/tailwindVars';
export default function FormulaOneTable() {
  const [standings, setStandings] = useState<PlayerDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStandings = async () => {
    try {
      setLoading(true);
      const response = (await fetchWithDelay(['standings'])) as [
        PlayerDetails[],
      ];

      const standingsData = response[0];
      setStandings(standingsData);
      setError(null);
    } catch (err) {
      setError('Failed to load standings. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStandings();
  }, []);

  if (loading) return <SkeletonCard />;
  if (error) return <ErrorDisplay message={error} onRetry={fetchStandings} />;

  return (
    <div className='flex w-[350px] flex-col md:w-[600px]'>
      <h1 className='pb-2 text-xl font-semibold text-[#310639]'>
        🏆 F1 Draft Standings
      </h1>
      <p className='pb-5 text-sm'>
        Rankings based on F1-style points system: 20-15-12-10-8-6-4-2 points for
        positions 1st-8th each gameweek.
      </p>

      <div
        className={`w-full rounded-lg border-2 border-black ${tableGradient} p-3 shadow-2xl`}
      >
        <table className={'w-full text-sm font-light text-white'}>
          <thead>
            <tr className='border-b-2 border-white'>
              <th className='w-1/2 border-r-2 border-white py-2 pl-4 text-left font-medium'>
                Player Ranking
              </th>
              <th className='w-1/4 border-r-2 border-white py-2 text-center font-medium'>
                Score
              </th>
              <th className='w-1/4 py-2 text-center font-medium'>TP</th>
            </tr>
          </thead>
          <tbody>
            {standings.map((player: PlayerDetails, index) => (
              <Link
                key={player.id}
                href={`/players/${player.id}`}
                className='table-row cursor-pointer transition-colors hover:bg-white/10'
              >
                <td className='border-r-2 border-white py-4 text-left'>
                  <div className='flex items-center gap-3'>
                    <span
                      className={`inline-flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                        index === 0
                          ? 'bg-yellow-400 text-black'
                          : index === 1
                            ? 'bg-gray-300 text-black'
                            : index === 2
                              ? 'bg-amber-600 text-white'
                              : 'bg-gray-600 text-white'
                      }`}
                    >
                      {player.f1_ranking}
                    </span>
                    <div>
                      <div className='font-medium'>{player.player_name}</div>
                      <div className='text-xs text-gray-300'>
                        {player.team_name}
                      </div>
                    </div>
                  </div>
                </td>
                <td className='border-r-2 border-white py-4 text-center'>
                  <span className='text-lg font-bold text-yellow-300'>
                    {player.f1_score}
                  </span>
                </td>
                <td className='py-4 text-center'>
                  <span className='text-lg font-bold text-blue-300'>
                    {player.total_points || 0}
                  </span>
                </td>
              </Link>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

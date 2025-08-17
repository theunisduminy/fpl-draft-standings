// components/TableView/StandingsTable.tsx
'use client';
import React, { useState, useEffect } from 'react';
import { PlayerDetails } from '@/interfaces/players';
import { fetchWithDelay } from '@/utils/fetchWithDelay';
import { SkeletonCard } from '@/components/SkeletonTable';
import { ErrorDisplay } from '@/components/ErrorDisplay';
import Link from 'next/link';
import { LineChart } from 'lucide-react';
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

      console.log('standings');
      console.log('--------------------------------');
      console.log(response);
      console.log('--------------------------------');

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
              <th className='w-1/6 border-r-2 border-white py-2 text-center font-medium'>
                Rank
              </th>
              <th className='w-2/5 border-r-2 border-white py-2 text-center font-medium md:pl-2 md:text-left'>
                Player
              </th>
              <th className='w-1/5 py-2 text-center font-medium'>Points</th>
              <th className='w-1/5 py-2 text-center font-medium'>Wins</th>
              <th className='w-1/5 py-2 text-center font-medium'>Stats</th>
            </tr>
          </thead>
          <tbody>
            {standings.map((player: PlayerDetails, index) => (
              <tr
                key={player.id}
                className={index % 2 === 0 ? '' : 'bg-ruddyBlue'}
              >
                <td className='border-r-2 border-white py-4 text-center'>
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
                    {player.f1_ranking}
                  </span>
                </td>
                <td className='border-r-2 border-white py-4 text-left font-medium'>
                  {player.player_name}
                  <div className='hide text-xs text-gray-300 md:block'>
                    {player.team_name}
                  </div>
                </td>

                <td className='py-4 text-center'>
                  <span className='text-lg font-bold text-yellow-300'>
                    {player.f1_score}
                  </span>
                </td>
                <td className='py-4 text-center'>
                  <span className='text-green-300'>{player.total_wins}</span>
                </td>
                <td className='py-4 text-center'>
                  <Link
                    href={`/players/${player.id}`}
                    className='inline-flex items-center justify-center rounded bg-white p-1.5 text-blackOlive transition-colors hover:bg-gray-100'
                    title='View detailed statistics'
                  >
                    <LineChart className='h-4 w-4' />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

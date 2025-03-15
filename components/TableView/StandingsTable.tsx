// components/TableView/StandingsTable.tsx
'use client';
import React, { useState, useEffect } from 'react';
import { PlayerDetails } from '@/interfaces/players';
import { fetchWithDelay } from '@/utils/fetchWithDelay';
import { SkeletonCard } from '@/components/SkeletonTable';
import { ErrorDisplay } from '@/components/ErrorDisplay';
import Link from 'next/link';
import { LineChart, Users } from 'lucide-react';
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
        🏆 FPL Draft Standings
      </h1>
      <p className='pb-5 text-sm'>
        The current standings for the Draft league. Won, lost and drew for
        head-to-head matches.
      </p>

      <div
        className={`w-full rounded-lg border-2 border-black ${tableGradient} p-5 shadow-2xl`}
      >
        <table className={'w-full text-sm font-light text-white'}>
          <thead>
            <tr className='border-b-2 border-white'>
              <th className='w-1/6 border-r-2 border-white py-2 font-medium'>
                Player
              </th>
              <th className='w-1/6 py-2 font-medium'>Pts</th>
              <th className='w-1/6 py-2 font-medium'>Won</th>
              <th className='w-1/6 py-2 font-medium'>Lost</th>
              <th className='w-1/6 py-2 font-medium'>Drew</th>
              <th className='w-1/6 py-2 font-medium'>Stats</th>
            </tr>
          </thead>
          <tbody>
            {standings.map((player: PlayerDetails, index) => (
              <tr
                key={player.id}
                className={index % 2 === 0 ? '' : 'bg-ruddyBlue'}
              >
                <td className='border-r-2 border-white py-4'>
                  {player.player_name}
                </td>
                <td className='py-4'>{player.f1_score}</td>
                <td className='py-4'>{player.total_wins}</td>
                <td className='py-4'>{player.total_losses}</td>
                <td className='py-4'>{player.total_draws}</td>
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

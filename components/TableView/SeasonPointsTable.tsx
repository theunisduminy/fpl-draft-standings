// components/TableView/SeasonPointsTable.tsx
'use client';
import React, { useState, useEffect } from 'react';
import { PlayerDetails } from '@/interfaces/players';
import { fetchWithDelay } from '@/utils/fetchWithDelay';
import { SkeletonCard } from '@/components/SkeletonTable';
import { ErrorDisplay } from '@/components/ErrorDisplay';
import { PlayerLink } from '@/components/PlayerLink';
import { tableGradient } from '@/utils/tailwindVars';

export default function SeasonPointsTable() {
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
        💯 Season Points
      </h1>
      <p className='pb-5 text-sm'>
        Breakdown of total FPL points scored and F1 championship points earned.
      </p>

      <div
        className={`mb-8 rounded-lg border-2 border-black ${tableGradient} p-5 shadow-2xl`}
      >
        <table className='w-full table-fixed text-white'>
          <thead>
            <tr>
              <th className='w-1/4 border-r-2 border-white py-2 text-left font-medium'>
                Player
              </th>
              <th className='w-1/4 py-2 text-center font-medium'>TP</th>
              <th className='w-1/4 py-2 text-center font-medium'>F1 Points</th>
              <th className='w-1/4 py-2 text-center font-medium'>Stats</th>
            </tr>
          </thead>
          <tbody>
            {standings.map((player: PlayerDetails, index) => (
              <tr
                key={player.id}
                className={index % 2 === 0 ? '' : 'bg-ruddyBlue'}
              >
                <td className='border-r-2 border-white py-4 text-left'>
                  <div className='font-medium'>{player.player_name}</div>
                </td>
                <td className='py-4 text-center'>
                  <span className='text-lg font-bold text-blue-300'>
                    {player.total_points || 0}
                  </span>
                </td>
                <td className='py-4 text-center'>
                  <span className='text-lg font-bold text-yellow-300'>
                    {player.f1_score || 0}
                  </span>
                </td>
                <td className='py-4 text-center'>
                  <PlayerLink playerId={player.id} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

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
        Breakdown of total points scored, points scored against and head-to-head
        points.
      </p>

      <div
        className={`mb-8 rounded-lg border-2 border-black ${tableGradient} p-5 shadow-2xl`}
      >
        <table className='w-full table-fixed text-white'>
          <thead>
            <tr>
              <th className='w-1/5 border-r-2 border-white py-2 font-medium'>
                Player
              </th>
              <th className='w-1/5 py-2 font-medium'>TP For</th>
              <th className='w-1/5 py-2 font-medium'>TP Agst</th>
              <th className='w-1/5 py-2 font-medium'>H2H Pts</th>
              <th className='w-1/5 py-2 font-medium'>Stats</th>
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
                <td className='py-4'>{player.total_points}</td>
                <td className='py-4'>{player.points_against}</td>
                <td className='py-4'>{player.head_to_head_points}</td>
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

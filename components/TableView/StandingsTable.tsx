'use client';
import React, { useState, useEffect } from 'react';
import { PlayerDetails } from '@/interfaces/players';
import { fetchWithDelay } from '@/utils/fetchWithDelay';
import { SkeletonCard } from '@/components/SkeletonTable';

export default function FormulaOneTable() {
  const [standings, setStandings] = useState<PlayerDetails[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStandings() {
      const response = (await fetchWithDelay(['standings'])) as [
        PlayerDetails[],
      ];
      const standingsData = response[0];
      setStandings(standingsData);
      setLoading(false); // Data received, set loading to false
    }

    fetchStandings();
  }, []);

  if (loading) return <SkeletonCard />;

  return (
    <div className='flex w-[350px] flex-col md:w-[600px]'>
      <h1 className='pb-2 text-2xl font-semibold text-[#310639]'>
        🏆 FPL Draft Standings
      </h1>
      <p className='pb-5 text-sm'>
        The current standings for the Draft league. Won, lost and drew for
        head-to-head matches.
      </p>

      <div className='w-full rounded-lg border-2 border-black bg-gradient-to-r from-cyan-600 to-blue-500 p-5 shadow-2xl'>
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
            </tr>
          </thead>
          <tbody>
            {standings.map((player: PlayerDetails, index) => (
              <tr
                key={player.id}
                className={index % 2 === 0 ? '' : 'bg-blue-400'}
              >
                <td className='border-r-2 border-white py-4'>
                  {player.player_name}
                </td>
                <td className='py-4'>{player.f1_score}</td>
                <td className='py-4'>{player.total_wins}</td>
                <td className='py-4'>{player.total_losses}</td>
                <td className='py-4'>{player.total_draws}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

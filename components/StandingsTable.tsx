'use client';
import React, { useState, useEffect } from 'react';
import { PlayerDetails } from '@/interfaces/players';
import { fetchWithDelay } from '@/utils/fetchWithDelay';
import { SkeletonCard } from './SkeletonTable';

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

  return (
    <div className='flex flex-col'>
      <h1 className='pb-5 text-2xl font-semibold text-[#310639]'>
        FPL Draft Standings
      </h1>
      {loading ? (
        <SkeletonCard />
      ) : (
        <div className='rounded-lg border-2 border-black bg-gradient-to-r from-cyan-600 to-blue-500 p-5 shadow-2xl'>
          <table
            className={'w-[290px] text-sm font-light text-white md:w-[500px]'}
          >
            <thead>
              <tr className='border-b-2 border-white'>
                <th className='w-1/4 border-r-2 border-white py-2 font-medium'>
                  Player
                </th>
                <th className='w-1/4 py-2 font-medium'>Rank</th>
                <th className='w-1/6 py-2 font-medium'>Won</th>
                <th className='w-1/6 py-2 font-medium'>Lost</th>
                <th className='w-1/6 py-2 font-medium'>Drew</th>
              </tr>
            </thead>
            <tbody>
              {standings.map((player: PlayerDetails, index) => (
                <tr
                  key={player.id}
                  className={index % 2 === 0 ? '' : 'bg-blue-400'} // Apply bg-blue-400 to every second row
                >
                  <td className='border-r-2 border-white py-4'>
                    {player.player_name}
                  </td>
                  <td className='py-4'>
                    {player.f1_ranking} ({player.f1_score})
                  </td>
                  <td className='py-4'>{player.total_wins}</td>
                  <td className='py-4'>{player.total_losses}</td>
                  <td className='py-4'>{player.total_draws}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

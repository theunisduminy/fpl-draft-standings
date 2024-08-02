'use client';
import React, { useState, useEffect } from 'react';
import { F1PlayerDetails } from '@/interfaces/players';
import apiHelper from '@/utils/apiHelper';
import { skeletonTable } from '@/utils/skeletonTableHome';

export default function FormulaOneTable() {
  const [standings, setStandings] = useState<F1PlayerDetails[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStandings() {
      const standingsData = await apiHelper('formula-one-standings');
      setStandings(standingsData);
      setLoading(false); // Data received, set loading to false
    }

    fetchStandings();
  }, []);

  return (
    <div className='flex flex-col justify-center items-center'>
      <h1 className='text-[#310639] text-2xl pb-5 font-semibold animate-fade-up'>
        Draft One Standings
      </h1>
      <div className='w-[337px] sm:w-[450px] bg-gradient-to-r from-cyan-600 to-blue-500 p-8 rounded-lg shadow-2xl border-2 border-black'>
        {loading ? (
          skeletonTable
        ) : (
          <table className={'text-white w-[280px] sm:w-[400px] font-light text-sm'}>
            <thead>
              <tr className='border-b-2 border-white'>
                <th className='font-medium w-1/4 py-2'>Player</th>
                <th className='font-medium w-1/4 py-2'>F1 Rank</th>
                <th className='font-medium w-1/4 py-2'>H2H Wins</th>
              </tr>
            </thead>
            <tbody className={`${loading ? 'animate-pulse' : ''}`}>
              {standings.map((player: F1PlayerDetails) => (
                <tr key={player.id}>
                  <td className='py-2'>{player.player_name}</td>
                  <td className='py-2'>
                    {player.f1_ranking} ({player.f1_score})
                  </td>
                  <td className='py-2'>{player.total_wins}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

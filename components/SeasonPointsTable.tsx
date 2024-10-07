'use client';
import React, { useState, useEffect } from 'react';
import { PlayerDetails } from '@/interfaces/players';
import { fetchWithDelay } from '@/utils/fetchWithDelay';
import { SkeletonCard } from './SkeletonTable';

export default function SeasonPointsTable() {
  const [standings, setStandings] = useState<PlayerDetails[]>([]); // Define type for standings
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
        Season Points
      </h1>
      {loading ? (
        <SkeletonCard />
      ) : (
        <div className='mb-8 rounded-lg border-2 border-black bg-gradient-to-r from-cyan-600 to-blue-500 p-5 shadow-2xl'>
          <table className='w-[290px] table-fixed text-white md:w-[500px]'>
            <thead>
              <tr>
                <th className='w-1/4 border-r-2 border-white py-2 font-medium'>
                  Player
                </th>
                <th className='w-1/4 py-2 font-medium'>TP For</th>
                <th className='w-1/4 py-2 font-medium'>TP Agst</th>
                <th className='w-1/4 py-2 font-medium'>H2H Pts</th>
              </tr>
            </thead>
            <tbody>
              {standings.map((player: PlayerDetails, index) => (
                <tr
                  key={player.id}
                  className={index % 2 === 0 ? '' : 'bg-blue-400'}
                >
                  <td className='w-1/4 border-r-2 border-white py-4'>
                    {player.player_name}
                  </td>
                  <td className='w-1/4 py-4'>{player.total_points}</td>
                  <td className='w-1/4 py-4'>{player.points_against}</td>
                  <td className='w-1/4 py-4'>{player.head_to_head_points}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

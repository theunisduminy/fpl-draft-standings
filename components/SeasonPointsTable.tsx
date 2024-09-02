'use client';
import React, { useState, useEffect } from 'react';
import { PlayerDetails } from '@/interfaces/players';
import { fetchWithDelay } from '@/utils/fetchWithDelay';

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner } from '@fortawesome/free-solid-svg-icons';

export default function SeasonPointsTable() {
  const [standings, setStandings] = useState<PlayerDetails[]>([]); // Define type for standings
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStandings() {
      const response = (await fetchWithDelay(['standings'])) as [PlayerDetails[]];
      const standingsData = response[0];
      setStandings(standingsData);
      setLoading(false); // Data received, set loading to false
    }

    fetchStandings();
  }, []);

  return (
    <div className='flex flex-col justify-center items-center'>
      <h1 className='text-[#310639] text-2xl pb-5 font-semibold animate-fade-up text-center'>
        Season Points
      </h1>
      {loading ? (
        <FontAwesomeIcon className='animate-spin text-6xl text-blue-500' icon={faSpinner} />
      ) : (
        <div className='mb-8 bg-gradient-to-r from-cyan-600 to-blue-500 p-5 rounded-lg shadow-2xl border-2 border-black'>
          <table className='text-white table-fixed w-[290px] md:w-[500px]'>
            <thead>
              <tr>
                <th className='py-2 font-medium w-1/4 border-r-2 border-white'>Player</th>
                <th className='py-2 font-medium w-1/4'>TP For</th>
                <th className='py-2 font-medium w-1/4'>TP Agst</th>
                <th className='py-2 font-medium w-1/4'>H2H Pts</th>
              </tr>
            </thead>
            <tbody>
              {standings.map((player: PlayerDetails, index) => (
                <tr key={player.id} className={index % 2 === 0 ? '' : 'bg-blue-400'}>
                  <td className='w-1/4 py-4 border-r-2 border-white'>{player.player_name}</td>
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

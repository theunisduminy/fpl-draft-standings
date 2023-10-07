import React, { useState, useEffect } from 'react';
import { PlayerDetails } from '@/interfaces/players';
import getStandings from '@/utils/getRankings';
import { skeletonTable } from '@/utils/skeletonTableHome';

export default function StandingsTable() {
  const [standings, setStandings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStandings() {
      const standingsData = await getStandings();
      setStandings(standingsData);
      setLoading(false); // Data received, set loading to false
    }

    fetchStandings();
  }, []);

  return (
    <div className='flex flex-col justify-center items-center pt-2 '>
      <div className='w-[337px] sm:w-[450px] bg-gradient-to-r from-cyan-600 to-blue-500 p-8 rounded-lg shadow-2xl'>
        {loading ? (
          skeletonTable
        ) : (
          <table className={'text-white w-[280px] sm:w-[400px] font-light text-sm'}>
            <thead>
              <tr className='border-b-2 border-white'>
                <th className='font-medium w-1/4 py-2'>Player</th>
                <th className='font-medium w-1/4 py-2'>TP Rank</th>
                <th className='font-medium w-1/4 py-2'>H2H Rank</th>
                <th className='font-medium w-1/4 py-2'>Score</th>
              </tr>
            </thead>
            <tbody className={`${loading ? 'animate-pulse' : ''}`}>
              {standings.map((player: PlayerDetails) => (
                <tr key={player.id}>
                  <td className='py-2'>{player.player_name}</td>
                  <td className='py-2'>
                    {player.total_points_rank} ({player.total_points})
                  </td>
                  <td className='py-2'>
                    {player.head_to_head_rank} ({player.head_to_head_total})
                  </td>
                  <td className='py-2'>{player.combined_score}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

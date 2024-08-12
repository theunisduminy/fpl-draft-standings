'use client';
import React, { useState, useEffect } from 'react';
import { PlayerDetails } from '@/interfaces/players';
import apiHelper from '@/utils/apiHelper';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner } from '@fortawesome/free-solid-svg-icons';

export default function FormulaOneTable() {
  const [standings, setStandings] = useState<PlayerDetails[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStandings() {
      const start = Date.now(); // Record the start time
      const standingsData = await apiHelper('standings');
      const duration = Date.now() - start; // Calculate the duration taken by the API call

      // Ensure the operation takes at least 2 seconds
      const minimumDuration = 300; // 2 seconds in milliseconds
      const delay = Math.max(minimumDuration - duration, 0);

      setTimeout(() => {
        setStandings(standingsData);
        setLoading(false); // Data received, set loading to false
      }, delay);
    }

    fetchStandings();
  }, []);

  return (
    <div className='flex flex-col justify-center items-center'>
      <h1 className='text-[#310639] text-2xl pb-5 font-semibold animate-fade-up'>
        FPL Draft Standings
      </h1>
      {loading ? (
        <FontAwesomeIcon className='animate-spin text-6xl text-blue-500' icon={faSpinner} />
      ) : (
        <div className='bg-gradient-to-r from-cyan-600 to-blue-500 p-5 rounded-lg shadow-2xl border-2 border-black'>
          <table className={'text-white w-[290px] md:w-[500px] font-light text-sm'}>
            <thead>
              <tr className='border-b-2 border-white'>
                <th className='font-medium w-1/4 py-2 border-r-2 border-white'>Player</th>
                <th className='font-medium w-1/4 py-2'>Rank</th>
                <th className='font-medium w-1/6 py-2'>Won</th>
                <th className='font-medium w-1/6 py-2'>Lost</th>
                <th className='font-medium w-1/6 py-2'>Drew</th>
              </tr>
            </thead>
            <tbody>
              {standings.map((player: PlayerDetails, index) => (
                <tr
                  key={player.id}
                  className={index % 2 === 0 ? '' : 'bg-blue-400'} // Apply bg-blue-400 to every second row
                >
                  <td className='py-4 border-r-2 border-white'>{player.player_name}</td>
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

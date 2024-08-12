'use client';
import React, { useState, useEffect } from 'react';
import { PlayerDetails } from '@/interfaces/players';
import apiHelper from '@/utils/apiHelper';

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner } from '@fortawesome/free-solid-svg-icons';

export default function PositionPlacedTable() {
  const [standings, setStandings] = useState([]);
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
      <h1 className='text-[#310639] text-2xl pb-5 font-semibold animate-fade-up text-center'>
        Position Placed <br />
        <span className='text-sm md:hidden'>(scroll right)</span>
      </h1>

      {loading ? (
        <FontAwesomeIcon className='animate-spin text-6xl text-blue-500' icon={faSpinner} />
      ) : (
        <div className='mb-8 bg-gradient-to-r from-cyan-600 to-blue-500 p-5 rounded-lg shadow-2xl border-2 border-black'>
          <div className='w-[290px] md:w-[600px] overflow-x-auto'>
            <table className='text-white table-fixed min-w-[600px]'>
              <thead>
                <tr>
                  <th className='py-2 w-1/6 font-medium border-r-2 border-white'>Player</th>
                  <th className='py-2 w-auto  font-medium'>1st</th>
                  <th className='py-2 w-auto  font-medium'>2nd</th>
                  <th className='py-2 w-auto  font-medium'>3rd</th>
                  <th className='py-2 w-auto  font-medium'>4th</th>
                  <th className='py-2 w-auto  font-medium'>5th</th>
                  <th className='py-2 w-auto  font-medium'>6th</th>
                  <th className='py-2 w-auto  font-medium'>7th</th>
                  <th className='py-2 w-auto  font-medium'>8th</th>
                </tr>
              </thead>
              <tbody>
                {standings.map((player: PlayerDetails, index) => (
                  <tr key={player.id} className={index % 2 === 0 ? '' : 'bg-blue-400'}>
                    <td className='py-4 border-r-2 border-white'>{player.player_name}</td>
                    <td className='py-4'>{player.position_placed.first}</td>
                    <td className='py-4'>{player.position_placed.second}</td>
                    <td className='py-4'>{player.position_placed.third}</td>
                    <td className='py-4'>{player.position_placed.fourth}</td>
                    <td className='py-4'>{player.position_placed.fifth}</td>
                    <td className='py-4'>{player.position_placed.sixth}</td>
                    <td className='py-4'>{player.position_placed.seventh}</td>
                    <td className='py-4'>{player.position_placed.eighth}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

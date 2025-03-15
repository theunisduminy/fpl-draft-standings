'use client';
import React, { useState, useEffect } from 'react';
import { PlayerDetails } from '@/interfaces/players';
import { fetchWithDelay } from '@/utils/fetchWithDelay';
import { SkeletonCard } from '@/components/SkeletonTable';
import { tableGradient } from '@/utils/tailwindVars';
export default function PositionPlacedTable() {
  const [standings, setStandings] = useState<PlayerDetails[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStandings() {
      const [standingsData] = (await fetchWithDelay(['standings'])) as [
        PlayerDetails[],
      ];
      setStandings(standingsData);
      setLoading(false); // Data received, set loading to false
    }

    fetchStandings();
  }, []);

  if (loading) return <SkeletonCard />;

  return (
    <div className='flex w-[350px] flex-col md:w-[600px]'>
      <h1 className='pb-5 text-xl font-semibold text-[#310639]'>
        🎖️ Position Placed <br />
        <span className='text-sm md:hidden'>(scroll right)</span>
      </h1>
      <p className='pb-5 text-sm'>
        Frequency of position placed, based on total points, for the previous
        gameweeks.
      </p>

      <div
        className={`mb-8 rounded-lg border-2 border-black ${tableGradient} p-5 shadow-2xl`}
      >
        <div className='w-[290px] overflow-x-auto md:w-full'>
          <table className='min-w-[600px] table-fixed text-white'>
            <thead>
              <tr>
                <th className='w-1/6 border-r-2 border-white py-2 font-medium'>
                  Player
                </th>
                <th className='w-auto py-2 font-medium'>1st</th>
                <th className='w-auto py-2 font-medium'>2nd</th>
                <th className='w-auto py-2 font-medium'>3rd</th>
                <th className='w-auto py-2 font-medium'>4th</th>
                <th className='w-auto py-2 font-medium'>5th</th>
                <th className='w-auto py-2 font-medium'>6th</th>
                <th className='w-auto py-2 font-medium'>7th</th>
                <th className='w-auto py-2 font-medium'>8th</th>
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
    </div>
  );
}

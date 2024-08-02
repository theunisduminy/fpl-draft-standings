'use client';
import React, { useState, useEffect } from 'react';
import { PlayerDetails } from '@/interfaces/players';
import apiHelper from '@/utils/apiHelper';

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner } from '@fortawesome/free-solid-svg-icons';

export default function LeagueDetailTable() {
  const [standings, setStandings] = useState([]);
  const [formulaOneStandings, setFormulaOneStandings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStandings() {
      const standingsData = await apiHelper('standings');
      const formulaOneData = await apiHelper('formula-one-standings');
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
        <FontAwesomeIcon className='animate-spin text-5xl text-white' icon={faSpinner} />
      ) : (
        <div className='mb-8 bg-gradient-to-r from-cyan-600 to-blue-500 p-4 rounded-lg shadow-2xl border-2 border-black'>
          <table className='text-white table-fixed w-[280px] sm:w-[400px]'>
            <thead>
              <tr>
                <th className='py-2 font-medium w-1/6'>Player</th>
                <th className='py-2 font-medium w-1/6'>Pts For</th>
                <th className='py-2 font-medium w-1/6'>Pts Agst</th>
                <th className='py-2 font-medium w-1/6'>H2H Pts</th>
                <th className='py-2 font-medium w-1/6'>F1 score</th>
              </tr>
            </thead>
            <tbody>
              {standings.map((player: PlayerDetails, index) => (
                <tr key={player.id}>
                  <td className='w-1/6'>{player.player_name}</td>
                  <td className='w-1/6'>{player.total_points}</td>
                  <td className='w-1/6'>{player.points_against}</td>
                  <td className='w-1/6'>{player.head_to_head_points}</td>
                  <td className='w-1/6'>{player.combined_score}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

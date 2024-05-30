'use client';
import React, { useState, useEffect } from 'react';
import { PlayerDetails } from '@/interfaces/players';
import apiHelper from '@/utils/apiHelper';

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner } from '@fortawesome/free-solid-svg-icons';

export default function LeagueDetailTable() {
  const [standings, setStandings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStandings() {
      const standingsData = await apiHelper('standings');
      setStandings(standingsData);
      setLoading(false); // Data received, set loading to false
    }

    fetchStandings();
  }, []);

  return (
    <div
      className={`flex flex-col items-center text-white w-[80vw] px-5 pb-2 ${
        loading ? `flex flex-col items-center min-h-[200vh]` : ''
      } `}
    >
      {loading ? (
        <FontAwesomeIcon className='animate-spin text-5xl text-white' icon={faSpinner} />
      ) : (
        standings.map((player: PlayerDetails, index) => (
          <div
            key={player.id}
            className='w-[100%] md:w-[50%] mb-8 bg-gradient-to-r from-cyan-600 to-blue-500 p-4 rounded-lg shadow-2xl border-2 border-black'
          >
            <h3 className='text-xl text-white font-semibold text-center'>{`${index + 1}. ${
              player.player_name
            } ${player.player_surname}`}</h3>
            <h4 className='text-lg  mb-6 font-semibold text-center'>{player.team_name}</h4>
            <table className=' text-white w-full'>
              <thead>
                <tr>
                  <th className='py-2 font-medium'>Pts For</th>
                  <th className='py-2 font-medium'>Pts Agst</th>
                  <th className='py-2 font-medium'>H2H Pts</th>
                  <th className='py-2 font-medium'>H2H Rank</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>{player.total_points}</td>
                  <td>{player.points_against}</td>
                  <td>{player.head_to_head_points}</td>
                  <td>{player.head_to_head_rank}</td>
                </tr>
              </tbody>
            </table>
            <table className='mt-4 text-white w-full'>
              <thead>
                <tr className=''>
                  <th className='py-2 font-medium'>TP Rank</th>
                  <th className='py-2 font-medium'>H2H Score</th>
                  <th className='py-2 font-medium'>TP Score</th>
                  <th className='py-2 font-medium'>Total</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>{player.total_points_rank}</td>
                  <td>{player.head_to_head_score}</td>
                  <td>{player.total_points_score}</td>
                  <td>{player.combined_score}</td>
                </tr>
              </tbody>
            </table>
          </div>
        ))
      )}
    </div>
  );
}

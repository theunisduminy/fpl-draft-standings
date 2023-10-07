import React, { useState, useEffect } from 'react';
import { PlayerDetails } from '@/interfaces/players';
import getStandings from '@/utils/getRankings';

export default function Detail() {
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
    <div className='text-white min-h-screen px-5 pb-2 flex flex-col items-center'>
      {loading ? (
        <i className='fa fa-circle-o-notch text-5xl animate-spin' aria-hidden='true'></i>
      ) : (
        standings.map((player: PlayerDetails, index) => (
          <div
            key={player.id}
            className='sm:w-[450px] mb-8 bg-gradient-to-r from-cyan-600 to-blue-500 p-4 rounded-lg shadow-2xl'
          >
            <h3 className='text-xl font-semibold'>{`${index + 1}. ${player.player_name}`}</h3>
            {/* <h4 className='text-lg'>{player.team_name}</h4> */}
            <table className='w-full text-white'>
              <thead>
                <tr className=''>
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
            <table className='w-full mt-4 text-white'>
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

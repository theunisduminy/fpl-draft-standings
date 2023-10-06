import React, { useState, useEffect } from 'react';
import styles from '@/../styles/Table.module.css';
import getStandings from '@/utils/getRankings';

export default function StandingsTable() {
  const [standings, setStandings] = useState([]);

  useEffect(() => {
    async function fetchStandings() {
      const standingsData = await getStandings();
      setStandings(standingsData);
    }

    fetchStandings();
  }, []);

  return (
    <div className='flex flex-col justify-center items-center pt-2 '>
      <div className='bg-gradient-to-r from-cyan-600 to-blue-500 p-8 rounded-lg shadow-2xl'>
        <table className='w-100 text-white font-light text-sm sm:w-[400px]'>
          <thead>
            <tr className='border-b-2 border-white'>
              <th className='w-1/4 py-2'>Player</th>
              <th className='w-1/4 py-2'>TP Rank</th>
              <th className='w-1/4 py-2'>H2H Rank</th>
              <th className='w-1/4 py-2'>Score</th>
            </tr>
          </thead>
          <tbody>
            {standings.map((player: Record<string, any>) => (
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
      </div>
    </div>
  );

  //   return (
  //     <div className={styles.standingsTable}>
  //       <table>
  //         <thead>
  //           <tr>
  //             <th>Player</th>
  //             <th>TP Rank</th>
  //             <th>H2H Rank</th>
  //             <th>Score</th>
  //           </tr>
  //         </thead>
  //         <tbody>
  //           {standings.map((player: Record<string, any>) => (
  //             <tr key={player.id}>
  //               <td>{player.player_name}</td>
  //               <td>
  //                 {player.total_points_rank} ({player.total_points})
  //               </td>
  //               <td>
  //                 {player.head_to_head_rank} ({player.head_to_head_total})
  //               </td>
  //               <td>{player.combined_score}</td>
  //             </tr>
  //           ))}
  //         </tbody>
  //       </table>
  //     </div>
  //   );
}

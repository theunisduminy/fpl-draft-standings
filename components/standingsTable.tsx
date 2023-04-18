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
    <div className={styles.standingsTable}>
      <table>
        <thead>
          <tr>
            <th>Player</th>
            <th>TP Rank</th>
            <th>H2H Rank</th>
            <th>Score</th>
          </tr>
        </thead>
        <tbody>
          {standings.map((player: Record<string, any>) => (
            <tr key={player.id}>
              <td>{player.player_name}</td>
              <td>
                {player.total_points_rank} ({player.total_points})
              </td>
              <td>
                {player.head_to_head_rank} ({player.head_to_head_total})
              </td>
              <td>{player.combined_score}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

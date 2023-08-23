import React, { useState, useEffect } from 'react';
import styles from '@/../styles/Detail.module.css';
import getStandings from '@/utils/getRankings';

export default function Detail() {
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
      {standings.map((player: Record<string, any>, index: number) => (
        <>
          <h3>{`${index + 1}. ${player.player_name}`}</h3>
          <h4>{player.team_name}</h4>
          <table>
            <thead>
              <tr className={styles.tableHeadDetail}>
                <th>Pts For</th>
                <th>Pts Agst</th>
                <th>H2H Pts</th>
                <th>H2H Rank</th>
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
          <table className={styles.secondDetailTable}>
            <thead>
              <tr className={styles.tableHeadDetail}>
                <th>TP Rank</th>
                <th>H2H Score</th>
                <th>TP Score</th>
                <th>
                  <i></i>Total
                </th>
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
        </>
      ))}
    </div>
  );
}

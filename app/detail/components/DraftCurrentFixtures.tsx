'use client';
import React, { useState, useEffect } from 'react';
import { PlayerDetails } from '@/interfaces/players';
import { Match, GameWeekStatus } from '@/interfaces/match';
import { fetchWithDelay } from '@/utils/fetchWithDelay';

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner } from '@fortawesome/free-solid-svg-icons';

export default function DraftCurrentFixtures() {
  const [standings, setStandings] = useState<PlayerDetails[]>([]);
  const [event, setEvent] = useState<GameWeekStatus>();
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true); // Add loading state

  useEffect(() => {
    async function fetchStandings() {
      const [standingsData, currentEvent, matches] = (await fetchWithDelay([
        'standings',
        'current-event',
        'matches',
      ])) as [PlayerDetails[], GameWeekStatus, Match[]];

      setStandings(standingsData);
      setEvent(currentEvent);
      setMatches(matches);
      setLoading(false); // Data received, set loading to false
    }

    fetchStandings();
  }, []);

  const currentGW = event?.event;
  const currentMatches = matches.filter((match) => match.event === currentGW);
  const formattedCurrentMatches = currentMatches.map((match) => {
    const homePlayer = standings.find(
      (player: PlayerDetails) => player.id === match.league_entry_1,
    );
    const awayPlayer = standings.find(
      (player: PlayerDetails) => player.id === match.league_entry_2,
    );

    return {
      home_player_name: homePlayer ? `${homePlayer.player_name}` : 'Unknown',
      away_player_name: awayPlayer ? `${awayPlayer.player_name}` : 'Unknown',
      home_player_points: match.league_entry_1_points,
      away_player_points: match.league_entry_2_points,
      event: match.event,
    };
  });

  return (
    <div className='flex flex-col justify-center items-center'>
      <h1 className='text-[#310639] text-2xl pb-5 font-semibold'>{`GW ${currentGW || ''} LIVE`}</h1>
      {loading ? (
        <FontAwesomeIcon className='animate-spin text-6xl text-blue-500' icon={faSpinner} />
      ) : (
        <div className='w-[370px] sm:w-[450px] bg-gradient-to-r from-cyan-600 to-blue-500 p-8 rounded-lg shadow-2xl border-2 border-black'>
          <table className={'text-white w-[300px] sm:w-[400px] font-light text-sm'}>
            <thead>
              <tr className='border-b-2 border-white'>
                <th className='font-medium w-1/4 py-2'>Home</th>
                <th></th>
                <th className='font-medium w-1/4 py-2'>Away</th>
              </tr>
            </thead>
            <tbody>
              {formattedCurrentMatches.map((match: any, index: number) => (
                <tr key={index} className={index % 2 === 0 ? '' : 'bg-blue-400'}>
                  <td className='py-4'>{`${match.home_player_name} (${match.home_player_points})`}</td>
                  <td className='py-4'>vs.</td>
                  <td className='py-4'>{`${match.away_player_name} (${match.away_player_points})`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

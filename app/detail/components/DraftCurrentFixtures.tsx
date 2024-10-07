'use client';
import React, { useState, useEffect } from 'react';
import { PlayerDetails } from '@/interfaces/players';
import { Match, GameWeekStatus } from '@/interfaces/match';
import { fetchWithDelay } from '@/utils/fetchWithDelay';
import { SkeletonCard } from '@/components/SkeletonTable';

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
    <div className='flex flex-col'>
      <h1 className='pb-5 text-2xl font-semibold text-[#310639]'>{`Gameweek ${
        currentGW || ''
      } `}</h1>
      {loading ? (
        <SkeletonCard />
      ) : (
        <div className='w-[370px] rounded-lg border-2 border-black bg-gradient-to-r from-cyan-600 to-blue-500 p-8 shadow-2xl sm:w-[450px]'>
          <table
            className={'w-[300px] text-sm font-light text-white sm:w-[400px]'}
          >
            <thead>
              <tr className='border-b-2 border-white'>
                <th className='w-1/4 py-2 font-medium'>Home</th>
                <th></th>
                <th className='w-1/4 py-2 font-medium'>Away</th>
              </tr>
            </thead>
            <tbody>
              {formattedCurrentMatches.map((match: any, index: number) => (
                <tr
                  key={index}
                  className={index % 2 === 0 ? '' : 'bg-blue-400'}
                >
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

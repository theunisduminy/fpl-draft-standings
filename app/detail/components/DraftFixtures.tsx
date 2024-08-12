'use client';
import React, { useState, useEffect } from 'react';
import { PlayerDetails } from '@/interfaces/players';
import { Match } from '@/interfaces/match';
import apiHelper from '@/utils/apiHelper';

export default function DraftFixtures() {
  const [standings, setStandings] = useState<PlayerDetails[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const fixturesToShow = 8; // Number of upcoming fixtures to show

  useEffect(() => {
    async function fetchData() {
      const standingsData = await apiHelper('standings');
      const matchesData = await apiHelper('matches');
      setStandings(standingsData);
      setMatches(matchesData);
    }

    fetchData();
  }, []);

  // Filter matches to include only those that are not finished (upcoming fixtures)
  const upcomingMatches = matches.filter((match) => !match.finished);

  // Group upcoming matches by event (Game Week)
  const matchesByEvent = upcomingMatches.reduce((acc, match) => {
    if (!acc[match.event]) {
      acc[match.event] = [];
    }
    acc[match.event].push(match);
    return acc;
  }, {} as Record<number, Match[]>);

  // Sort Game Week numbers in ascending order for future events
  const sortedEventKeys = Object.keys(matchesByEvent)
    .map(Number)
    .sort((a, b) => a - b);

  // Get the next N events based on fixturesToShow
  const visibleEvents = sortedEventKeys.slice(0, fixturesToShow);

  return (
    <div className='flex flex-col justify-center items-center'>
      <h1 className='text-[#310639] text-2xl pb-5 font-semibold'>Upcoming Fixtures</h1>
      <div className='w-full md:w-[450px] bg-gradient-to-r from-cyan-600 to-blue-500 p-8 rounded-lg shadow-2xl border-2 border-black'>
        {visibleEvents.map((eventKey) => {
          const currentMatches = matchesByEvent[eventKey];
          const formattedMatches = currentMatches.map((match) => {
            const homePlayer = standings.find(
              (player: PlayerDetails) => player.id === match.league_entry_1,
            );
            const awayPlayer = standings.find(
              (player: PlayerDetails) => player.id === match.league_entry_2,
            );

            return {
              home_player_name: homePlayer ? `${homePlayer.player_name}` : 'Unknown',
              away_player_name: awayPlayer ? `${awayPlayer.player_name}` : 'Unknown',
              event: match.event,
            };
          });

          return (
            <div key={eventKey} className='mb-6'>
              <h2 className='text-white text-lg pb-3 font-medium'>{`GW ${eventKey} Fixtures`}</h2>
              <table className='text-white w-[290px] md:w-full font-light text-sm'>
                <thead>
                  <tr className='border-b-2 border-white'>
                    <th className='font-medium py-2'>Home</th>
                    <th></th>
                    <th className='font-medium py-2'>Away</th>
                  </tr>
                </thead>
                <tbody>
                  {formattedMatches.map((match, index) => (
                    <tr key={index} className={index % 2 === 0 ? '' : 'bg-blue-400'}>
                      <td className='py-2'>{`${match.home_player_name}`}</td>
                      <td className='py-2'>vs.</td>
                      <td className='py-2'>{`${match.away_player_name}`}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        })}
      </div>
    </div>
  );
}

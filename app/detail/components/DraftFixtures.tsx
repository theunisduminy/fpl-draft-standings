'use client';
import React, { useState, useEffect } from 'react';
import { PlayerDetails } from '@/interfaces/players';
import { Match } from '@/interfaces/match';
import { fetchWithDelay } from '@/utils/fetchWithDelay';
import { SkeletonCard } from '@/components/SkeletonTable';

export default function DraftFixtures() {
  const [standings, setStandings] = useState<PlayerDetails[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true); // Add loading state
  const fixturesToShow = 8; // Number of upcoming fixtures to show

  useEffect(() => {
    async function fetchData() {
      const [standingsData, matchesData] = (await fetchWithDelay([
        'standings',
        'matches',
      ])) as [PlayerDetails[], Match[]];
      setStandings(standingsData);
      setMatches(matchesData);
      setLoading(false); // Data received, set loading to false
    }

    fetchData();
  }, []);

  // Filter matches to include only those that are not finished (upcoming fixtures)
  const upcomingMatches = matches.filter((match) => !match.finished);

  // Group upcoming matches by event (Game Week)
  const matchesByEvent = upcomingMatches.reduce(
    (acc, match) => {
      if (!acc[match.event]) {
        acc[match.event] = [];
      }
      acc[match.event].push(match);
      return acc;
    },
    {} as Record<number, Match[]>,
  );

  // Sort Game Week numbers in ascending order for future events
  const sortedEventKeys = Object.keys(matchesByEvent)
    .map(Number)
    .sort((a, b) => a - b);

  // Get the next N events based on fixturesToShow
  const visibleEvents = sortedEventKeys.slice(0, fixturesToShow);

  return (
    <div className='flex flex-col'>
      <h1 className='pb-5 text-2xl font-semibold text-[#310639]'>
        Upcoming Fixtures
      </h1>
      {loading ? (
        <SkeletonCard />
      ) : (
        <div className='w-full rounded-lg border-2 border-black bg-gradient-to-r from-cyan-600 to-blue-500 p-8 shadow-2xl md:w-[450px]'>
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
                home_player_name: homePlayer
                  ? `${homePlayer.player_name}`
                  : 'Unknown',
                away_player_name: awayPlayer
                  ? `${awayPlayer.player_name}`
                  : 'Unknown',
                event: match.event,
              };
            });

            return (
              <div key={eventKey} className='mb-20'>
                <h2 className='pb-3 text-lg font-medium text-white'>{`GW ${eventKey} Fixtures`}</h2>
                <table className='w-[290px] text-sm font-light text-white md:w-full'>
                  <thead>
                    <tr className='border-b-2 border-white'>
                      <th className='py-2 font-medium'>Home</th>
                      <th></th>
                      <th className='py-2 font-medium'>Away</th>
                    </tr>
                  </thead>
                  <tbody>
                    {formattedMatches.map((match, index) => (
                      <tr
                        key={index}
                        className={index % 2 === 0 ? '' : 'bg-blue-400'}
                      >
                        <td className='py-4'>{`${match.home_player_name}`}</td>
                        <td className='py-4'>vs.</td>
                        <td className='py-4'>{`${match.away_player_name}`}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

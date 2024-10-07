'use client';
import React, { useState, useEffect } from 'react';
import { PlayerDetails } from '@/interfaces/players';
import { Match } from '@/interfaces/match';
import { fetchWithDelay } from '@/utils/fetchWithDelay';
import { SkeletonCard } from '@/components/SkeletonTable';

export default function AllGameWeekResults() {
  const [standings, setStandings] = useState<PlayerDetails[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [currentPosition, setCurrentPosition] = useState(0); // Track the current position in the list of game weeks
  const [loading, setLoading] = useState(true); // Add loading state
  const resultsPerPage = 5; // Number of game weeks to show per page

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

  // Filter matches to include only those that are finished
  const finishedMatches = matches.filter((match) => match.finished);

  // Group finished matches by event (Game Week)
  const matchesByEvent = finishedMatches.reduce(
    (acc, match) => {
      if (!acc[match.event]) {
        acc[match.event] = [];
      }
      acc[match.event].push(match);
      return acc;
    },
    {} as Record<number, Match[]>,
  );

  // Sort Game Week numbers in descending order
  const sortedEventKeys = Object.keys(matchesByEvent)
    .map(Number)
    .sort((a, b) => b - a);

  // Determine the range of events to display based on the current position
  const startIndex = currentPosition;
  const endIndex = Math.min(
    startIndex + resultsPerPage,
    sortedEventKeys.length,
  );
  const visibleEvents = sortedEventKeys.slice(startIndex, endIndex);

  // Function to handle the "See Older" button click
  const handleSeeOlder = () => {
    setCurrentPosition((prevPosition) =>
      Math.min(
        prevPosition + resultsPerPage,
        sortedEventKeys.length - resultsPerPage,
      ),
    );
  };

  // Function to handle the "See Newer" button click
  const handleSeeNewer = () => {
    setCurrentPosition((prevPosition) =>
      Math.max(prevPosition - resultsPerPage, 0),
    );
  };

  return (
    <div className='flex flex-col'>
      <h1 className='pb-5 text-2xl font-semibold text-[#310639]'>
        Head-to-Head Results
      </h1>
      {loading ? (
        <SkeletonCard />
      ) : (
        <>
          <div className='w-full rounded-lg border-2 border-black bg-gradient-to-r from-cyan-600 to-blue-500 p-8 shadow-2xl sm:w-[450px]'>
            {visibleEvents.map((eventKey) => {
              const currentMatches = matchesByEvent[eventKey];
              const formattedMatches = currentMatches.map((match) => {
                const homePlayer = standings.find(
                  (player: PlayerDetails) => player.id === match.league_entry_1,
                );
                const awayPlayer = standings.find(
                  (player: PlayerDetails) => player.id === match.league_entry_2,
                );

                // Use nullish coalescing operator to handle possible null values
                const homePoints = match.league_entry_1_points ?? 0;
                const awayPoints = match.league_entry_2_points ?? 0;

                return {
                  home_player_name: homePlayer
                    ? `${homePlayer.player_name}`
                    : 'Unknown',
                  away_player_name: awayPlayer
                    ? `${awayPlayer.player_name}`
                    : 'Unknown',
                  home_player_points: match.league_entry_1_points,
                  away_player_points: match.league_entry_2_points,
                  event: match.event,
                  home_wins: homePoints > awayPoints,
                  away_wins: awayPoints > homePoints,
                };
              });

              return (
                <div key={eventKey} className='mb-20'>
                  <h2 className='pb-3 text-lg font-medium text-white'>{`GW ${eventKey} Results`}</h2>
                  <table className='w-[300px] text-sm font-light text-white md:w-full'>
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
                          <td
                            className={`py-4 ${match.home_wins ? 'font-bold' : ''}`}
                          >{`${match.home_player_name} (${match.home_player_points})`}</td>
                          <td className='py-4'>vs.</td>
                          <td
                            className={`py-4 ${match.away_wins ? 'font-bold' : ''}`}
                          >{`${match.away_player_name} (${match.away_player_points})`}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            })}
          </div>
          {/* Navigation Buttons */}
          <div className='mt-4 flex justify-between gap-x-5 pt-10'>
            {currentPosition > 0 && (
              <button
                onClick={handleSeeNewer}
                className='min-w-[9rem] rounded-lg border-2 border-premPurple bg-gradient-to-r from-premGreen to-premTurquoise px-7 py-3 text-sm shadow-2xl duration-500'
              >
                See Newer
              </button>
            )}
            {endIndex < sortedEventKeys.length && (
              <button
                onClick={handleSeeOlder}
                className='min-w-[9rem] rounded-lg border-2 border-premPurple bg-gradient-to-r from-premGreen to-premTurquoise px-7 py-3 text-sm shadow-2xl duration-500'
              >
                See Older
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

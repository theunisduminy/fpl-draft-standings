'use client';
import React, { useState, useEffect } from 'react';
import { PlayerDetails } from '@/interfaces/players';
import { Match } from '@/interfaces/match';
import { fetchWithDelay } from '@/utils/fetchWithDelay';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner } from '@fortawesome/free-solid-svg-icons';

export default function AllGameWeekResults() {
  const [standings, setStandings] = useState<PlayerDetails[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [currentPosition, setCurrentPosition] = useState(0); // Track the current position in the list of game weeks
  const [loading, setLoading] = useState(true); // Add loading state
  const resultsPerPage = 5; // Number of game weeks to show per page

  useEffect(() => {
    async function fetchData() {
      const [standingsData, matchesData] = (await fetchWithDelay(['standings', 'matches'])) as [
        PlayerDetails[],
        Match[],
      ];
      setStandings(standingsData);
      setMatches(matchesData);
      setLoading(false); // Data received, set loading to false
    }

    fetchData();
  }, []);

  // Filter matches to include only those that are finished
  const finishedMatches = matches.filter((match) => match.finished);

  // Group finished matches by event (Game Week)
  const matchesByEvent = finishedMatches.reduce((acc, match) => {
    if (!acc[match.event]) {
      acc[match.event] = [];
    }
    acc[match.event].push(match);
    return acc;
  }, {} as Record<number, Match[]>);

  // Sort Game Week numbers in descending order
  const sortedEventKeys = Object.keys(matchesByEvent)
    .map(Number)
    .sort((a, b) => b - a);

  // Determine the range of events to display based on the current position
  const startIndex = currentPosition;
  const endIndex = Math.min(startIndex + resultsPerPage, sortedEventKeys.length);
  const visibleEvents = sortedEventKeys.slice(startIndex, endIndex);

  // Function to handle the "See Older" button click
  const handleSeeOlder = () => {
    setCurrentPosition((prevPosition) =>
      Math.min(prevPosition + resultsPerPage, sortedEventKeys.length - resultsPerPage),
    );
  };

  // Function to handle the "See Newer" button click
  const handleSeeNewer = () => {
    setCurrentPosition((prevPosition) => Math.max(prevPosition - resultsPerPage, 0));
  };

  return (
    <div className='flex flex-col justify-center items-center'>
      <h1 className='text-[#310639] text-2xl pb-5 font-semibold animate-fade-up'>
        Head-to-Head Results
      </h1>
      {loading ? (
        <FontAwesomeIcon className='animate-spin text-6xl text-blue-500' icon={faSpinner} />
      ) : (
        <>
          {/* Navigation Buttons */}
          <div className='flex justify-between mt-4 gap-x-5 pb-10'>
            {currentPosition > 0 && (
              <button
                onClick={handleSeeNewer}
                className='px-7 py-3 border-2 rounded-lg text-sm shadow-2xl min-w-[9rem] border-premPurple duration-500 bg-gradient-to-r to-premTurquoise from-premGreen'
              >
                See Newer
              </button>
            )}
            {endIndex < sortedEventKeys.length && (
              <button
                onClick={handleSeeOlder}
                className='px-7 py-3 border-2 rounded-lg text-sm shadow-2xl min-w-[9rem] border-premPurple duration-500 bg-gradient-to-r to-premTurquoise from-premGreen'
              >
                See Older
              </button>
            )}
          </div>
          <div className='w-full sm:w-[450px] bg-gradient-to-r from-cyan-600 to-blue-500 p-8 rounded-lg shadow-2xl border-2 border-black'>
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
                  home_player_name: homePlayer ? `${homePlayer.player_name}` : 'Unknown',
                  away_player_name: awayPlayer ? `${awayPlayer.player_name}` : 'Unknown',
                  home_player_points: match.league_entry_1_points,
                  away_player_points: match.league_entry_2_points,
                  event: match.event,
                  home_wins: homePoints > awayPoints,
                  away_wins: awayPoints > homePoints,
                };
              });

              return (
                <div key={eventKey} className='mb-20'>
                  <h2 className='text-white text-lg pb-3 font-medium'>{`GW ${eventKey} Results`}</h2>
                  <table className='text-white font-light w-[300px] md:w-full text-sm'>
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
          <div className='flex justify-between mt-4 gap-x-5 pt-10'>
            {currentPosition > 0 && (
              <button
                onClick={handleSeeNewer}
                className='px-7 py-3 border-2 rounded-lg text-sm shadow-2xl min-w-[9rem] border-premPurple duration-500 bg-gradient-to-r to-premTurquoise from-premGreen'
              >
                See Newer
              </button>
            )}
            {endIndex < sortedEventKeys.length && (
              <button
                onClick={handleSeeOlder}
                className='px-7 py-3 border-2 rounded-lg text-sm shadow-2xl min-w-[9rem] border-premPurple duration-500 bg-gradient-to-r to-premTurquoise from-premGreen'
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

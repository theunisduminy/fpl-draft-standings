// utils/calculatePositions.ts
import { Match } from '@/interfaces/match';
import { PlayerDetails } from '@/interfaces/players';

export function calculatePositions(
  matches: Match[],
  players: PlayerDetails[],
): void {
  const positionCounts: { [key: number]: { [key: string]: number } } = {};

  // Initialize position counts for each player
  players.forEach((player) => {
    positionCounts[player.id] = {
      first: 0,
      second: 0,
      third: 0,
      fourth: 0,
      fifth: 0,
      sixth: 0,
      seventh: 0,
      eighth: 0,
    };
  });

  // Iterate through each event
  const events = Array.from(new Set(matches.map((match) => match.event)));

  events.forEach((event) => {
    // Gather all matches for the current event
    const eventMatches = matches.filter((m) => m.event === event && m.finished);

    // Skip events with no finished matches (start of season)
    if (eventMatches.length === 0) {
      return;
    }

    // Combine and sort players by points within the event
    const sortedPlayers = eventMatches
      .map((m) => [
        { id: m.league_entry_1, points: m.league_entry_1_points },
        { id: m.league_entry_2, points: m.league_entry_2_points },
      ])
      .flat()
      .reduce(
        (acc, curr) => {
          // Sum points for each player
          if (!acc[curr.id]) {
            acc[curr.id] = curr.points;
          } else {
            acc[curr.id] += curr.points;
          }
          return acc;
        },
        {} as { [key: number]: number },
      );

    // Convert to array and sort by points descending
    const rankedPlayers = Object.entries(sortedPlayers)
      .map(([id, points]) => ({ id: Number(id), points }))
      .sort((a, b) => b.points - a.points);

    // Assign positions based on sorted rankings
    let currentRank = 1;
    rankedPlayers.forEach((entry, index) => {
      if (
        index > 0 &&
        rankedPlayers[index].points < rankedPlayers[index - 1].points
      ) {
        currentRank = index + 1;
      }
      switch (currentRank) {
        case 1:
          positionCounts[entry.id].first += 1;
          break;
        case 2:
          positionCounts[entry.id].second += 1;
          break;
        case 3:
          positionCounts[entry.id].third += 1;
          break;
        case 4:
          positionCounts[entry.id].fourth += 1;
          break;
        case 5:
          positionCounts[entry.id].fifth += 1;
          break;
        case 6:
          positionCounts[entry.id].sixth += 1;
          break;
        case 7:
          positionCounts[entry.id].seventh += 1;
          break;
        case 8:
          positionCounts[entry.id].eighth += 1;
          break;
        default:
          break;
      }
    });
  });

  // Assign position counts back to players
  players.forEach((player) => {
    player.position_placed = positionCounts[player.id];
  });
}

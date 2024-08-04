import { Match } from '@/interfaces/match';
import { PlayerDetails } from '@/interfaces/players';
import { PlayerScores } from '@/interfaces/match';

export function calculateCustomStandings(
  matches: Match[],
  playerDetails: PlayerDetails[],
): PlayerDetails[] {
  const playerMap: { [id: number]: PlayerScores } = {};

  playerDetails.forEach((player) => {
    playerMap[player.id] = {
      rank_points: 0,
      win_points: 0,
      total: 0,
      total_wins: 0,
      total_losses: 0,
      total_draws: 0,
    };
  });

  const events = Array.from(new Set(matches.map((match) => match.event)));

  // Define points for ranks 1 to 8
  const rankPoints = [20, 15, 12, 10, 8, 6, 4, 0];

  events.forEach((event) => {
    const eventMatches = matches.filter((match) => match.event === event);
    const points: [number, number][] = [];

    eventMatches.forEach((match) => {
      if (match.league_entry_1_points > match.league_entry_2_points) {
        playerMap[match.league_entry_1].win_points += 10;
        playerMap[match.league_entry_1].total_wins += 1;
        playerMap[match.league_entry_2].total_losses += 1;
      } else if (match.league_entry_1_points < match.league_entry_2_points) {
        playerMap[match.league_entry_2].win_points += 10;
        playerMap[match.league_entry_2].total_wins += 1;
        playerMap[match.league_entry_1].total_losses += 1;
      } else {
        // If the match is a draw
        playerMap[match.league_entry_1].total_draws += 1;
        playerMap[match.league_entry_2].total_draws += 1;
      }
      points.push([match.league_entry_1, match.league_entry_1_points]);
      points.push([match.league_entry_2, match.league_entry_2_points]);
    });

    // Sort players by points in descending order
    points.sort((a, b) => b[1] - a[1]);

    let currentRank = 1;
    for (let i = 0; i < points.length; ) {
      const [playerId, playerPoints] = points[i];
      let j = i + 1;
      while (j < points.length && points[j][1] === playerPoints) {
        j++;
      }

      // Assign the highest rank points to all tied players
      const highestRankPoints = rankPoints[currentRank - 1];

      for (let k = i; k < j; k++) {
        const [pId] = points[k];
        playerMap[pId].rank_points += highestRankPoints;
      }

      currentRank += j - i;
      i = j;
    }
  });

  Object.keys(playerMap).forEach((playerId) => {
    const scores = playerMap[+playerId];
    scores.total = scores.rank_points + scores.win_points;
  });

  return playerDetails.map((player) => ({
    ...player,
    f1_score: playerMap[player.id].total,
    total_wins: playerMap[player.id].total_wins,
    total_losses: playerMap[player.id].total_losses,
    total_draws: playerMap[player.id].total_draws,
  }));
}

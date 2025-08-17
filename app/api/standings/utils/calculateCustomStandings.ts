import { PlayerDetails } from '@/interfaces/players';
import { PlayerScores } from '@/interfaces/match';

// Interface for gameweek performance data (matching the updated matches API)
interface GameweekPerformance {
  event: number;
  league_entry: number;
  event_total: number;
  rank: number;
  finished: boolean;
}

// Helper function to get gameweek performance data from the matches API
async function fetchGameweekPerformances(): Promise<GameweekPerformance[]> {
  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/matches`,
      {
        next: {
          revalidate: 3600, // 1 hour
        },
      },
    );
    return await res.json();
  } catch (err) {
    console.error('Error fetching gameweek performances:', err);
    return [];
  }
}

export async function calculateCustomStandings(
  playerDetails: PlayerDetails[],
): Promise<PlayerDetails[]> {
  // Get gameweek performance data
  const gameweekData = await fetchGameweekPerformances();

  const playerMap: { [id: number]: PlayerScores } = {};

  playerDetails.forEach((player) => {
    playerMap[player.id] = {
      rank_points: 0,
      win_points: 0, // Always 0 in Classic format
      total: 0,
      total_wins: 0, // Count of 1st place finishes
      total_losses: 0, // Count of 8th place finishes
      total_draws: 0, // Always 0 in Classic format
    };
  });

  // Define F1 points for ranks 1 to 8
  const rankPoints = [20, 15, 12, 10, 8, 6, 4, 2];

  // Group gameweek data by event and calculate F1 points
  const gameweeksByEvent: Record<number, GameweekPerformance[]> = {};
  gameweekData.forEach((gw) => {
    if (gw.finished) {
      if (!gameweeksByEvent[gw.event]) {
        gameweeksByEvent[gw.event] = [];
      }
      gameweeksByEvent[gw.event].push(gw);
    }
  });

  // Calculate F1 points for each completed gameweek
  Object.values(gameweeksByEvent).forEach((gameweekPerformances) => {
    gameweekPerformances.forEach((performance) => {
      const playerId = performance.league_entry;
      const rank = performance.rank;

      if (playerMap[playerId] && rank >= 1 && rank <= 8) {
        // Add F1 points based on rank
        playerMap[playerId].rank_points += rankPoints[rank - 1] || 0;

        // Count wins (1st place) and losses (8th place) for display
        if (rank === 1) {
          playerMap[playerId].total_wins += 1;
        } else if (rank === 8) {
          playerMap[playerId].total_losses += 1;
        }
      }
    });
  });

  // Calculate total F1 score (only rank points in Classic format)
  Object.keys(playerMap).forEach((playerId) => {
    const scores = playerMap[+playerId];
    scores.total = scores.rank_points; // No win_points in Classic format
  });

  return playerDetails.map((player) => ({
    ...player,
    f1_score: playerMap[player.id].total,
    total_wins: playerMap[player.id].total_wins,
    total_losses: playerMap[player.id].total_losses,
    total_draws: playerMap[player.id].total_draws,
  }));
}

import { NextResponse } from 'next/server';
import { fetchData } from '../standings/utils/fetchData';

// Interface for gameweek performance data (matching the updated matches API)
interface GameweekPerformance {
  event: number;
  league_entry: number;
  event_total: number;
  rank: number;
  finished: boolean;
}

type LeagueEntry = {
  id: number;
  entry_name: string;
  player_first_name: string;
  player_last_name: string;
};

type LowestScore = {
  points: number;
  entry_names: string[];
  player_names: string[];
};

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

export const GET = async (req: Request, res: Response) => {
  try {
    // Fetch data from both endpoints
    const [{ league_entries }, gameweekData] = await Promise.all([
      fetchData(),
      fetchGameweekPerformances(),
    ]);

    // Prepare to store the lowest score for each Gameweek
    const lowestScoresByGW: Record<number, LowestScore> = {};

    // Group gameweek data by event (gameweek)
    const gameweeksByEvent: Record<number, GameweekPerformance[]> = {};
    gameweekData.forEach((gw) => {
      if (gw.finished) {
        if (!gameweeksByEvent[gw.event]) {
          gameweeksByEvent[gw.event] = [];
        }
        gameweeksByEvent[gw.event].push(gw);
      }
    });

    // Find the lowest scorer(s) for each completed gameweek
    Object.entries(gameweeksByEvent).forEach(
      ([eventStr, gameweekPerformances]) => {
        const event = parseInt(eventStr, 10);

        // Find the minimum points for this gameweek
        const minPoints = Math.min(
          ...gameweekPerformances.map((gw) => gw.event_total),
        );

        // Find all players who scored the minimum points
        const rumblers = gameweekPerformances.filter(
          (gw) => gw.event_total === minPoints,
        );

        // Get player details for the rumblers
        const rumblerDetails = rumblers.map((rumbler) => {
          const player = league_entries.find(
            (entry) => entry.id === rumbler.league_entry,
          );
          return {
            entry_name: player ? player.entry_name : 'Unknown',
            player_name: player ? player.player_first_name : 'Unknown',
          };
        });

        lowestScoresByGW[event] = {
          points: minPoints,
          entry_names: rumblerDetails.map((r) => r.entry_name),
          player_names: rumblerDetails.map((r) => r.player_name),
        };
      },
    );

    // Convert the lowestScoresByGW object into an array for the response
    const lowestScoresArray = Object.entries(lowestScoresByGW)
      .map(([gw, data]) => ({
        gameweek: parseInt(gw, 10),
        ...data,
      }))
      .sort((a, b) => b.gameweek - a.gameweek); // Sort by gameweek descending

    // Return the lowest scores for each completed GW
    return NextResponse.json(lowestScoresArray);
  } catch (error) {
    console.error('Error in rumbler API:', error);
    return NextResponse.json(
      { message: (error as Error).message },
      { status: 500 },
    );
  }
};

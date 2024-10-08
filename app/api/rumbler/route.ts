import { NextResponse } from 'next/server';
import { fetchData } from '../standings/utils/fetchData';

type Match = {
  event: number;
  league_entry_1: number;
  league_entry_1_points: number;
  league_entry_2: number;
  league_entry_2_points: number;
  finished: boolean;
};

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

export const GET = async (req: Request, res: Response) => {
  try {
    // Fetch data from the endpoint
    const {
      matches,
      league_entries,
    }: { matches: Match[]; league_entries: LeagueEntry[] } = await fetchData();

    // Prepare to store the lowest score for each Gameweek
    const lowestScoresByGW: Record<number, LowestScore> = {};

    // Iterate over matches to determine the lowest score for each completed GW
    matches.forEach((match) => {
      const {
        event,
        league_entry_1,
        league_entry_1_points,
        league_entry_2,
        league_entry_2_points,
        finished,
      } = match;

      // Only consider matches that are finished
      if (!finished) {
        return;
      }

      // Check if the GW is already in the lowestScoresByGW object, if not initialize it
      if (!lowestScoresByGW[event]) {
        lowestScoresByGW[event] = {
          points: Infinity,
          entry_names: [],
          player_names: [],
        };
      }

      // Compare league_entry_1 points with the current lowest
      if (league_entry_1_points < lowestScoresByGW[event].points) {
        const player = league_entries.find(
          (entry) => entry.id === league_entry_1,
        );
        if (player) {
          lowestScoresByGW[event] = {
            points: league_entry_1_points,
            entry_names: [player.entry_name],
            player_names: [`${player.player_first_name}`],
          };
        }
      } else if (league_entry_1_points === lowestScoresByGW[event].points) {
        const player = league_entries.find(
          (entry) => entry.id === league_entry_1,
        );
        if (player) {
          lowestScoresByGW[event].entry_names.push(player.entry_name);
          lowestScoresByGW[event].player_names.push(
            `${player.player_first_name}`,
          );
        }
      }

      // Compare league_entry_2 points with the current lowest
      if (league_entry_2_points < lowestScoresByGW[event].points) {
        const player = league_entries.find(
          (entry) => entry.id === league_entry_2,
        );
        if (player) {
          lowestScoresByGW[event] = {
            points: league_entry_2_points,
            entry_names: [player.entry_name],
            player_names: [`${player.player_first_name}`],
          };
        }
      } else if (league_entry_2_points === lowestScoresByGW[event].points) {
        const player = league_entries.find(
          (entry) => entry.id === league_entry_2,
        );
        if (player) {
          lowestScoresByGW[event].entry_names.push(player.entry_name);
          lowestScoresByGW[event].player_names.push(
            `${player.player_first_name}`,
          );
        }
      }
    });

    // Convert the lowestScoresByGW object into an array for the response, including only completed GWs
    const lowestScoresArray = Object.entries(lowestScoresByGW)
      .filter(([_, data]) => data.points !== Infinity) // Filter out incomplete GWs
      .map(([gw, data]) => {
        return {
          gameweek: parseInt(gw, 10),
          ...data,
        };
      });

    // Return the lowest scores for each completed GW
    return NextResponse.json(lowestScoresArray);
  } catch (error) {
    return NextResponse.json(
      { message: (error as Error).message },
      { status: 500 },
    );
  }
};

import { NextResponse } from 'next/server';
import { fetchData } from './utils/fetchData';
import { createPlayersObject } from './utils/createPlayersObject';
import { calculateCustomStandings } from './utils/calculateCustomStandings';
import { sortPlayersObject } from './utils/sortPlayersObject';

export const GET = async (req: Request, res: Response) => {
  try {
    const data = await fetchData();

    // Extract data with fallbacks for missing properties
    const league_entries = data.league_entries || [];
    const standings = data.standings || [];

    // Create player objects
    const playerDetails = createPlayersObject(league_entries);

    // Calculate custom standings (now async and uses gameweek performance data)
    const customStandings = await calculateCustomStandings(playerDetails);

    // Sort players based on standings and custom calculations
    const rankedPlayers = sortPlayersObject(standings, customStandings);

    // Sort by F1 score (primary ranking) and assign F1 ranking
    rankedPlayers.sort((a, b) => (b.f1_score || 0) - (a.f1_score || 0));
    rankedPlayers.forEach((player, index) => {
      player.f1_ranking = index + 1;
    });

    // Return the F1 standings with all players (sorted by F1 score)
    return NextResponse.json(rankedPlayers);
  } catch (error) {
    console.error('Error in standings API:', error);
    return NextResponse.json({ message: error }, { status: 500 });
  }
};

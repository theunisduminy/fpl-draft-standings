import { NextResponse } from 'next/server';
import { fetchData } from './utils/fetchData';
import { createPlayersObject } from './utils/createPlayersObject';
import { calculateCustomStandings } from './utils/calculateCustomStandings';
import { calculatePositions } from './utils/calculatePosition';
import { sortPlayersObject } from './utils/sortPlayersObject';

export const GET = async (req: Request, res: Response) => {
  try {
    const { matches, league_entries, standings } = await fetchData();

    // Create player objects
    const playerDetails = createPlayersObject(league_entries);

    // Calculate position placements
    calculatePositions(matches, playerDetails);

    // Calculate custom standings
    const customStandings = calculateCustomStandings(matches, playerDetails);

    // Sort players based on standings and custom calculations
    const rankedPlayers = sortPlayersObject(standings, customStandings);

    // Sort by F1 score and assign F1 ranking
    rankedPlayers.sort((a, b) => (b.f1_score || 0) - (a.f1_score || 0)); // Ensure sorting comparison with defaults
    rankedPlayers.forEach((player, index) => {
      player.f1_ranking = index + 1;
    });

    // Return the F1 standings with the top 8 players
    const topPlayers = rankedPlayers.slice(0, 8);

    return NextResponse.json(topPlayers);
  } catch (error) {
    return NextResponse.json({ message: error }, { status: 500 });
  }
};

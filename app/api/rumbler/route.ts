import { NextResponse } from 'next/server';

// Force dynamic rendering for this API route
export const dynamic = 'force-dynamic';

export const GET = async (req: Request, res: Response) => {
  try {
    // Fetch the basic league data directly
    const leagueRes = await fetch(
      'https://draft.premierleague.com/api/league/75224/details',
      { cache: 'no-store' },
    );
    const { league_entries } = await leagueRes.json();

    // Fetch matches data directly with no cache
    const matchesRes = await fetch(
      `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/matches`,
      { cache: 'no-store' },
    );
    const gameweekData = await matchesRes.json();

    // Group by gameweek
    const gameweeksByEvent: Record<number, any[]> = {};
    gameweekData.forEach((gw: any) => {
      if (gw.finished) {
        if (!gameweeksByEvent[gw.event]) {
          gameweeksByEvent[gw.event] = [];
        }
        gameweeksByEvent[gw.event].push(gw);
      }
    });

    const results: any[] = [];

    // Process each gameweek
    Object.entries(gameweeksByEvent).forEach(([eventStr, performances]) => {
      const event = parseInt(eventStr, 10);

      // Find the worst rank (highest number = 8th place)
      const worstRank = Math.max(...performances.map((p) => p.rank));

      // Get all players with the worst rank
      const rumblers = performances.filter((p) => p.rank === worstRank);

      // Get player details
      const rumblerDetails = rumblers.map((rumbler) => {
        const player = league_entries.find(
          (entry: { id: number }) => entry.id === rumbler.league_entry,
        );
        return {
          points: rumbler.event_total,
          entry_name: player?.entry_name || 'Unknown',
          player_name: player?.player_first_name || 'Unknown',
        };
      });

      results.push({
        gameweek: event,
        points: rumblerDetails[0]?.points || 0,
        entry_names: rumblerDetails.map((r) => r.entry_name),
        player_names: rumblerDetails.map((r) => r.player_name),
      });
    });

    // Sort by gameweek descending
    results.sort((a, b) => b.gameweek - a.gameweek);

    return NextResponse.json(results);
  } catch (error) {
    console.error('Error in rumbler API:', error);
    return NextResponse.json(
      { message: (error as Error).message },
      { status: 500 },
    );
  }
};

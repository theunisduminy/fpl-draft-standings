import { NextResponse } from 'next/server';

// Force dynamic rendering for this API route
export const dynamic = 'force-dynamic';

export const GET = async (req: Request, res: Response) => {
  try {
    // Fetch data directly from FPL API to avoid internal API call issues in production
    const [leagueRes, statusRes] = await Promise.all([
      fetch('https://draft.premierleague.com/api/league/75224/details', {
        cache: 'no-store',
      }),
      fetch('https://draft.premierleague.com/api/pl/event-status', {
        cache: 'no-store',
      }),
    ]);

    const leagueData = await leagueRes.json();
    const statusData = await statusRes.json();

    const { league_entries, standings } = leagueData;
    const { status } = statusData;

    const gameweekData: any[] = [];

    // Get current gameweek data (from league details)
    const currentEvent = status.find((s: any) => s.points === 'r')?.event || 1;
    const isCurrentFinished =
      status.find((s: any) => s.event === currentEvent)?.leagues_updated ||
      false;

    // Add current gameweek data with correct rankings based on event_total
    const currentGameweekData = standings.map((standing: any) => ({
      league_entry: standing.league_entry,
      event_total: standing.event_total,
      finished: isCurrentFinished,
    }));

    // Sort by event_total to determine correct ranks for current gameweek
    currentGameweekData.sort((a: number, b: number) => b - a);

    // Add ranks with proper tie handling for current gameweek
    let currentRank = 1;
    for (let i = 0; i < currentGameweekData.length; i++) {
      // If this player has the same score as the previous, give same rank
      if (
        i > 0 &&
        currentGameweekData[i].event_total ===
          currentGameweekData[i - 1].event_total
      ) {
        // Keep the same rank as previous player
      } else {
        // New rank position
        currentRank = i + 1;
      }

      gameweekData.push({
        event: currentEvent,
        league_entry: currentGameweekData[i].league_entry,
        event_total: currentGameweekData[i].event_total,
        rank: currentRank,
        finished: currentGameweekData[i].finished,
      });
    }

    // Reconstruct gameweek 1 data from cumulative totals
    // Since total = gw1 + gw2, we can calculate: gw1 = total - event_total
    if (currentEvent > 1) {
      // Create gameweek 1 data by calculating backwards from current totals
      const gameweek1Data = standings.map((standing: any) => ({
        league_entry: standing.league_entry,
        event_total: standing.total - standing.event_total, // GW1 points = total - current GW points
        finished: true,
      }));

      // Sort by event_total to determine ranks for gameweek 1
      gameweek1Data.sort((a: number, b: number) => b - a);

      // Add ranks with proper tie handling and push to gameweek data
      let currentRank = 1;
      for (let i = 0; i < gameweek1Data.length; i++) {
        // If this player has the same score as the previous, give same rank
        if (
          i > 0 &&
          gameweek1Data[i].event_total === gameweek1Data[i - 1].event_total
        ) {
          // Keep the same rank as previous player
        } else {
          // New rank position
          currentRank = i + 1;
        }

        gameweekData.push({
          event: 1,
          league_entry: gameweek1Data[i].league_entry,
          event_total: gameweek1Data[i].event_total,
          rank: currentRank,
          finished: true,
        });
      }
    }

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

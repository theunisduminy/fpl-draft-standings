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

    // Add current gameweek data
    standings.forEach((standing: any) => {
      gameweekData.push({
        event: currentEvent,
        league_entry: standing.league_entry,
        event_total: standing.event_total,
        rank: standing.rank,
        finished: isCurrentFinished,
      });
    });

    // Get all completed events (excluding current)
    const completedEvents = status
      .filter(
        (s: any) => s.leagues_updated === true && s.event !== currentEvent,
      )
      .map((s: any) => s.event);

    // Fetch historical data for each completed gameweek
    for (const event of completedEvents) {
      try {
        const gameweekRes = await fetch(
          `https://draft.premierleague.com/api/league/75224/element-status?event=${event}`,
          { cache: 'no-store' },
        );

        if (gameweekRes.ok) {
          const gameweekStandings = await gameweekRes.json();

          gameweekStandings.forEach((standing: any) => {
            gameweekData.push({
              event: event,
              league_entry: standing.league_entry,
              event_total: standing.event_total,
              rank: standing.rank,
              finished: true,
            });
          });
        }
      } catch (err) {
        console.warn(`Failed to fetch gameweek ${event} data:`, err);
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

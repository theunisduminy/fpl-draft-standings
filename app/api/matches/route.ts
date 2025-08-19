import { NextResponse } from 'next/server';

// Force dynamic rendering for this API route
export const dynamic = 'force-dynamic';

// Matches API - returns performance data for all completed gameweeks
export const GET = async (req: Request, res: Response) => {
  try {
    // Get FPL data directly
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

    const { standings } = leagueData;
    const { status } = statusData;

    const results: any[] = [];

    // Get current gameweek data (from league details)
    const currentEvent = status.find((s: any) => s.points === 'r')?.event || 1;
    const isCurrentFinished =
      status.find((s: any) => s.event === currentEvent)?.leagues_updated ||
      false;

    // Add current gameweek data
    standings.forEach((standing: any) => {
      results.push({
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
            results.push({
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

    return NextResponse.json(results);
  } catch (error) {
    console.error('Error in matches API:', error);
    return NextResponse.json({ message: error }, { status: 500 });
  }
};

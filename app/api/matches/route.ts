import { NextResponse } from 'next/server';

// Simplified matches API - returns current gameweek performance
export const GET = async (req: Request, res: Response) => {
  try {
    // Get FPL data directly
    const [leagueRes, statusRes] = await Promise.all([
      fetch('https://draft.premierleague.com/api/league/75224/details', { cache: 'no-store' }),
      fetch('https://draft.premierleague.com/api/pl/event-status', { cache: 'no-store' })
    ]);

    const leagueData = await leagueRes.json();
    const statusData = await statusRes.json();

    const { standings } = leagueData;
    const { status } = statusData;

    // Get current gameweek
    const currentEvent = status.find((s: any) => s.points === 'r')?.event || 1;
    const isFinished = status.find((s: any) => s.event === currentEvent)?.leagues_updated || false;

    // Return current gameweek performance data
    const results = standings.map((standing: any) => ({
      event: currentEvent,
      league_entry: standing.league_entry,
      event_total: standing.event_total,
      rank: standing.rank,
      finished: isFinished,
    }));

    return NextResponse.json(results);
  } catch (error) {
    console.error('Error in matches API:', error);
    return NextResponse.json({ message: error }, { status: 500 });
  }
};
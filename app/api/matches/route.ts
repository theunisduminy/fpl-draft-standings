import { NextResponse } from 'next/server';

// Interface for gameweek performance data (replacing matches)
interface GameweekPerformance {
  event: number;
  league_entry: number;
  event_total: number;
  rank: number;
  finished: boolean;
}

async function fetchLeagueData(): Promise<{
  league_entries: any[];
  standings: any[];
}> {
  try {
    const res = await fetch(
      'https://draft.premierleague.com/api/league/75224/details',
      {
        next: {
          revalidate: 3600, // 1 hour
        },
      },
    );
    return await res.json();
  } catch (err) {
    console.error(err);
    throw err;
  }
}

async function fetchCurrentEventStatus(): Promise<{ status: any[] }> {
  try {
    const res = await fetch(
      'https://draft.premierleague.com/api/pl/event-status',
      {
        next: {
          revalidate: 3600, // 1 hour
        },
      },
    );
    return await res.json();
  } catch (err) {
    console.error(err);
    throw err;
  }
}

export const GET = async (req: Request, res: Response) => {
  try {
    const [leagueData, eventStatus] = await Promise.all([
      fetchLeagueData(),
      fetchCurrentEventStatus(),
    ]);

    const { league_entries, standings } = leagueData;
    const { status } = eventStatus;

    // Get current gameweek
    const currentEvent = status.find((s) => s.points === 'r')?.event || 1;

    // Create gameweek performance data for Classic format
    // Since we only have current standings, we'll simulate historical data structure
    const gameweekPerformances: GameweekPerformance[] = [];

    // For now, we'll create data for completed gameweeks (where points are finalized)
    const completedEvents = status
      .filter((s) => s.points === 'r' || s.leagues_updated)
      .map((s) => s.event);

    completedEvents.forEach((event) => {
      standings.forEach((standing) => {
        gameweekPerformances.push({
          event: event,
          league_entry: standing.league_entry,
          event_total: standing.event_total,
          rank: standing.rank,
          finished: true,
        });
      });
    });

    // Add current gameweek if it's in progress
    if (!completedEvents.includes(currentEvent)) {
      standings.forEach((standing) => {
        gameweekPerformances.push({
          event: currentEvent,
          league_entry: standing.league_entry,
          event_total: standing.event_total,
          rank: standing.rank,
          finished: false,
        });
      });
    }

    return NextResponse.json(gameweekPerformances);
  } catch (error) {
    console.error('Error in matches API:', error);
    return NextResponse.json({ message: error }, { status: 500 });
  }
};

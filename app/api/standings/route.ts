import { NextResponse } from 'next/server';

// Force dynamic rendering for this API route
export const dynamic = 'force-dynamic';

// Enhanced standings API with cumulative data and gameweek filtering
export const GET = async (req: Request, res: Response) => {
  try {
    const url = new URL(req.url);
    const gameweekFilter = url.searchParams.get('gameweek');
    const upToGameweek = gameweekFilter ? parseInt(gameweekFilter, 10) : null;

    // 1. Get current league data and status
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

    // 2. Get current gameweek
    const currentEvent = status.find((s: any) => s.points === 'r')?.event || 1;
    const maxGameweek = upToGameweek || currentEvent;

    // 3. Collect all gameweek data
    const allGameweekData: any[] = [];

    // Add current gameweek data
    const isCurrentFinished =
      status.find((s: any) => s.event === currentEvent)?.leagues_updated ||
      false;

    if (currentEvent <= maxGameweek) {
      standings.forEach((standing: any) => {
        allGameweekData.push({
          event: currentEvent,
          league_entry: standing.league_entry,
          event_total: standing.event_total,
          rank: standing.rank,
          finished: isCurrentFinished,
        });
      });
    }

    // Reconstruct gameweek 1 data from cumulative totals
    // Since total = gw1 + gw2, we can calculate: gw1 = total - event_total
    if (currentEvent > 1 && 1 <= maxGameweek) {
      // Create gameweek 1 data by calculating backwards from current totals
      const gameweek1Data = standings.map((standing: any) => ({
        league_entry: standing.league_entry,
        event_total: standing.total - standing.event_total, // GW1 points = total - current GW points
        finished: true,
      }));

      // Sort by event_total to determine ranks for gameweek 1
      gameweek1Data.sort((a: number, b: number) => b - a);

      // Add ranks with proper tie handling and push to allGameweekData
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

        allGameweekData.push({
          event: 1,
          league_entry: gameweek1Data[i].league_entry,
          event_total: gameweek1Data[i].event_total,
          rank: currentRank,
          finished: true,
        });
      }
    }

    // 4. Calculate cumulative metrics for each player
    const playerMetrics: Record<number, any> = {};
    const rankPoints = [20, 15, 12, 10, 8, 6, 4, 2];

    // Initialize player data
    league_entries.forEach((entry: any) => {
      playerMetrics[entry.id] = {
        id: entry.id,
        player_name: entry.player_first_name || 'Unknown',
        player_surname: entry.player_last_name || 'Unknown',
        team_name: entry.entry_name || 'Unknown',
        total_points: 0,
        f1_score: 0,
        f1_ranking: 0,
        total_wins: 0,
        position_placed: {
          first: 0,
          second: 0,
          third: 0,
          fourth: 0,
          fifth: 0,
          sixth: 0,
          seventh: 0,
          eighth: 0,
        },
      };
    });

    // Accumulate data from all gameweeks
    allGameweekData
      .filter((gw) => gw.finished) // Only include finished gameweeks
      .forEach((gameweek) => {
        const player = playerMetrics[gameweek.league_entry];
        if (player) {
          // Add F1 points for this gameweek
          const f1Points = rankPoints[gameweek.rank - 1] || 0;
          player.f1_score += f1Points;

          // Count wins and position placements
          if (gameweek.rank === 1) player.total_wins++;

          // Update position counts
          const positions = [
            'first',
            'second',
            'third',
            'fourth',
            'fifth',
            'sixth',
            'seventh',
            'eighth',
          ];
          if (gameweek.rank >= 1 && gameweek.rank <= 8) {
            player.position_placed[positions[gameweek.rank - 1]]++;
          }
        }
      });

    // 5. Get total points from current standings (these are cumulative)
    standings.forEach((standing: any) => {
      const player = playerMetrics[standing.league_entry];
      if (player) {
        player.total_points = standing.total;
      }
    });

    // 6. Convert to array and sort by F1 score
    const results = Object.values(playerMetrics);
    results.sort((a: any, b: any) => b.f1_score - a.f1_score);

    // Set F1 rankings
    results.forEach((player: any, index: number) => {
      player.f1_ranking = index + 1;
    });

    return NextResponse.json(results);
  } catch (error) {
    console.error('Error in standings API:', error);
    return NextResponse.json({ message: error }, { status: 500 });
  }
};

import { NextResponse } from 'next/server';

// Force dynamic rendering for this API route
export const dynamic = 'force-dynamic';

// Interface for gameweek performance data (matching the updated matches API)
interface GameweekPerformance {
  event: number;
  league_entry: number;
  event_total: number;
  rank: number;
  finished: boolean;
}

// Helper function to get gameweek performance data directly from FPL API
async function fetchGameweekPerformances(): Promise<GameweekPerformance[]> {
  try {
    // Fetch data directly from FPL API to avoid internal API call issues
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

    const gameweekData: GameweekPerformance[] = [];

    // Get current gameweek data
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

    return gameweekData;
  } catch (err) {
    console.error('Error fetching gameweek performances:', err);
    return [];
  }
}

// Helper function to calculate player performance over gameweeks for Classic format
function calculatePerformanceOverTime(
  gameweekData: GameweekPerformance[],
  playerId: number,
) {
  return gameweekData
    .filter((gw) => gw.league_entry === playerId && gw.finished)
    .map((gw) => ({
      gameweek: gw.event,
      points: gw.event_total,
      rank: gw.rank,
    }))
    .sort((a, b) => a.gameweek - b.gameweek);
}

// Helper function to find best and worst performances for Classic format
function findBestAndWorstPerformances(
  gameweekData: GameweekPerformance[],
  playerId: number,
) {
  const playerGameweeks = gameweekData.filter(
    (gw) => gw.league_entry === playerId && gw.finished,
  );

  if (playerGameweeks.length === 0) {
    return {
      bestGameweek: { gameweek: 0, points: 0, rank: 0 },
      worstGameweek: { gameweek: 0, points: 0, rank: 0 },
    };
  }

  let bestGameweek = { gameweek: 0, points: 0, rank: 0 };
  let worstGameweek = { gameweek: 0, points: Number.MAX_SAFE_INTEGER, rank: 0 };

  playerGameweeks.forEach((gw) => {
    if (gw.event_total > bestGameweek.points) {
      bestGameweek = {
        gameweek: gw.event,
        points: gw.event_total,
        rank: gw.rank,
      };
    }

    if (gw.event_total < worstGameweek.points) {
      worstGameweek = {
        gameweek: gw.event,
        points: gw.event_total,
        rank: gw.rank,
      };
    }
  });

  return { bestGameweek, worstGameweek };
}

// Helper function to calculate position statistics for Classic format
function calculatePositionStats(
  gameweekData: GameweekPerformance[],
  playerId: number,
) {
  const playerGameweeks = gameweekData.filter(
    (gw) => gw.league_entry === playerId && gw.finished,
  );

  const positionCounts = {
    first: 0,
    second: 0,
    third: 0,
    fourth: 0,
    fifth: 0,
    sixth: 0,
    seventh: 0,
    eighth: 0,
  };

  playerGameweeks.forEach((gw) => {
    switch (gw.rank) {
      case 1:
        positionCounts.first++;
        break;
      case 2:
        positionCounts.second++;
        break;
      case 3:
        positionCounts.third++;
        break;
      case 4:
        positionCounts.fourth++;
        break;
      case 5:
        positionCounts.fifth++;
        break;
      case 6:
        positionCounts.sixth++;
        break;
      case 7:
        positionCounts.seventh++;
        break;
      case 8:
        positionCounts.eighth++;
        break;
    }
  });

  return positionCounts;
}

// Main API handler
export const GET = async (
  req: Request,
  { params }: { params: { id: string } },
) => {
  try {
    // Get data directly from FPL API (no internal API calls)
    const [leagueRes, gameweekData] = await Promise.all([
      fetch('https://draft.premierleague.com/api/league/75224/details', {
        cache: 'no-store',
      }),
      fetchGameweekPerformances(),
    ]);

    const { league_entries, standings } = await leagueRes.json();

    // Build F1 standings data directly (same logic as standings API)
    const playerF1Data = standings.map((standing: any) => {
      const player = league_entries.find(
        (entry: any) => entry.id === standing.league_entry,
      );

      // Calculate F1 points directly from current rank
      const rankPoints = [20, 15, 12, 10, 8, 6, 4, 2];
      const f1Points = rankPoints[standing.rank - 1] || 0;

      return {
        id: standing.league_entry,
        player_name: player?.player_first_name || 'Unknown',
        player_surname: player?.player_last_name || 'Unknown',
        team_name: player?.entry_name || 'Unknown',
        total_points: standing.total,
        f1_score: f1Points,
        f1_ranking: 0, // Will be set after sorting
        total_wins: standing.rank === 1 ? 1 : 0,
      };
    });

    // Sort by F1 score and assign final rankings
    playerF1Data.sort((a: any, b: any) => b.f1_score - a.f1_score);
    playerF1Data.forEach((player: any, index: number) => {
      player.f1_ranking = index + 1;
    });

    const playerId = parseInt(params.id, 10);

    // Get player basic info
    const playerBasic = league_entries.find(
      (entry: { id: number }) => entry.id === playerId,
    );

    if (!playerBasic) {
      return NextResponse.json(
        { message: 'Player not found' },
        { status: 404 },
      );
    }

    // Get player from standings to get additional data
    const playerStanding = standings.find(
      (s: { league_entry: number }) => s.league_entry === playerId,
    );

    // Calculate statistics for Classic format
    const performance = calculatePerformanceOverTime(gameweekData, playerId);
    const { bestGameweek, worstGameweek } = findBestAndWorstPerformances(
      gameweekData,
      playerId,
    );
    const positionStats = calculatePositionStats(gameweekData, playerId);

    // Calculate overall stats
    const totalGameweeks = performance.length;
    const totalPoints = performance.reduce((sum, gw) => sum + gw.points, 0);
    const averagePoints = totalGameweeks > 0 ? totalPoints / totalGameweeks : 0;
    const averageRank =
      totalGameweeks > 0
        ? performance.reduce((sum, gw) => sum + gw.rank, 0) / totalGameweeks
        : 0;

    // Count number of rumblers (gameweeks where player finished last - rank 8)
    const rumblerCount = performance.filter((gw) => gw.rank === 8).length;

    // Count number of wins (gameweeks where player finished first - rank 1)
    const totalWins = performance.filter((gw) => gw.rank === 1).length;

    // Calculate consistency metric (lower standard deviation = more consistent)
    const pointsArray = performance.map((gw) => gw.points);
    const variance =
      pointsArray.length > 0
        ? pointsArray.reduce(
            (sum, points) => sum + Math.pow(points - averagePoints, 2),
            0,
          ) / pointsArray.length
        : 0;
    const consistency = Math.sqrt(variance);

    // Find player F1 data
    const playerF1Info = playerF1Data.find((p: any) => p.id === playerId);

    return NextResponse.json({
      id: playerId,
      player_name: playerBasic.player_first_name,
      player_surname: playerBasic.player_last_name,
      team_name: playerBasic.entry_name,
      f1_score: playerF1Info?.f1_score || 0,
      f1_ranking: playerF1Info?.f1_ranking || null,
      stats: {
        totalGameweeks,
        totalWins,
        totalPoints,
        averagePoints: parseFloat(averagePoints.toFixed(1)),
        averageRank: parseFloat(averageRank.toFixed(1)),
        bestGameweek,
        worstGameweek,
        rumblerCount,
        consistency: parseFloat(consistency.toFixed(1)),
        positionStats,
      },
      performance,
      standingInfo: playerStanding || null,
    });
  } catch (error) {
    console.error('Error in player API:', error);
    return NextResponse.json(
      { message: (error as Error).message },
      { status: 500 },
    );
  }
};

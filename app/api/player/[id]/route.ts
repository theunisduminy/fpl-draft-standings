import { NextResponse } from 'next/server';
import { fetchData } from '@/app/api/standings/utils/fetchData';
import { Player } from '@/interfaces/players';

// Interface for gameweek performance data (matching the updated matches API)
interface GameweekPerformance {
  event: number;
  league_entry: number;
  event_total: number;
  rank: number;
  finished: boolean;
}

// Helper function to get gameweek performance data from the matches API
async function fetchGameweekPerformances(): Promise<GameweekPerformance[]> {
  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/matches`,
      {
        next: {
          revalidate: 3600, // 1 hour
        },
      },
    );
    return await res.json();
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
    const [{ league_entries, standings }, gameweekData] = await Promise.all([
      fetchData(),
      fetchGameweekPerformances(),
    ]);

    const playerId = parseInt(params.id, 10);

    // Get player basic info
    const playerBasic = league_entries.find((entry) => entry.id === playerId);

    if (!playerBasic) {
      return NextResponse.json(
        { message: 'Player not found' },
        { status: 404 },
      );
    }

    // Get player from standings to get additional data
    const playerStanding = standings.find((s) => s.league_entry === playerId);

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

    return NextResponse.json({
      id: playerId,
      player_name: playerBasic.player_first_name,
      player_surname: playerBasic.player_last_name,
      team_name: playerBasic.entry_name,
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

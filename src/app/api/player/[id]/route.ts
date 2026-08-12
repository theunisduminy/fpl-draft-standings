import { NextResponse } from 'next/server';
import { getGameweekData } from '@/utils/gameweek-data';

interface GameweekPerformance {
  event: number;
  league_entry: number;
  event_total: number;
  rank: number;
  finished: boolean;
}

export const dynamic = 'force-dynamic';

export const GET = async (
  req: Request,
  { params }: { params: { id: string } },
) => {
  try {
    const gameweekResponse = await getGameweekData();
    const { players, gameweekPerformances } = gameweekResponse;

    const playerId = parseInt(params.id, 10);

    const player = players.find((p: any) => p.id === playerId);

    if (!player) {
      return NextResponse.json(
        { message: 'Player not found' },
        { status: 404 },
      );
    }

    const playerGameweeks = gameweekPerformances.filter(
      (gw: GameweekPerformance) => gw.league_entry === playerId && gw.finished,
    );

    const performance = playerGameweeks
      .map((gw: GameweekPerformance) => ({
        gameweek: gw.event,
        points: gw.event_total,
        rank: gw.rank,
      }))
      .sort(
        (a: { gameweek: number }, b: { gameweek: number }) =>
          a.gameweek - b.gameweek,
      );

    let bestGameweek = { gameweek: 0, points: 0, rank: 0 };
    let worstGameweek = {
      gameweek: 0,
      points: Number.MAX_SAFE_INTEGER,
      rank: 0,
    };

    if (playerGameweeks.length > 0) {
      playerGameweeks.forEach((gw: GameweekPerformance) => {
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
    }

    const positionStats = {
      first: 0,
      second: 0,
      third: 0,
      fourth: 0,
      fifth: 0,
      sixth: 0,
      seventh: 0,
      eighth: 0,
    };

    playerGameweeks.forEach((gw: GameweekPerformance) => {
      switch (gw.rank) {
        case 1:
          positionStats.first++;
          break;
        case 2:
          positionStats.second++;
          break;
        case 3:
          positionStats.third++;
          break;
        case 4:
          positionStats.fourth++;
          break;
        case 5:
          positionStats.fifth++;
          break;
        case 6:
          positionStats.sixth++;
          break;
        case 7:
          positionStats.seventh++;
          break;
        case 8:
          positionStats.eighth++;
          break;
      }
    });

    const totalGameweeks = playerGameweeks.length;
    const totalPoints = playerGameweeks.reduce(
      (sum: number, gw: GameweekPerformance) => sum + gw.event_total,
      0,
    );
    const averagePoints = totalGameweeks > 0 ? totalPoints / totalGameweeks : 0;
    const averageRank =
      totalGameweeks > 0
        ? playerGameweeks.reduce(
            (sum: number, gw: GameweekPerformance) => sum + gw.rank,
            0,
          ) / totalGameweeks
        : 0;

    const rumblerCount = playerGameweeks.filter(
      (gw: GameweekPerformance) => gw.rank === 8,
    ).length;

    const totalWins = playerGameweeks.filter(
      (gw: GameweekPerformance) => gw.rank === 1,
    ).length;

    const pointsArray = playerGameweeks.map(
      (gw: GameweekPerformance) => gw.event_total,
    );
    const variance =
      pointsArray.length > 0
        ? pointsArray.reduce(
            (sum: number, points: number) =>
              sum + Math.pow(points - averagePoints, 2),
            0,
          ) / pointsArray.length
        : 0;
    const consistency = Math.sqrt(variance);

    return NextResponse.json({
      id: playerId,
      player_name: player.player_name,
      player_surname: player.player_surname,
      team_name: player.team_name,
      f1_score: player.f1_score,
      f1_ranking: player.f1_ranking,
      stats: {
        totalGameweeks,
        totalWins,
        totalPoints: totalPoints,
        averagePoints: parseFloat(averagePoints.toFixed(1)),
        averageRank: parseFloat(averageRank.toFixed(1)),
        bestGameweek,
        worstGameweek,
        rumblerCount,
        consistency: parseFloat(consistency.toFixed(1)),
        positionStats,
      },
      performance,
      standingInfo: {
        event_total: 0,
        last_rank: 0,
        league_entry: playerId,
        rank: player.f1_ranking,
        rank_sort: player.f1_ranking,
        total: player.total_points,
      },
    });
  } catch (error) {
    console.error('Error in player API:', error);
    return NextResponse.json(
      { message: (error as Error).message },
      { status: 500 },
    );
  }
};

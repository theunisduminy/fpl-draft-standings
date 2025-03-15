import { NextResponse } from 'next/server';
import { fetchData } from '@/app/api/standings/utils/fetchData';
import { Match } from '@/interfaces/match';
import { Player } from '@/interfaces/players';

// Helper function to calculate player performance over gameweeks
function calculatePerformanceOverTime(matches: Match[], playerId: number) {
  const gameweeks: { [key: number]: number } = {};

  matches.forEach((match) => {
    if (!match.finished) return;

    const event = match.event;

    if (match.league_entry_1 === playerId) {
      gameweeks[event] = match.league_entry_1_points;
    } else if (match.league_entry_2 === playerId) {
      gameweeks[event] = match.league_entry_2_points;
    }
  });

  return Object.entries(gameweeks)
    .map(([gameweek, points]) => ({
      gameweek: parseInt(gameweek),
      points,
    }))
    .sort((a, b) => a.gameweek - b.gameweek);
}

// Helper function to calculate head-to-head records
function calculateHeadToHeadRecords(
  matches: Match[],
  playerId: number,
  players: Player[],
) {
  const records: {
    [key: number]: {
      wins: number;
      losses: number;
      draws: number;
      totalPoints: number;
      againstPoints: number;
    };
  } = {};

  // Initialize records for all opponents
  players.forEach((player) => {
    if (player.id !== playerId) {
      records[player.id] = {
        wins: 0,
        losses: 0,
        draws: 0,
        totalPoints: 0,
        againstPoints: 0,
      };
    }
  });

  // Calculate head-to-head statistics
  matches.forEach((match) => {
    if (!match.finished) return;

    if (match.league_entry_1 === playerId && records[match.league_entry_2]) {
      const playerPoints = match.league_entry_1_points;
      const opponentPoints = match.league_entry_2_points;

      records[match.league_entry_2].totalPoints += playerPoints;
      records[match.league_entry_2].againstPoints += opponentPoints;

      if (playerPoints > opponentPoints) {
        records[match.league_entry_2].wins += 1;
      } else if (playerPoints < opponentPoints) {
        records[match.league_entry_2].losses += 1;
      } else {
        records[match.league_entry_2].draws += 1;
      }
    } else if (
      match.league_entry_2 === playerId &&
      records[match.league_entry_1]
    ) {
      const playerPoints = match.league_entry_2_points;
      const opponentPoints = match.league_entry_1_points;

      records[match.league_entry_1].totalPoints += playerPoints;
      records[match.league_entry_1].againstPoints += opponentPoints;

      if (playerPoints > opponentPoints) {
        records[match.league_entry_1].wins += 1;
      } else if (playerPoints < opponentPoints) {
        records[match.league_entry_1].losses += 1;
      } else {
        records[match.league_entry_1].draws += 1;
      }
    }
  });

  // Format the data for the frontend
  return Object.entries(records).map(([opponentId, record]) => {
    const opponent = players.find((p) => p.id === parseInt(opponentId));
    return {
      opponentId: parseInt(opponentId),
      opponentName: opponent ? `${opponent.player_first_name}` : 'Unknown',
      opponentTeam: opponent ? opponent.entry_name : 'Unknown',
      ...record,
    };
  });
}

// Helper function to find best and worst performances
function findBestAndWorstPerformances(matches: Match[], playerId: number) {
  let bestGameweek = { gameweek: 0, points: 0 };
  let worstGameweek = { gameweek: 0, points: Number.MAX_SAFE_INTEGER };

  matches.forEach((match) => {
    if (!match.finished) return;

    let points = 0;

    if (match.league_entry_1 === playerId) {
      points = match.league_entry_1_points;
    } else if (match.league_entry_2 === playerId) {
      points = match.league_entry_2_points;
    } else {
      return;
    }

    if (points > bestGameweek.points) {
      bestGameweek = { gameweek: match.event, points };
    }

    if (points < worstGameweek.points) {
      worstGameweek = { gameweek: match.event, points };
    }
  });

  return { bestGameweek, worstGameweek };
}

// Main API handler
export const GET = async (
  req: Request,
  { params }: { params: { id: string } },
) => {
  try {
    const { matches, league_entries, standings } = await fetchData();
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

    // Calculate statistics
    const performance = calculatePerformanceOverTime(matches, playerId);
    const headToHead = calculateHeadToHeadRecords(
      matches,
      playerId,
      league_entries,
    );
    const { bestGameweek, worstGameweek } = findBestAndWorstPerformances(
      matches,
      playerId,
    );

    // Calculate overall stats
    const totalMatches = headToHead.reduce(
      (sum, record) => sum + record.wins + record.losses + record.draws,
      0,
    );
    const totalWins = headToHead.reduce((sum, record) => sum + record.wins, 0);
    const totalLosses = headToHead.reduce(
      (sum, record) => sum + record.losses,
      0,
    );
    const totalDraws = headToHead.reduce(
      (sum, record) => sum + record.draws,
      0,
    );
    const winPercentage =
      totalMatches > 0 ? (totalWins / totalMatches) * 100 : 0;

    // Calculate average points per gameweek
    const totalPoints = performance.reduce((sum, gw) => sum + gw.points, 0);
    const averagePoints =
      performance.length > 0 ? totalPoints / performance.length : 0;

    // Count number of rumblers (gameweeks with lowest score)
    const rumblerCount = matches.filter((match) => {
      if (!match.finished) return false;

      // Get all points for this gameweek
      const gameweekMatches = matches.filter(
        (m) => m.event === match.event && m.finished,
      );
      const allPoints: number[] = [];

      gameweekMatches.forEach((m) => {
        allPoints.push(m.league_entry_1_points);
        allPoints.push(m.league_entry_2_points);
      });

      const minPoints = Math.min(...allPoints);

      // Check if this player had the minimum points
      return (
        (match.league_entry_1 === playerId &&
          match.league_entry_1_points === minPoints) ||
        (match.league_entry_2 === playerId &&
          match.league_entry_2_points === minPoints)
      );
    }).length;

    return NextResponse.json({
      id: playerId,
      player_name: playerBasic.player_first_name,
      player_surname: playerBasic.player_last_name,
      team_name: playerBasic.entry_name,
      stats: {
        totalMatches,
        totalWins,
        totalLosses,
        totalDraws,
        winPercentage: parseFloat(winPercentage.toFixed(1)),
        totalPoints,
        averagePoints: parseFloat(averagePoints.toFixed(1)),
        bestGameweek,
        worstGameweek,
        rumblerCount,
      },
      performance,
      headToHead,
      standingInfo: playerStanding || null,
    });
  } catch (error) {
    return NextResponse.json(
      { message: (error as Error).message },
      { status: 500 },
    );
  }
};

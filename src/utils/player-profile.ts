import type { LeagueEntryId } from '@/interfaces/fpl';
import type {
  GameweekDataResponse,
  GameweekPerformance,
} from '@/interfaces/players';

/**
 * One manager's season, derived from the gameweek data.
 *
 * Pure: it takes the already-computed season and reduces it, so the page can
 * call it directly instead of round-tripping through an API route. Everything
 * here is derived, never stored — see `src/server/db/schema.ts` for why.
 */

export interface GameweekHighlight {
  gameweek: number;
  points: number;
  rank: number;
}

export interface PlayerStats {
  totalGameweeks: number;
  totalWins: number;
  totalPoints: number;
  averagePoints: number;
  averageRank: number;
  bestGameweek: GameweekHighlight;
  worstGameweek: GameweekHighlight;
  rumblerCount: number;
  /** Standard deviation of weekly points — lower is steadier. */
  consistency: number;
  positionStats: Record<PositionKey, number>;
}

export interface PlayerProfile {
  id: LeagueEntryId;
  player_name: string;
  player_surname: string;
  team_name: string;
  f1_score: number;
  f1_ranking: number;
  total_points: number;
  stats: PlayerStats;
  performance: Array<{ gameweek: number; points: number; rank: number }>;
}

const POSITION_KEYS = [
  'first',
  'second',
  'third',
  'fourth',
  'fifth',
  'sixth',
  'seventh',
  'eighth',
] as const;

type PositionKey = (typeof POSITION_KEYS)[number];

const EMPTY_HIGHLIGHT: GameweekHighlight = { gameweek: 0, points: 0, rank: 0 };

function emptyPositionStats(): Record<PositionKey, number> {
  return {
    first: 0,
    second: 0,
    third: 0,
    fourth: 0,
    fifth: 0,
    sixth: 0,
    seventh: 0,
    eighth: 0,
  };
}

/**
 * Build one manager's profile, or `null` if that league entry is not in the
 * league.
 *
 * `null` rather than a thrown error or an empty shell: an unknown ID is a 404,
 * and the caller is the only one that knows how to say so.
 */
export function buildPlayerProfile(
  data: GameweekDataResponse,
  leagueEntry: LeagueEntryId,
): PlayerProfile | null {
  const player = data.players.find((candidate) => candidate.id === leagueEntry);

  if (!player) return null;

  const gameweeks = data.gameweekPerformances.filter(
    (performance) =>
      performance.league_entry === leagueEntry && performance.finished,
  );

  return {
    id: player.id,
    player_name: player.player_name,
    player_surname: player.player_surname,
    team_name: player.team_name,
    f1_score: player.f1_score,
    f1_ranking: player.f1_ranking,
    total_points: player.total_points,
    stats: summarise(gameweeks),
    performance: gameweeks
      .map((gameweek) => ({
        gameweek: gameweek.event,
        points: gameweek.event_total,
        rank: gameweek.rank,
      }))
      .sort((a, b) => a.gameweek - b.gameweek),
  };
}

function summarise(gameweeks: GameweekPerformance[]): PlayerStats {
  const totalGameweeks = gameweeks.length;

  if (totalGameweeks === 0) {
    return {
      totalGameweeks: 0,
      totalWins: 0,
      totalPoints: 0,
      averagePoints: 0,
      averageRank: 0,
      bestGameweek: EMPTY_HIGHLIGHT,
      worstGameweek: EMPTY_HIGHLIGHT,
      rumblerCount: 0,
      consistency: 0,
      positionStats: emptyPositionStats(),
    };
  }

  const totalPoints = gameweeks.reduce((sum, gw) => sum + gw.event_total, 0);
  const averagePoints = totalPoints / totalGameweeks;
  const averageRank =
    gameweeks.reduce((sum, gw) => sum + gw.rank, 0) / totalGameweeks;

  const byPoints = [...gameweeks].sort((a, b) => b.event_total - a.event_total);
  const toHighlight = (gw: GameweekPerformance): GameweekHighlight => ({
    gameweek: gw.event,
    points: gw.event_total,
    rank: gw.rank,
  });

  const positionStats = emptyPositionStats();
  for (const gameweek of gameweeks) {
    const key = POSITION_KEYS[gameweek.rank - 1];
    if (key) positionStats[key]++;
  }

  const variance =
    gameweeks.reduce(
      (sum, gw) => sum + (gw.event_total - averagePoints) ** 2,
      0,
    ) / totalGameweeks;

  const round = (value: number) => Math.round(value * 10) / 10;

  return {
    totalGameweeks,
    totalWins: gameweeks.filter((gw) => gw.rank === 1).length,
    totalPoints,
    averagePoints: round(averagePoints),
    averageRank: round(averageRank),
    bestGameweek: toHighlight(byPoints[0]),
    worstGameweek: toHighlight(byPoints[byPoints.length - 1]),
    // The rumbler is whoever finishes last, which in an eight-manager league
    // is rank 8.
    rumblerCount: gameweeks.filter((gw) => gw.rank === 8).length,
    consistency: round(Math.sqrt(variance)),
    positionStats,
  };
}

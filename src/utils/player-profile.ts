import type { LeagueEntryId } from '@/interfaces/fpl';
import { countRumblers } from './scoring';
import {
  emptyPositionTally,
  POSITION_KEYS,
  type GameweekDataResponse,
  type GameweekHighlight,
  type GameweekPerformance,
  type PlayerProfile,
  type PlayerStats,
} from '@/interfaces/players';

/**
 * One manager's season, derived from the gameweek data.
 *
 * Pure: it takes the already-computed season and reduces it, so the page can
 * call it directly instead of round-tripping through an API route. Everything
 * here is derived, never stored — see `src/server/db/schema.ts` for why.
 */

const EMPTY_HIGHLIGHT: GameweekHighlight = { gameweek: 0, points: 0, rank: 0 };

const EMPTY_STATS: PlayerStats = {
  totalGameweeks: 0,
  totalWins: 0,
  totalPoints: 0,
  averagePoints: 0,
  averageRank: 0,
  bestGameweek: EMPTY_HIGHLIGHT,
  worstGameweek: EMPTY_HIGHLIGHT,
  rumblerCount: 0,
  consistency: 0,
  positionStats: emptyPositionTally(),
};

const round = (value: number) => Math.round(value * 10) / 10;

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
    player_name: player.player_name,
    team_name: player.team_name,
    f1_score: player.f1_score,
    f1_ranking: player.f1_ranking,
    // Through the scoring layer's counter, which reads the worst rank *present*
    // each week. This used to be `rank === 8` here, which silently returns zero
    // for a week where two managers tie mid-table and nobody finishes 8th — so
    // the player page and `/profile` would under-count a season the rumblers
    // page and the league ledger counted correctly.
    stats: summarise(
      gameweeks,
      countRumblers(data.gameweekPerformances).get(leagueEntry) ?? 0,
    ),
    performance: gameweeks
      .map(toHighlight)
      .sort((a, b) => a.gameweek - b.gameweek),
  };
}

function toHighlight(gameweek: GameweekPerformance): GameweekHighlight {
  return {
    gameweek: gameweek.event,
    points: gameweek.event_total,
    rank: gameweek.rank,
  };
}

/**
 * `rumblerCount` is passed in rather than derived here, because last place is
 * not a property of one manager's own gameweeks: it is the worst rank present
 * in each week, which only the full season can answer.
 */
function summarise(
  gameweeks: GameweekPerformance[],
  rumblerCount: number,
): PlayerStats {
  const totalGameweeks = gameweeks.length;

  if (totalGameweeks === 0) return EMPTY_STATS;

  const totalPoints = gameweeks.reduce((sum, gw) => sum + gw.event_total, 0);
  const averagePoints = totalPoints / totalGameweeks;
  const averageRank =
    gameweeks.reduce((sum, gw) => sum + gw.rank, 0) / totalGameweeks;

  const byPoints = [...gameweeks].sort((a, b) => b.event_total - a.event_total);

  const positionStats = emptyPositionTally();
  for (const gameweek of gameweeks) {
    const key = POSITION_KEYS[gameweek.rank - 1];
    if (key) positionStats[key]++;
  }

  const variance =
    gameweeks.reduce(
      (sum, gw) => sum + (gw.event_total - averagePoints) ** 2,
      0,
    ) / totalGameweeks;

  return {
    totalGameweeks,
    totalWins: gameweeks.filter((gw) => gw.rank === 1).length,
    totalPoints,
    averagePoints: round(averagePoints),
    averageRank: round(averageRank),
    bestGameweek: toHighlight(byPoints[0]),
    worstGameweek: toHighlight(byPoints[byPoints.length - 1]),
    rumblerCount,
    consistency: round(Math.sqrt(variance)),
    positionStats,
  };
}

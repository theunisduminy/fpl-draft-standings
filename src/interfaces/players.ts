import type { LeagueEntryId } from './fpl';

/**
 * Finishing positions 1st-8th, in order, as object keys.
 *
 * The league is eight managers, so a rank maps to `POSITION_KEYS[rank - 1]`.
 * One list, because both the season aggregate and a single manager's profile
 * tally the same thing and must not drift.
 */
export const POSITION_KEYS = [
  'first',
  'second',
  'third',
  'fourth',
  'fifth',
  'sixth',
  'seventh',
  'eighth',
] as const;

/**
 * The same eight positions, as the labels a reader sees.
 *
 * Beside `POSITION_KEYS` and indexed the same way, so a rank is
 * `POSITION_LABELS[rank - 1]`. It lives here for the reason the keys do: three
 * components were each spelling out "1st" to "8th", one of them via a general
 * ordinal-suffix algorithm complete with a teens branch, for numbers that can
 * only ever be one to eight.
 */
export const POSITION_LABELS = [
  '1st',
  '2nd',
  '3rd',
  '4th',
  '5th',
  '6th',
  '7th',
  '8th',
] as const;

export type PositionKey = (typeof POSITION_KEYS)[number];

/** A count per finishing position. */
export type PositionTally = Record<PositionKey, number>;

export function emptyPositionTally(): PositionTally {
  return Object.fromEntries(
    POSITION_KEYS.map((key) => [key, 0]),
  ) as PositionTally;
}

// Legacy Player interface - kept for backwards compatibility
export interface Player {
  player_first_name: string;
  player_last_name: string;
  id: LeagueEntryId;
  entry_name: string;
}

// Main PlayerDetails interface - standardized structure
export interface PlayerDetails {
  /** The league entry — see `LeagueEntryId`, not the `entry_id`. */
  id: LeagueEntryId;
  player_name: string;
  player_surname: string;
  team_name: string;
  total_points: number;
  f1_score: number;
  f1_ranking: number;
  /**
   * Where they would stand if the league ranked on points instead of finishes.
   *
   * Carried as a field rather than derived per view, because a ranking
   * recomputed from a filtered list is a different ranking.
   *
   * **Nothing renders it today.** The standings board used to print "2nd on
   * points" under the points column and no longer does. It stays because it is
   * one line of the season aggregate, it is pinned by tests, and the
   * points-versus-finishes disagreement is the league's defining quirk — the
   * next surface that wants to say it should not have to re-derive it.
   */
  points_ranking: number;
  total_wins: number;
  position_placed: PositionTally;
}

/** One gameweek picked out of a season: best, worst, or a point on a chart. */
export interface GameweekHighlight {
  gameweek: number;
  points: number;
  rank: number;
}

/** One manager's season, reduced. Derived at read time, never stored. */
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
  positionStats: PositionTally;
}

export interface PlayerProfile {
  player_name: string;
  team_name: string;
  f1_score: number;
  f1_ranking: number;
  stats: PlayerStats;
  performance: GameweekHighlight[];
}

// Gameweek performance data
export interface GameweekPerformance {
  event: number;
  league_entry: LeagueEntryId;
  event_total: number;
  rank: number;
  finished: boolean;
}

// Complete gameweek data response
export interface GameweekDataResponse {
  players: PlayerDetails[];
  gameweekPerformances: GameweekPerformance[];
  currentGameweek: number;
  completedGameweeks: number[];
  rumblerData: RumblerGameweekData[];
}

// Rumbler data structure
export interface RumblerGameweekData {
  gameweek: number;
  points: number;
  entry_names: string[];
  player_names: string[];
}

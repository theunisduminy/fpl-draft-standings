import type { LeagueEntryId } from '@/interfaces/fpl';
import type { PlayerDetails } from '@/interfaces/players';

/**
 * One place to turn a league entry into the name a reader sees.
 *
 * Four cards were each building `new Map(players.map(p => [p.id, p.player_name]))`
 * and, worse, three different fallbacks for a manager the map does not hold —
 * `#39837`, `Player 39837` and `Player 39837` from a different branch. The same
 * absent manager therefore rendered differently on two cards sitting side by
 * side. The fallback is the reason this module exists; the map is just what it
 * comes attached to.
 *
 * Pure and free of React, so a server component can build the map and hand it
 * down as readily as a client one can build it in render.
 */
export function nameLookup(
  players: PlayerDetails[],
): Map<LeagueEntryId, string> {
  return new Map(players.map((player) => [player.id, player.player_name]));
}

/**
 * The manager's name, or a legible stand-in.
 *
 * Takes either shape of lookup: charts that receive `playerNames` as a plain
 * record from a server component get the same fallback as the ones holding a
 * `Map`.
 */
export function nameFor(
  names: Map<LeagueEntryId, string> | Record<number, string>,
  entry: LeagueEntryId,
): string {
  const found = names instanceof Map ? names.get(entry) : names[entry];

  return found || `Player ${entry}`;
}

/**
 * Up to two letters from a name, for a column too narrow to hold one.
 *
 * Handles a name that is one word or three: it takes the first letter of each
 * of the first two words, so "Theunis" gives "T" and "Theunis Duminy" gives
 * "TD". Shared with the squad view's photo fallback, which had written the same
 * thing independently.
 */
export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? '')
    .join('');
}

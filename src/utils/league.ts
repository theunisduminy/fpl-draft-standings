import { fetchUpstream, fplApi } from './fpl-api';
import type { LeagueDetails } from '@/interfaces/fpl';

/**
 * Read the league, its entries and its standings.
 *
 * Typing the response here is what gives every consumer downstream the
 * distinction between `league_entries[].id` and `entry_id` for free, so they
 * can no longer swap them.
 */
export async function fetchLeagueDetails(
  leagueId: number,
): Promise<LeagueDetails> {
  try {
    return await fetchUpstream<LeagueDetails>(fplApi.leagueDetails(leagueId));
  } catch (cause) {
    // League IDs are minted fresh every August, so a failure here is far more
    // often a stale ID than an outage. Say so.
    throw new Error(
      `Could not read league ${leagueId}. League IDs are season-scoped — check FPL_LEAGUE_ID is current.`,
      { cause },
    );
  }
}

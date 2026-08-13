import { fplApi } from './fpl-api';
import type { LeagueDetails } from '@/interfaces/fpl';

/**
 * Read the league, its entries and its standings.
 *
 * The upstream JSON is untyped, so this is the sanctioned place to assert its
 * shape — and with it, that `league_entries[].id` is a league entry and
 * `entry_id` is an entry. Every consumer downstream gets that distinction for
 * free, and can no longer swap them.
 */
export async function fetchLeagueDetails(
  leagueId: number,
): Promise<LeagueDetails> {
  const res = await fetch(fplApi.leagueDetails(leagueId), {
    next: { revalidate: 300 },
  });

  if (!res.ok) {
    throw new Error(
      `League ${leagueId} details request failed with ${res.status}. ` +
        'League IDs are season-scoped — check FPL_LEAGUE_ID is current.',
    );
  }

  return (await res.json()) as LeagueDetails;
}

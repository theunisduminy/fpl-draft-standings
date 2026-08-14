import 'server-only';

import { fplApi } from '@/utils/fpl-api';
import { asTeamCode, type PlTeam, type TeamCode } from '@/interfaces/fpl';
import { readTeams } from '@/server/data/pl-teams';
import { isReferenceUsable, toPlTeam } from './reference-mapping';
import { cachedRead } from './cache';

/**
 * The 20 Premier League clubs.
 *
 * Only `code`, `name` and `short_name` survive the read. `teams[].id` is left
 * behind on purpose: it is re-assigned alphabetically every August, so a stored
 * `id` would quietly come to mean a different club. See {@link TeamCode}.
 *
 * Answered from `pl_teams` when that table is populated and fresh, and from the
 * classic bootstrap when it is not. The table is an accelerator; a failed sync
 * or an unreachable database costs latency here, never correctness.
 */

const CACHE_KEY = 'pl-teams';
const CACHE_TTL_SECONDS = 86_400; // a day — the club list changes once, in July

/**
 * The club list, cached.
 *
 * **This wrapper is load-bearing.** What it replaced was a bare `fetch` whose
 * `next: { revalidate }` option was the only cache in the path — swapping that
 * fetch for a database read without putting a cache back would have turned
 * every profile render and every `isKnownTeamCode` call into a query. It also
 * gives the sync job a tag to revalidate, which the old shape had no way to
 * offer.
 */
export const getPremierLeagueTeams = cachedRead(
  CACHE_KEY,
  CACHE_TTL_SECONDS,
  resolvePremierLeagueTeams,
);

async function resolvePremierLeagueTeams(): Promise<PlTeam[]> {
  const stored = await readTeams().catch((error: unknown) => {
    console.error(
      '[reference] pl_teams could not be read; falling back.',
      error,
    );

    return null;
  });

  if (stored) {
    const verdict = isReferenceUsable(stored.rows, stored.syncedAt, new Date());

    if (verdict.usable) {
      return stored.rows.map(toPlTeam).sort(byName);
    }

    console.error(
      `[reference] pl_teams unusable (${verdict.reason}${verdict.detail ? `: ${verdict.detail}` : ''}); ` +
        'falling back to the classic bootstrap.',
    );
  }

  return fetchFromBootstrap();
}

/**
 * The classic bootstrap path — what this module always did, kept whole.
 *
 * A fallback that cannot run is worse than no fallback: it reads as safety
 * while being dead code. This one runs on every empty, stale or unreachable
 * table, which is exactly the state the season starts in.
 */
export async function fetchFromBootstrap(): Promise<PlTeam[]> {
  const response = await fetch(fplApi.bootstrapStatic(), {
    next: { revalidate: 86_400 },
  });

  if (!response.ok) {
    throw new Error(`Bootstrap-static request failed with ${response.status}`);
  }

  const { teams } = (await response.json()) as {
    teams: { code: number; name: string; short_name: string }[];
  };

  return teams
    .map((team) => ({
      code: asTeamCode(team.code),
      name: team.name,
      short_name: team.short_name,
    }))
    .sort(byName);
}

function byName(a: PlTeam, b: PlTeam): number {
  return a.name.localeCompare(b.name);
}

/**
 * Is this code one upstream actually returned?
 *
 * The check a Server Action needs: a form can post any integer, and
 * `parseTeamCode` only proves it is one.
 *
 * Deliberately routed through `getPremierLeagueTeams` rather than querying
 * `pl_teams` directly, so validation inherits the fallback. An allowlist must
 * not become permissive because a sync failed — and because `upsertTeams`
 * prunes, it does not become permissive because a club was relegated either.
 */
export async function isKnownTeamCode(code: TeamCode): Promise<boolean> {
  const teams = await getPremierLeagueTeams();

  return teams.some((team) => team.code === code);
}

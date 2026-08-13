import 'server-only';

import { fplApi } from '@/utils/fpl-api';
import { asTeamCode, type PlTeam, type TeamCode } from '@/interfaces/fpl';

/**
 * The 20 Premier League clubs, from the classic bootstrap.
 *
 * Only `code`, `name` and `short_name` survive the read. `teams[].id` is left
 * behind on purpose: it is re-assigned alphabetically every August, so a stored
 * `id` would quietly come to mean a different club. See {@link TeamCode}.
 *
 * Cached for a day. The club list changes three times a year, in one go, in
 * July — there is nothing here worth a shorter TTL.
 */
export async function getPremierLeagueTeams(): Promise<PlTeam[]> {
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
    .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Is this code one upstream actually returned?
 *
 * The check a Server Action needs: a form can post any integer, and
 * `parseTeamCode` only proves it is one.
 */
export async function isKnownTeamCode(code: TeamCode): Promise<boolean> {
  const teams = await getPremierLeagueTeams();

  return teams.some((team) => team.code === code);
}

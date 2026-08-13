'use server';

import { getCurrentUser } from '@/server/auth/server';
import { asLeagueEntryId, type LeagueEntryId } from '@/interfaces/fpl';
import { getGameweekSquad, type GameweekSquad } from '@/utils/gameweek-squad';

/**
 * Read one manager's team sheet for one gameweek.
 *
 * **This is a read over POST, which the rest of the app does not do.** Pages
 * read their own data; this one cannot, because which team sheet to show is
 * decided by a click, long after the page rendered, and pre-fetching all 38
 * gameweeks for eight managers would cost hundreds of upstream calls to answer
 * a question nobody may ask. The alternative — an `/api/*` route — is worse:
 * the proxy would 307 it to sign-in, and it would be reachable by anyone who
 * got past that, with no membership check. See agents/AGENTS.md.
 *
 * Being a Server Action, it is a public POST endpoint, so it checks membership
 * itself rather than relying on the proxy, and validates both arguments.
 * Neither argument is an identity: the caller says which manager's squad to
 * show, not who they are.
 */
export type SquadResult =
  { ok: true; squad: GameweekSquad | null } | { ok: false; error: string };

const MAX_GAMEWEEK = 38;

export async function readGameweekSquad(
  leagueEntry: number,
  gameweek: number,
): Promise<SquadResult> {
  const user = await getCurrentUser();

  if (!user) {
    return { ok: false, error: 'You need to be signed in to do that.' };
  }

  const entry = toLeagueEntryId(leagueEntry);
  if (entry === null) {
    return { ok: false, error: 'That is not a manager in this league.' };
  }

  if (!Number.isInteger(gameweek) || gameweek < 1 || gameweek > MAX_GAMEWEEK) {
    return {
      ok: false,
      error: `Gameweek must be between 1 and ${MAX_GAMEWEEK}.`,
    };
  }

  try {
    return { ok: true, squad: await getGameweekSquad(entry, gameweek) };
  } catch (cause) {
    console.error('readGameweekSquad failed', cause);
    return { ok: false, error: 'Could not read that team sheet. Try again.' };
  }
}

/** Brand the id only once it is known to be a plausible one. */
function toLeagueEntryId(raw: number): LeagueEntryId | null {
  return Number.isInteger(raw) && raw > 0 ? asLeagueEntryId(raw) : null;
}

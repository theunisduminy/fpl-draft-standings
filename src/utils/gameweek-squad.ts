import type {
  ElementId,
  EntryId,
  EntryPick,
  EventLive,
  LeagueEntryId,
  Position,
} from '@/interfaces/fpl';

import { fetchUpstream, fplApi, getLeagueId, upstreamFetch } from './fpl-api';
import { fetchLeagueDetails } from './league';
import { ensureCovers, getElementLookup } from './draft-elements';

/**
 * One manager's team sheet for one gameweek, with what each footballer scored.
 *
 * This is the only read in the app triggered by an interaction rather than by
 * a page render, so it is deliberately narrow: one manager, one gameweek. The
 * element lookup and the league both come from caches the rest of the app
 * shares, and the two gameweek-scoped fetches are the same URLs
 * `gameweek-data.ts` reads, so in practice all of it is warm.
 *
 * Ownership comes from the **picks**, not `element-status`, which is the
 * opposite of `squads.ts` and correct for the opposite reason: this is a
 * historical question ("who did they field in GW5?"), and element-status only
 * ever answers for today.
 */

/** A footballer on a team sheet, with what they scored that gameweek. */
export interface GameweekSquadPlayer {
  element: ElementId;
  name: string;
  position: Position;
  club: string;
  points: number;
  /** Positions 1-11 start; 12-15 are the bench and score nothing. */
  starting: boolean;
}

export interface GameweekSquad {
  gameweek: number;
  leagueEntry: LeagueEntryId;
  managerName: string;
  teamName: string;
  /** In team-sheet order, starters first. */
  players: GameweekSquadPlayer[];
  /** The starting XI's total — what the results table shows for the gameweek. */
  total: number;
  /** Points left on the bench. Banter, not scoring. */
  benchTotal: number;
}

/**
 * Read one manager's gameweek squad, or `null` if there isn't one.
 *
 * `null` covers both "that manager is not in this league" and upstream's
 * "No pick history" 404, which is what an unplayed gameweek looks like. The
 * caller renders an empty state; it is not an error.
 */
export async function getGameweekSquad(
  leagueEntry: LeagueEntryId,
  gameweek: number,
): Promise<GameweekSquad | null> {
  // Started before the league is awaited: neither depends on which manager was
  // asked for, so waiting would put a league round trip in front of them for
  // nothing.
  const livePromise = fetchUpstream<EventLive>(fplApi.eventLive(gameweek));
  const lookupPromise = getElementLookup();

  // Swallow a rejection that nobody awaits, in case the early return below
  // fires. The real error still surfaces at the `await` when we do get there.
  livePromise.catch(() => {});
  lookupPromise.catch(() => {});

  const league = await fetchLeagueDetails(getLeagueId());

  // The league entry is what the app calls a player; the URL below needs the
  // entry_id. This lookup is the only place the two meet here, and it is also
  // what stops a caller naming a manager who is not in our league.
  const entry = league.league_entries.find((e) => e.id === leagueEntry);
  if (!entry) return null;

  const [picks, live, initialLookup] = await Promise.all([
    fetchEntryPicks(entry.entry_id, gameweek),
    livePromise,
    lookupPromise,
  ]);

  if (picks.length === 0) return null;

  // The picks are what say which elements this team sheet needs, so the
  // completeness check happens here — the same gate `/squads` applies. Without
  // it a table missing one element renders `Player 412` in a real team sheet.
  const lookup = await ensureCovers(
    initialLookup,
    picks.map((pick) => pick.element),
  );

  const players = [...picks]
    .sort((a, b) => a.position - b.position)
    .map((pick): GameweekSquadPlayer => {
      // `elements` is `{}` for a gameweek that has not been scored — a real
      // possibility here, because the reader can open the current gameweek
      // mid-flight. Zero is the honest answer for a footballer who has not
      // played yet, and nothing in this view ranks, so zeros are harmless.
      const points = live.elements?.[String(pick.element)]?.stats?.total_points;

      return {
        element: pick.element,
        ...lookup.describe(pick.element),
        points: points ?? 0,
        starting: pick.position <= 11,
      };
    });

  const sum = (subset: GameweekSquadPlayer[]) =>
    subset.reduce((total, player) => total + player.points, 0);

  return {
    gameweek,
    leagueEntry: entry.id,
    managerName: `${entry.player_first_name} ${entry.player_last_name}`,
    teamName: entry.entry_name,
    players,
    total: sum(players.filter((player) => player.starting)),
    benchTotal: sum(players.filter((player) => !player.starting)),
  };
}

/**
 * The picks for one entry's gameweek, or `[]` if there are none.
 *
 * Upstream 404s with "No pick history" until an entry has played, so a 404 is
 * "not yet", not a failure. Anything else is a genuine error and throws — a
 * caller scoring a whole gameweek should catch it and drop that gameweek
 * rather than score a partial league.
 */
export async function fetchEntryPicks(
  entryId: EntryId,
  gameweek: number,
): Promise<EntryPick[]> {
  const res = await upstreamFetch(fplApi.entryEvent(entryId, gameweek));

  if (res.status === 404) return [];

  if (!res.ok) {
    throw new Error(`Picks for entry ${entryId} GW${gameweek}: ${res.status}`);
  }

  const body = (await res.json()) as { picks?: EntryPick[] };
  return body.picks ?? [];
}

import {
  POSITION_ORDER,
  type DraftBootstrap,
  type DraftElement,
  type DraftElementType,
  type DraftTeam,
  type ElementId,
  type EntryId,
  type EntryPick,
  type EventLive,
  type LeagueEntryId,
  type Position,
} from '@/interfaces/fpl';

import { fetchUpstream, fplApi, getLeagueId } from './fpl-api';
import { fetchLeagueDetails } from './league';

/**
 * One manager's team sheet for one gameweek, with what each footballer scored.
 *
 * This is the only read in the app that is triggered by an interaction rather
 * than by a page render, so it is deliberately narrow: one manager, one
 * gameweek, four upstream calls, no cache layer of its own. Every call is a
 * `fetch` with a `revalidate`, so Next's Data Cache carries it — and three of
 * the four are already warm, because `gameweek-data.ts` and the squads page
 * read the same URLs.
 *
 * Ownership comes from the **picks**, not `element-status`, which is the
 * opposite of `squads.ts` and correct for the opposite reason: this is a
 * historical question ("who did they field in GW5?"), and element-status only
 * ever answers for today.
 */

const NO_SQUAD_STATUSES = [404];

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
  const leagueId = getLeagueId();
  const league = await fetchLeagueDetails(leagueId);

  // The league entry is what the app calls a player; the URL below needs the
  // entry_id. This lookup is the only place the two meet here, and it is also
  // what stops a caller naming a manager who is not in our league.
  const entry = league.league_entries.find((e) => e.id === leagueEntry);
  if (!entry) return null;

  const [picks, live, bootstrap] = await Promise.all([
    fetchPicks(entry.entry_id, gameweek),
    fetchUpstream<EventLive>(fplApi.eventLive(gameweek), 300),
    fetchUpstream<DraftBootstrap>(fplApi.draftBootstrap(), 21600),
  ]);

  if (picks.length === 0) return null;

  const elements = new Map<ElementId, DraftElement>(
    bootstrap.elements.map((element) => [element.id, element]),
  );
  const clubs = new Map<number, DraftTeam>(
    bootstrap.teams.map((team) => [team.id, team]),
  );
  const positions = new Map<number, DraftElementType>(
    bootstrap.element_types.map((type) => [type.id, type]),
  );

  const players = [...picks]
    .sort((a, b) => a.position - b.position)
    .map((pick): GameweekSquadPlayer => {
      const details = elements.get(pick.element);
      // `elements` is `{}` for a gameweek that has not been scored — a real
      // possibility here, because the reader can open the current gameweek
      // mid-flight. Zero is the honest answer for a footballer who has not
      // played yet, and nothing in this view ranks, so zeros are harmless.
      const points = live.elements?.[String(pick.element)]?.stats?.total_points;

      return {
        element: pick.element,
        name: details?.web_name ?? `Player ${pick.element}`,
        position: details
          ? toPosition(positions.get(details.element_type)?.singular_name_short)
          : 'UNK',
        club: details ? (clubs.get(details.team)?.short_name ?? '—') : '—',
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
 * "not yet", not a failure. Anything else is a genuine error and throws.
 */
async function fetchPicks(
  entryId: EntryId,
  gameweek: number,
): Promise<EntryPick[]> {
  const res = await fetch(fplApi.entryEvent(entryId, gameweek), {
    next: { revalidate: 300 },
  });

  if (NO_SQUAD_STATUSES.includes(res.status)) return [];

  if (!res.ok) {
    throw new Error(`Picks for entry ${entryId} GW${gameweek}: ${res.status}`);
  }

  const body = (await res.json()) as { picks?: EntryPick[] };
  return body.picks ?? [];
}

/** Upstream sends the position as a bare string; keep it in the union. */
function toPosition(raw: string | undefined): Position {
  return POSITION_ORDER.includes(raw as Position) ? (raw as Position) : 'UNK';
}

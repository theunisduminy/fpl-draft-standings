import {
  POSITION_ORDER,
  type DraftBootstrap,
  type DraftChoice,
  type DraftElement,
  type DraftElementType,
  type DraftTeam,
  type ElementCode,
  type ElementId,
  type ElementStatus,
  type EntryId,
  type LeagueEntryId,
  type Position,
  type TeamCode,
} from '@/interfaces/fpl';

import { fetchUpstream, fplApi, getLeagueId } from './fpl-api';
import { fetchLeagueDetails } from './league';
import { cachedRead } from './cache';

/**
 * Who owns whom, and how they got there.
 *
 * Ownership comes from `element-status` rather than `entry/{id}/event/{gw}`
 * for two reasons: it works before GW1 has been played (picks 404 with
 * "No pick history" right up to kickoff, draft or no draft), and it keeps
 * reflecting reality after trades and waivers.
 *
 * The draft choices are joined in on top purely for colour — which round
 * someone was taken in, and who let the clock auto-pick for them.
 */

const CACHE_KEY = 'squads';
const CACHE_TTL_SECONDS = 900; // 15 min — waivers move players, but not often

export type Acquisition =
  /** Drafted by this manager, and still theirs. */
  | { kind: 'drafted'; round: number; pick: number; wasAuto: boolean }
  /** Drafted by somebody else — so it changed hands. */
  | { kind: 'acquired'; draftedRound: number }
  /** Never drafted at all: picked up from the free-agent pool. */
  | { kind: 'free-agent' };

export interface SquadPlayer {
  element: ElementId;
  /** Season-stable, and what the headshot URL is built from. */
  code: ElementCode | null;
  name: string;
  position: Position;
  club: string;
  /** The club's crest identity. Null when the element cannot be resolved. */
  clubCode: TeamCode | null;
  /**
   * The footballer's season total, from the draft bootstrap.
   *
   * **Everything they have scored this season, not what they scored for this
   * manager.** A player traded in at GW10 brings their first nine gameweeks
   * with them here. The manager's own total is the F1 score, which is computed
   * from gameweek results and owes nothing to this number.
   */
  points: number;
  acquisition: Acquisition;
}

export interface Squad {
  /** The manager — our player ID, so it links to `/players/[playerId]`. */
  leagueEntry: LeagueEntryId;
  managerName: string;
  teamName: string;
  players: SquadPlayer[];
  /** How many of the 15 the clock picked for them. Pure banter material. */
  autoPickCount: number;
}

export interface SquadsResponse {
  /** In league order, leader first. */
  squads: Squad[];
  /** Elements owned by nobody. */
  freeAgentCount: number;
  /** True once the draft has run; false pre-draft, when every squad is empty. */
  drafted: boolean;
}

/**
 * The draft choices, or `[]` if the draft has not run.
 *
 * Missing choices are not an error — pre-draft the squads are simply empty,
 * and a squad view that renders "not drafted yet" is more use than one that
 * throws.
 */
async function fetchDraftChoices(leagueId: number): Promise<DraftChoice[]> {
  try {
    const body = await fetchUpstream<{ choices?: DraftChoice[] }>(
      fplApi.draftChoices(leagueId),
      900,
    );
    return body.choices ?? [];
  } catch {
    return [];
  }
}

async function computeSquads(): Promise<SquadsResponse> {
  const leagueId = getLeagueId();

  const [league, ownership, bootstrap, choices] = await Promise.all([
    fetchLeagueDetails(leagueId),
    fetchUpstream<{ element_status: ElementStatus[] }>(
      fplApi.elementStatus(leagueId),
      900,
    ),
    // The static dataset is ~850 KB and changes about as often as a transfer
    // window, so it gets a much longer window than ownership does.
    fetchUpstream<DraftBootstrap>(fplApi.draftBootstrap(), 21600),
    fetchDraftChoices(leagueId),
  ]);

  // Every map below is keyed by the branded ID it actually holds, so the join
  // cannot quietly cross identities. The brands are erased at runtime, so
  // this costs nothing and a `Number()` here would buy nothing but the bug.
  const elements = new Map<ElementId, DraftElement>(
    bootstrap.elements.map((element) => [element.id, element]),
  );
  const clubs = new Map<number, DraftTeam>(
    bootstrap.teams.map((team) => [team.id, team]),
  );
  const positions = new Map<number, DraftElementType>(
    bootstrap.element_types.map((type) => [type.id, type]),
  );
  const choiceByElement = new Map<ElementId, DraftChoice>(
    choices.map((choice) => [choice.element, choice]),
  );

  // Keyed by entry_id, because that is what `element_status[].owner` gives us.
  const owned = new Map<EntryId, ElementId[]>();
  let freeAgentCount = 0;

  for (const status of ownership.element_status) {
    if (status.owner === null) {
      freeAgentCount++;
      continue;
    }

    const forEntry = owned.get(status.owner) ?? [];
    forEntry.push(status.element);
    owned.set(status.owner, forEntry);
  }

  function toSquadPlayer(element: ElementId, owner: EntryId): SquadPlayer {
    const details = elements.get(element);
    const choice = choiceByElement.get(element);

    let acquisition: Acquisition;

    if (!choice) {
      acquisition = { kind: 'free-agent' };
    } else if (choice.entry === owner) {
      acquisition = {
        kind: 'drafted',
        round: choice.round,
        pick: choice.pick,
        wasAuto: choice.was_auto,
      };
    } else {
      acquisition = { kind: 'acquired', draftedRound: choice.round };
    }

    const club = details ? clubs.get(details.team) : undefined;

    return {
      element,
      code: details?.code ?? null,
      name: details?.web_name ?? `Player ${element}`,
      position: details
        ? toPosition(positions.get(details.element_type)?.singular_name_short)
        : 'UNK',
      club: club?.short_name ?? '—',
      clubCode: club?.code ?? null,
      points: details?.total_points ?? 0,
      acquisition,
    };
  }

  // League position, which `details` already carries — no extra call, and no
  // need for the season computation just to know who is top. Anyone missing
  // from `standings` sorts last rather than to the front on a 0.
  const rankByEntry = new Map<LeagueEntryId, number>(
    league.standings.map((standing) => [standing.league_entry, standing.rank]),
  );

  // The one place the two manager identities meet: ownership is looked up by
  // `entry_id`, but the squad is keyed by `id` — the league entry — because
  // that is what the rest of the app calls a player.
  const squads = league.league_entries.map((entry): Squad => {
    const players = (owned.get(entry.entry_id) ?? [])
      .map((element) => toSquadPlayer(element, entry.entry_id))
      .sort(byPositionThenName);

    return {
      leagueEntry: entry.id,
      managerName: `${entry.player_first_name} ${entry.player_last_name}`,
      teamName: entry.entry_name,
      players,
      autoPickCount: players.filter(
        (player) =>
          player.acquisition.kind === 'drafted' && player.acquisition.wasAuto,
      ).length,
    };
  });

  return {
    // Sorted by league position, so `squads[0]` is the leader — which is what
    // the compare column opens against.
    squads: squads.sort(
      (a, b) =>
        (rankByEntry.get(a.leagueEntry) ?? Infinity) -
        (rankByEntry.get(b.leagueEntry) ?? Infinity),
    ),
    freeAgentCount,
    drafted: squads.some((squad) => squad.players.length > 0),
  };
}

/**
 * Squads, cached.
 *
 * The draft bootstrap alone is ~850 KB and measured 1.2-2.0s, which was
 * effectively all of this page's cold render. Caching the joined result — a
 * few KB — keeps that off the request path for every instance, not just the
 * one that warmed its own memory.
 */
export const getSquads = cachedRead(
  CACHE_KEY,
  CACHE_TTL_SECONDS,
  computeSquads,
);

/** Upstream sends the position as a bare string; keep it in the union. */
function toPosition(raw: string | undefined): Position {
  return POSITION_ORDER.includes(raw as Position) ? (raw as Position) : 'UNK';
}

function byPositionThenName(a: SquadPlayer, b: SquadPlayer): number {
  const positionDelta =
    POSITION_ORDER.indexOf(a.position) - POSITION_ORDER.indexOf(b.position);

  return positionDelta !== 0 ? positionDelta : a.name.localeCompare(b.name);
}

import {
  POSITION_ORDER,
  type DraftChoice,
  type ElementId,
  type ElementStatus,
  type EntryId,
  type LeagueEntryId,
  type Position,
} from '@/interfaces/fpl';

import { fetchUpstream, fplApi, getLeagueId } from './fpl-api';
import { fetchLeagueDetails } from './league';
import { getElementLookup } from './draft-elements';
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
  name: string;
  position: Position;
  club: string;
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

  const [league, ownership, lookup, choices] = await Promise.all([
    fetchLeagueDetails(leagueId),
    fetchUpstream<{ element_status: ElementStatus[] }>(
      fplApi.elementStatus(leagueId),
      900,
    ),
    // Names, positions and clubs come from the shared element lookup, which
    // holds the ~850 KB static dataset parsed once — see `draft-elements.ts`.
    getElementLookup(),
    fetchDraftChoices(leagueId),
  ]);

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

    return {
      element,
      ...lookup.describe(element),
      acquisition,
    };
  }

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
    squads,
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

function byPositionThenName(a: SquadPlayer, b: SquadPlayer): number {
  const positionDelta =
    POSITION_ORDER.indexOf(a.position) - POSITION_ORDER.indexOf(b.position);

  return positionDelta !== 0 ? positionDelta : a.name.localeCompare(b.name);
}

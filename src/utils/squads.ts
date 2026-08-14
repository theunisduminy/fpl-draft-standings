import {
  POSITION_ORDER,
  type DraftChoice,
  type ElementCode,
  type ElementId,
  type ElementStatus,
  type EntryId,
  type LeagueEntryId,
  type Position,
} from '@/interfaces/fpl';

import { fetchUpstream, fplApi, getLeagueId } from './fpl-api';
import { fetchLeagueDetails } from './league';
import {
  buildFromBootstrap,
  getElementLookup,
  type ElementLookup,
} from './draft-elements';
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
  /** Season-stable, and what a headshot URL is built from. Null if unresolved. */
  code: ElementCode | null;
  /**
   * The footballer's season total — **not** what they scored for this manager.
   * A player traded in at GW10 brings their first nine gameweeks with them.
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

  const [league, ownership, initialLookup, choices] = await Promise.all([
    fetchLeagueDetails(leagueId),
    fetchUpstream<{ element_status: ElementStatus[] }>(
      fplApi.elementStatus(leagueId),
      900,
    ),
    // Names, positions, clubs, codes and points come from the shared element
    // lookup — the reference tables when they can answer, the ~850 KB static
    // dataset when they cannot. See `draft-elements.ts`.
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

  // The completeness half of the fallback, and the only place it can be
  // decided: the lookup is built before anybody knows which elements will be
  // asked for, and ownership is what finally says. A table missing one owned
  // element falls the **whole** read back rather than leaving a `Player 412`
  // in somebody's midfield — a hole nobody would think to question, where a
  // slower page is merely slower.
  const ownedElements = [...owned.values()].flat();
  const lookup =
    initialLookup.source === 'table' &&
    ownedElements.some((element) => !initialLookup.has(element))
      ? await refetchFromBootstrap(ownedElements, initialLookup)
      : initialLookup;

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

/**
 * Rebuild the lookup from the bootstrap after the table came up short.
 *
 * Loud, because a fallback nobody can see is a sync that fails for weeks while
 * the pages quietly keep paying full price. If even the bootstrap cannot be
 * reached, the incomplete table is still better than nothing: the page renders
 * with `Player {id}` for the strays rather than failing outright.
 */
async function refetchFromBootstrap(
  ownedElements: ElementId[],
  fallbackTo: ElementLookup,
): Promise<ElementLookup> {
  const missing = ownedElements.filter((element) => !fallbackTo.has(element));

  console.error(
    `[reference] draft_elements is missing ${missing.length} owned element(s) ` +
      `(${missing.slice(0, 5).join(', ')}); falling back to the draft bootstrap.`,
  );

  try {
    return await buildFromBootstrap();
  } catch (error) {
    console.error('[reference] the bootstrap fallback also failed.', error);

    return fallbackTo;
  }
}

function byPositionThenName(a: SquadPlayer, b: SquadPlayer): number {
  const positionDelta =
    POSITION_ORDER.indexOf(a.position) - POSITION_ORDER.indexOf(b.position);

  return positionDelta !== 0 ? positionDelta : a.name.localeCompare(b.name);
}

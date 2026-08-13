import {
  asElementId,
  asEntryId,
  type DraftBootstrap,
  type DraftChoice,
  type ElementId,
  type ElementStatus,
  type EntryId,
  type LeagueEntryId,
} from '@/interfaces/fpl';
import { unstable_cache } from 'next/cache';

import { fplApi, getLeagueId } from './fpl-api';
import { fetchLeagueDetails } from './league';
import { getCache, setCache } from './cache';

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
/** Revalidate the shared squad cache with `revalidateTag` on this. */
export const SQUADS_TAG = 'squads';

/** Positions, in the order a team sheet is read. */
const POSITION_ORDER = ['GKP', 'DEF', 'MID', 'FWD'];

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
  /** `GKP` | `DEF` | `MID` | `FWD`, from the draft bootstrap. */
  position: string;
  club: string;
  /** Last season's total, which is all the draft bootstrap carries pre-season. */
  totalPoints: number;
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

async function fetchJson<T>(url: string, revalidate: number): Promise<T> {
  const res = await fetch(url, { next: { revalidate } });

  if (!res.ok) {
    throw new Error(`Request to ${url} failed with ${res.status}`);
  }

  return (await res.json()) as T;
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
    const body = await fetchJson<{ choices?: DraftChoice[] }>(
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
    fetchJson<{ element_status: ElementStatus[] }>(
      fplApi.elementStatus(leagueId),
      900,
    ),
    // The static dataset is ~850 KB and changes about as often as a transfer
    // window, so it gets a much longer window than ownership does.
    fetchJson<DraftBootstrap>(fplApi.draftBootstrap(), 21600),
    fetchDraftChoices(leagueId),
  ]);

  const elements = new Map(
    bootstrap.elements.map((element) => [Number(element.id), element]),
  );
  const clubs = new Map(bootstrap.teams.map((team) => [team.id, team]));
  const positions = new Map(
    bootstrap.element_types.map((type) => [type.id, type]),
  );
  const choiceByElement = new Map(
    choices.map((choice) => [Number(choice.element), choice]),
  );

  // Keyed by entry_id, because that is what `element_status[].owner` gives us.
  const owned = new Map<number, ElementId[]>();
  let freeAgentCount = 0;

  for (const status of ownership.element_status) {
    if (status.owner === null) {
      freeAgentCount++;
      continue;
    }

    const forEntry = owned.get(Number(status.owner)) ?? [];
    forEntry.push(asElementId(Number(status.element)));
    owned.set(Number(status.owner), forEntry);
  }

  // The one place the two manager identities meet: ownership is looked up by
  // `entry_id`, but the squad is keyed by `id` — the league entry — because
  // that is what the rest of the app calls a player.
  const squads = league.league_entries.map((entry): Squad => {
    const players = (owned.get(Number(entry.entry_id)) ?? [])
      .map((element) =>
        toSquadPlayer(
          element,
          asEntryId(Number(entry.entry_id)),
          elements,
          clubs,
          positions,
          choiceByElement,
        ),
      )
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
 * Squads, through Next's Data Cache.
 *
 * The draft bootstrap alone is ~850 KB and measured 1.2–2.0s, which was
 * effectively all of this page's cold render. Caching the joined result — a
 * few KB — keeps that off the request path for every instance, not just the
 * one that warmed its own memory.
 */
const readSquads = unstable_cache(computeSquads, [CACHE_KEY], {
  revalidate: CACHE_TTL_SECONDS,
  tags: [SQUADS_TAG],
});

export async function getSquads(): Promise<SquadsResponse> {
  const cached = getCache<SquadsResponse>(CACHE_KEY);
  if (cached) return cached;

  const response = await readSquads();
  setCache(CACHE_KEY, response, CACHE_TTL_SECONDS);
  return response;
}

function toSquadPlayer(
  element: ElementId,
  owner: EntryId,
  elements: Map<number, DraftBootstrap['elements'][number]>,
  clubs: Map<number, DraftBootstrap['teams'][number]>,
  positions: Map<number, DraftBootstrap['element_types'][number]>,
  choiceByElement: Map<number, DraftChoice>,
): SquadPlayer {
  const details = elements.get(Number(element));
  const choice = choiceByElement.get(Number(element));

  let acquisition: Acquisition;

  if (!choice) {
    acquisition = { kind: 'free-agent' };
  } else if (Number(choice.entry) === Number(owner)) {
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
    name: details?.web_name ?? `Player ${element}`,
    position: details
      ? (positions.get(details.element_type)?.singular_name_short ?? '—')
      : '—',
    club: details ? (clubs.get(details.team)?.short_name ?? '—') : '—',
    totalPoints: details?.total_points ?? 0,
    acquisition,
  };
}

function byPositionThenName(a: SquadPlayer, b: SquadPlayer): number {
  const positionDelta =
    indexOfPosition(a.position) - indexOfPosition(b.position);

  return positionDelta !== 0 ? positionDelta : a.name.localeCompare(b.name);
}

function indexOfPosition(position: string): number {
  const index = POSITION_ORDER.indexOf(position);

  return index === -1 ? POSITION_ORDER.length : index;
}

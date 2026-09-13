import {
  POSITION_ORDER,
  type DraftChoice,
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
import { ensureCovers, getElementLookup } from './draft-elements';
import { readDraftPicks } from '@/server/data/lineage';
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
  /** The club's crest identity. Null when the element cannot be resolved. */
  clubCode: TeamCode | null;
  /**
   * The footballer's season total.
   *
   * **Everything they have scored this season, not what they scored for this
   * manager.** A player traded in at GW10 brings their first nine gameweeks
   * with them here. The manager's own total is the F1 score, which is computed
   * from gameweek results and owes nothing to this number.
   *
   * Pre-season this is last season's total: upstream carries it until shortly
   * before GW1. See `agents/API.md`.
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
 * One stored draft pick, as the lineage DAL returns it.
 *
 * Named through the reader rather than imported so this module does not take
 * a second opinion on the row shape: whatever `readDraftPicks` resolves to an
 * array of is what provenance joins against.
 */
type StoredDraftPick = Awaited<ReturnType<typeof readDraftPicks>>[number];

/**
 * The draft choices for the provenance join, database first.
 *
 * Stored picks win when they cover every owned element; anything else — an
 * empty table pre-seed, an unreadable one mid-outage, a table missing one
 * owned element — falls the whole read back to live choices rather than
 * rendering a partial record. Live choices are therefore fetched only on that
 * fallback path, never alongside a covering table.
 *
 * The join semantics below are exactly today's: a stored row becomes the same
 * `DraftChoice` shape the live endpoint would have given, so `toSquadPlayer`
 * cannot tell which source answered.
 */
async function resolveChoices(
  leagueId: number,
  stored: StoredDraftPick[],
  owned: ReadonlySet<ElementId>,
): Promise<Map<ElementId, DraftChoice>> {
  const storedByElement = new Map(stored.map((pick) => [pick.elementId, pick]));
  const covers =
    stored.length > 0 &&
    [...owned].every((element) => storedByElement.has(element));

  if (covers) {
    return new Map(
      stored.map((pick) => [
        pick.elementId,
        {
          element: pick.elementId,
          entry: pick.entry,
          round: pick.round,
          pick: pick.pick,
          index: pick.draftIndex,
          was_auto: pick.wasAuto,
          seconds_to_pick: pick.secondsToPick,
        } satisfies DraftChoice,
      ]),
    );
  }

  if (stored.length > 0) {
    console.error(
      '[squads] stored draft picks do not cover every owned element; falling back to live choices.',
    );
  }

  return new Map(
    (await fetchDraftChoices(leagueId)).map((choice) => [
      choice.element,
      choice,
    ]),
  );
}

/**
 * The draft choices, or `[]` if the draft has not run.
 *
 * Missing choices are not an error — pre-draft the squads are simply empty,
 * and a squad view that renders "not drafted yet" is more use than one that
 * throws. Now also the fallback behind the stored-picks read above.
 */
async function fetchDraftChoices(leagueId: number): Promise<DraftChoice[]> {
  try {
    const body = await fetchUpstream<{ choices?: DraftChoice[] }>(
      fplApi.draftChoices(leagueId),
    );
    return body.choices ?? [];
  } catch {
    return [];
  }
}

async function computeSquads(): Promise<SquadsResponse> {
  const leagueId = getLeagueId();

  const [league, ownership, initialLookup, storedPicks] = await Promise.all([
    fetchLeagueDetails(leagueId),
    fetchUpstream<{ element_status: ElementStatus[] }>(
      fplApi.elementStatus(leagueId),
    ),
    // Names, positions, clubs, codes and points come from the shared element
    // lookup — the reference tables when they can answer, the ~850 KB static
    // dataset when they cannot. See `draft-elements.ts`.
    getElementLookup(),
    // The frozen draft record, when the cron has seeded it. A failure here
    // must cost the database read, never the page: `null` falls through to
    // live choices below exactly like an empty table.
    readDraftPicks().catch((error) => {
      console.error(
        '[squads] stored draft picks could not be read; falling back to live choices.',
        error,
      );
      return null;
    }),
  ]);

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

  // Ownership is what finally says which elements this page needs, so the
  // completeness check happens here rather than when the lookup was built.
  const lookup = await ensureCovers(initialLookup, [...owned.values()].flat());

  // Provenance is database first: stored picks drive the join when they cover
  // every owned element, and live choices are read only while the table cannot
  // answer — empty, unreadable, or missing one owned element. The fallback is
  // whole-read rather than per-element, so a gap never renders one `free-agent`
  // hole in an otherwise drafted squad. This is the deliberate inverse of the
  // reference-table trust direction: picks are a record, not an accelerator.
  const choiceByElement = await resolveChoices(
    leagueId,
    storedPicks ?? [],
    new Set<ElementId>([...owned.values()].flat()),
  );

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

function byPositionThenName(a: SquadPlayer, b: SquadPlayer): number {
  const positionDelta =
    POSITION_ORDER.indexOf(a.position) - POSITION_ORDER.indexOf(b.position);

  return positionDelta !== 0 ? positionDelta : a.name.localeCompare(b.name);
}

import {
  asElementCode,
  type DraftBootstrap,
  type ElementId,
  type PlTeam,
} from '@/interfaces/fpl';
import { readElements } from '@/server/data/elements';
import { readTeams } from '@/server/data/pl-teams';
import {
  isReferenceUsable,
  toElementDetails,
  toPlTeam,
  toPosition,
  type ElementDetails,
} from './reference-mapping';

import { fetchUpstream, fplApi } from './fpl-api';
import { cachedRead } from './cache';

/**
 * Resolving a draft element ID into a name, a position, a club and a code.
 *
 * Two features need this — the squads page and the results drawer — and they
 * were each building the same three maps from the same payload and repeating
 * the same fallbacks. One copy, so `'—'` and `Player {id}` cannot drift apart.
 *
 * **Two sources, one shape.** The answer comes from `draft_elements` and
 * `pl_teams` when they can give it, and from the ~850 KB draft bootstrap when
 * they cannot. The table is an accelerator, never a source of truth: a sync
 * that fails, a database that is down, a season not yet populated — each of
 * those makes this slower and none of them makes it wrong.
 */

const CACHE_KEY = 'draft-elements';
const CACHE_TTL_SECONDS = 21600; // 6 hours — the static set moves with transfers

export type { ElementDetails };

export interface ElementLookup {
  describe: (element: ElementId) => ElementDetails;
  /**
   * Is this element actually in the lookup?
   *
   * The table path cannot check completeness when it is built — it has no idea
   * which elements anyone will ask for, because ownership has not been read
   * yet. So the check moves to the caller, which does know: see `squads.ts`,
   * where a squad holding an element the table lacks falls the **whole** read
   * back to the bootstrap rather than rendering one player as `Player 412`.
   */
  has: (element: ElementId) => boolean;
  /** Which source answered. Only the `table` path can be incomplete. */
  source: 'table' | 'bootstrap';
}

/**
 * The lookup, built once per process per TTL.
 *
 * Next's Data Cache stores the *response*, not the parsed object — so without
 * this every drawer open re-parsed 850 KB and rebuilt three maps to read
 * fifteen elements. `cachedRead` keeps the derived maps in memory instead,
 * which is the difference it was written for. That still holds on the table
 * path: the rows are smaller, but the maps are the same maps.
 */
export const getElementLookup = cachedRead(
  CACHE_KEY,
  CACHE_TTL_SECONDS,
  buildElementLookup,
);

async function buildElementLookup(): Promise<ElementLookup> {
  const fromTable = await buildFromTable();

  return fromTable ?? buildFromBootstrap();
}

/**
 * The lookup as the two reference tables can answer it, or `null` if they
 * cannot — in which case the caller falls back and logs why.
 *
 * **Both tables are required.** `draft_elements` stores a club's `team_code`
 * and nothing else about it, so elements alone cannot name a club: a lookup
 * built on them would render every club column as `'—'` while reporting
 * success. Checking `pl_teams` here is what stops that shipping.
 */
async function buildFromTable(): Promise<ElementLookup | null> {
  const now = new Date();

  // Both reads are keyed on the league alone, so they run together and neither
  // waits on the other. Guarded individually because a rejected `Promise.all`
  // here would turn a Neon outage into a 500 on pages that render fine today —
  // the database is an accelerator, and an accelerator that fails must cost
  // latency, never correctness.
  const [elements, teams] = await Promise.all([
    readElements().catch(unreachable('draft_elements')),
    readTeams().catch(unreachable('pl_teams')),
  ]);

  if (!elements || !teams) return null;

  const elementVerdict = isReferenceUsable(
    elements.rows,
    elements.syncedAt,
    now,
  );

  if (!elementVerdict.usable) {
    return fallingBack(
      'draft_elements',
      elementVerdict.reason,
      elementVerdict.detail,
    );
  }

  const teamVerdict = isReferenceUsable(teams.rows, teams.syncedAt, now);

  if (!teamVerdict.usable) {
    return fallingBack('pl_teams', teamVerdict.reason, teamVerdict.detail);
  }

  const clubsByCode = new Map<number, PlTeam>(
    teams.rows.map((row) => [row.code, toPlTeam(row)]),
  );
  const detailsById = new Map<ElementId, ElementDetails>(
    elements.rows.map((row) => [
      row.elementId as ElementId,
      toElementDetails(row, clubsByCode),
    ]),
  );

  return {
    source: 'table',
    has: (element) => detailsById.has(element),
    describe: (element) => detailsById.get(element) ?? unknownElement(element),
  };
}

/**
 * The lookup from the draft bootstrap — the path that was here all along, and
 * which every fallback lands on.
 *
 * Exported so a caller that discovers the table was incomplete can rebuild
 * from the source rather than serving a hole. The 850 KB response is still held
 * by Next's Data Cache for the same six hours, so a fallback re-parses; it does
 * not re-download.
 */
export async function buildFromBootstrap(): Promise<ElementLookup> {
  const bootstrap = await fetchUpstream<DraftBootstrap>(
    fplApi.draftBootstrap(),
    CACHE_TTL_SECONDS,
  );

  // Keyed by the branded ID each map actually holds, so the join cannot
  // quietly cross identities. The brands are erased at runtime, so this costs
  // nothing and a `Number()` here would buy nothing but the bug.
  const elements = new Map(
    bootstrap.elements.map((element) => [element.id, element]),
  );
  const clubs = new Map(bootstrap.teams.map((team) => [team.id, team]));
  const positions = new Map(
    bootstrap.element_types.map((type) => [type.id, type]),
  );

  return {
    source: 'bootstrap',
    has: (element) => elements.has(element),
    describe: (element) => {
      const details = elements.get(element);

      if (!details) return unknownElement(element);

      return {
        name: details.web_name,
        position: toPosition(
          positions.get(details.element_type)?.singular_name_short,
        ),
        club: clubs.get(details.team)?.short_name ?? '—',
        code: asElementCode(details.code),
        points: details.total_points,
      };
    },
  };
}

/** What an unresolvable element looks like, identically on both paths. */
function unknownElement(element: ElementId): ElementDetails {
  return {
    name: `Player ${element}`,
    position: 'UNK',
    club: '—',
    code: null,
    points: 0,
  };
}

/**
 * A fallback is silent to the reader and loud to the operator.
 *
 * Without the log, a sync can fail for weeks while every page quietly goes on
 * paying full price for a table that exists to avoid it.
 */
function fallingBack(table: string, reason: string, detail?: string): null {
  console.error(
    `[reference] ${table} unusable (${reason}${detail ? `: ${detail}` : ''}); falling back to the draft bootstrap.`,
  );

  return null;
}

function unreachable(table: string) {
  return (error: unknown): null => {
    console.error(
      `[reference] ${table} could not be read; falling back.`,
      error,
    );

    return null;
  };
}

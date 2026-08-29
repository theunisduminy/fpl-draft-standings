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
  reportUnusableReference,
  missingElements,
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

/**
 * The cacheable half: **plain data, and it has to stay that way.**
 *
 * `cachedRead` puts this through `unstable_cache`, which serialises to Next's
 * Data Cache — so anything that does not survive `JSON.stringify` is silently
 * dropped on the way in and simply absent on the way out. A `Map`, a `Set` or a
 * method would look perfect on the process that computed it and arrive as `{}`
 * at every process that later reads the cache.
 *
 * That failure is invisible in development, because `cachedRead` deliberately
 * returns `compute` unwrapped outside production, so nothing is ever
 * round-tripped. It would surface only as a crash on a warm lambda in
 * production. Keep this a `Record`, not a `Map`.
 */
interface ElementLookupData {
  source: 'table' | 'bootstrap';
  /** Keyed by element id. JSON turns the keys into strings; lookup coerces. */
  details: Record<number, ElementDetails>;
}

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
 * The data, cached; the functions, built fresh around it on every call.
 *
 * The split is the whole point — see {@link ElementLookupData}. Only the record
 * crosses the cache boundary, so a Data Cache hit on a cold lambda revives
 * something complete rather than an object whose methods vanished in transit.
 *
 * Caching is still worth it for the same reason it always was: Next's Data
 * Cache stores the *response*, not the parsed object, so without this every
 * drawer open re-parsed 850 KB to read fifteen elements. Wrapping a record in
 * three closures costs nothing next to that.
 */
const readLookupData = cachedRead(
  CACHE_KEY,
  CACHE_TTL_SECONDS,
  buildLookupData,
);

export async function getElementLookup(): Promise<ElementLookup> {
  return toLookup(await readLookupData());
}

/**
 * Guarantee a lookup can name every element the caller is about to ask for.
 *
 * The completeness half of the fallback, and the only place it can be decided:
 * the lookup is built before anybody knows which elements will be asked for,
 * and ownership (or a team sheet) is what finally says. A table missing one of
 * them falls the **whole** read back rather than leaving a `Player 412` in
 * somebody's midfield — a hole nobody would think to question, where a slower
 * page is merely slower.
 *
 * Lifted out of `squads.ts` so the invariant is not opt-in: the drawer went in
 * without it and would have rendered exactly that hole. Every caller of
 * `getElementLookup` that knows its element set should pass through here.
 *
 * If even the bootstrap cannot be reached, the incomplete lookup is still
 * better than nothing — the page renders with `Player {id}` for the strays
 * rather than failing outright.
 */
export async function ensureCovers(
  lookup: ElementLookup,
  elements: readonly ElementId[],
): Promise<ElementLookup> {
  if (lookup.source !== 'table') return lookup;

  const missing = missingElements(lookup.has, elements);

  if (missing.length === 0) return lookup;

  console.error(
    `[reference] draft_elements is missing ${missing.length} requested element(s) ` +
      `(${missing.slice(0, 5).join(', ')}); falling back to the draft bootstrap.`,
  );

  try {
    return await buildFromBootstrap();
  } catch (error) {
    console.error('[reference] the bootstrap fallback also failed.', error);

    return lookup;
  }
}

/** Wrap a plain record in the lookup interface. Cheap, and done per call. */
function toLookup(data: ElementLookupData): ElementLookup {
  return {
    source: data.source,
    has: (element) => Object.hasOwn(data.details, element),
    describe: (element) => data.details[element] ?? unknownElement(element),
  };
}

async function buildLookupData(): Promise<ElementLookupData> {
  const fromTable = await buildFromTable();

  return fromTable ?? buildBootstrapData();
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
async function buildFromTable(): Promise<ElementLookupData | null> {
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

  const details: Record<number, ElementDetails> = {};

  for (const row of elements.rows) {
    details[row.elementId] = toElementDetails(row, clubsByCode);
  }

  return { source: 'table', details };
}

/**
 * The lookup from the draft bootstrap — the path that was here all along, and
 * which every fallback lands on.
 *
 * Exported (as {@link buildFromBootstrap}) so a caller that discovers the table
 * was incomplete can rebuild from the source rather than serving a hole. The
 * 850 KB response is still held by Next's Data Cache for the same six hours, so
 * a fallback re-parses; it does not re-download.
 */
async function buildBootstrapData(): Promise<ElementLookupData> {
  const bootstrap = await fetchUpstream<DraftBootstrap>(
    fplApi.draftBootstrap(),
  );

  // Both of these are addressed by the bootstrap's own season-scoped `id`,
  // which is why they are local scaffolding and never leave this function:
  // what comes out the other side is keyed by element id and carries the
  // season-stable `code`, matching exactly what the table path produces.
  const clubs = new Map(bootstrap.teams.map((team) => [team.id, team]));
  const positions = new Map(
    bootstrap.element_types.map((type) => [type.id, type]),
  );

  const details: Record<number, ElementDetails> = {};

  for (const element of bootstrap.elements) {
    details[element.id] = {
      name: element.web_name,
      position: toPosition(
        positions.get(element.element_type)?.singular_name_short,
      ),
      club: clubs.get(element.team)?.short_name ?? '—',
      clubCode: clubs.get(element.team)?.code ?? null,
      code: asElementCode(element.code),
      points: element.total_points,
    };
  }

  return { source: 'bootstrap', details };
}

/** The bootstrap lookup, ready to use. The fallback every caller lands on. */
export async function buildFromBootstrap(): Promise<ElementLookup> {
  return toLookup(await buildBootstrapData());
}

/** What an unresolvable element looks like, identically on both paths. */
function unknownElement(element: ElementId): ElementDetails {
  return {
    name: `Player ${element}`,
    position: 'UNK',
    club: '—',
    clubCode: null,
    code: null,
    points: 0,
  };
}

/** Report the fallback, then hand back the `null` every caller returns. */
function fallingBack(table: string, reason: string, detail?: string): null {
  reportUnusableReference(table, reason, detail, 'draft bootstrap');

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

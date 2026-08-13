import {
  POSITION_ORDER,
  type DraftBootstrap,
  type DraftElement,
  type DraftElementType,
  type DraftTeam,
  type ElementId,
  type Position,
} from '@/interfaces/fpl';

import { fetchUpstream, fplApi } from './fpl-api';
import { cachedRead } from './cache';

/**
 * Resolving a draft element ID into a name, a position and a club.
 *
 * Two features need this — the squads page and the results drawer — and they
 * were each building the same three maps from the same payload and repeating
 * the same fallbacks. One copy, so `'—'` and `Player {id}` cannot drift apart.
 */

const CACHE_KEY = 'draft-elements';
const CACHE_TTL_SECONDS = 21600; // 6 hours — the static set moves with transfers

/** What we know about one footballer, flattened out of the bootstrap. */
export interface ElementDetails {
  name: string;
  position: Position;
  club: string;
}

export interface ElementLookup {
  describe: (element: ElementId) => ElementDetails;
  /** The raw element, for the rare caller that needs a field not flattened above. */
  raw: (element: ElementId) => DraftElement | undefined;
}

/**
 * The lookup, built once per process per TTL.
 *
 * The draft bootstrap is ~850 KB, and Next's Data Cache stores the *response*,
 * not the parsed object — so without this every drawer open re-parsed 850 KB
 * and rebuilt three maps to read fifteen elements. `cachedRead` keeps the
 * derived maps in memory instead, which is the difference it was written for.
 */
export const getElementLookup = cachedRead(
  CACHE_KEY,
  CACHE_TTL_SECONDS,
  buildElementLookup,
);

async function buildElementLookup(): Promise<ElementLookup> {
  const bootstrap = await fetchUpstream<DraftBootstrap>(
    fplApi.draftBootstrap(),
    CACHE_TTL_SECONDS,
  );

  // Keyed by the branded ID each map actually holds, so the join cannot
  // quietly cross identities. The brands are erased at runtime, so this costs
  // nothing and a `Number()` here would buy nothing but the bug.
  const elements = new Map<ElementId, DraftElement>(
    bootstrap.elements.map((element) => [element.id, element]),
  );
  const clubs = new Map<number, DraftTeam>(
    bootstrap.teams.map((team) => [team.id, team]),
  );
  const positions = new Map<number, DraftElementType>(
    bootstrap.element_types.map((type) => [type.id, type]),
  );

  return {
    raw: (element) => elements.get(element),
    describe: (element) => {
      const details = elements.get(element);

      return {
        name: details?.web_name ?? `Player ${element}`,
        position: details
          ? toPosition(positions.get(details.element_type)?.singular_name_short)
          : 'UNK',
        club: details ? (clubs.get(details.team)?.short_name ?? '—') : '—',
      };
    },
  };
}

/** Upstream sends the position as a bare string; keep it in the union. */
export function toPosition(raw: string | undefined): Position {
  return POSITION_ORDER.includes(raw as Position) ? (raw as Position) : 'UNK';
}

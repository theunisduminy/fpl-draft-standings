import 'server-only';

import type { EntryId } from '@/interfaces/fpl';

/**
 * The single source of truth for every upstream Premier League API this app
 * reads, plus the environment-derived league ID they are addressed with.
 *
 * Response shapes and pre-season behaviour are documented in `agents/API.md`.
 * Nothing in here is bundled for the browser — see the `server-only` import.
 */

/** Draft game API. Powers standings, entries, picks and gameweek scoring. */
const DRAFT_API = 'https://draft.premierleague.com/api';

/** Classic FPL API. Powers the static dataset (teams, elements) and fixtures. */
const FANTASY_API = 'https://fantasy.premierleague.com/api';

/**
 * The Pulse API behind premierleague.com. The real league table and the real
 * fixture list — neither of which either FPL game can answer.
 *
 * It is here rather than in a module of its own because this file's job is to
 * be the *one* place an upstream URL is written, and "upstream" is a boundary,
 * not a vendor. Its own quirks are documented on the builders below.
 */
const PULSE_API = 'https://footballapi.pulselive.com/football';

/**
 * Pulse rejects a request with no `Origin` it recognises. Nothing else is
 * needed — no key, no cookie — and the header is only meaningful server-side,
 * which this module already is.
 */
const PULSE_HEADERS = { Origin: 'https://www.premierleague.com' } as const;

const LEAGUE_ID_VAR = 'FPL_LEAGUE_ID';

/**
 * Draft league IDs are season-scoped — a renewed league gets a fresh ID every
 * August — so the ID is read from the environment, never hard-coded.
 *
 * Read lazily (rather than at module scope) so a missing value fails the
 * request that needs it, not `next build`.
 */
export function getLeagueId(): number {
  const raw = process.env[LEAGUE_ID_VAR];

  if (!raw) {
    throw new Error(
      `${LEAGUE_ID_VAR} is not set. Copy .env.example to .env.local and set it to ` +
        'your draft league ID (the number in your draft.premierleague.com league URL).',
    );
  }

  const leagueId = Number(raw);

  if (!Number.isInteger(leagueId) || leagueId <= 0) {
    throw new Error(
      `${LEAGUE_ID_VAR} must be a positive integer, received "${raw}".`,
    );
  }

  return leagueId;
}

/**
 * Read one upstream endpoint as JSON, or throw.
 *
 * The only sanctioned way to assert an upstream payload's shape, so the cast
 * happens in one place and every caller gets the same error format and the
 * same revalidate contract. Endpoints with a documented non-JSON failure mode
 * — `event-status` answers 404 with a bare string — need their own handling
 * rather than this.
 */
export async function fetchUpstream<T>(
  url: string,
  revalidateSeconds: number,
  headers?: Record<string, string>,
): Promise<T> {
  const res = await fetch(url, {
    headers,
    next: { revalidate: revalidateSeconds },
  });

  if (!res.ok) {
    throw new Error(`Request to ${url} failed with ${res.status}`);
  }

  return (await res.json()) as T;
}

/**
 * The same read, with the `Origin` Pulse insists on.
 *
 * A separate function rather than a header argument at each call site, because
 * a Pulse call that forgets the header does not fail loudly — it comes back
 * `403` and reads as "the Premier League page is down".
 */
export async function fetchPulse<T>(
  url: string,
  revalidateSeconds: number,
): Promise<T> {
  return fetchUpstream<T>(url, revalidateSeconds, { ...PULSE_HEADERS });
}

export const fplApi = {
  /**
   * Per-gameweek processing status for the draft game.
   * Returns HTTP 404 with the bare string `"Game not started"` before the
   * season begins — always go through `fetchEventStatus` rather than calling
   * this directly.
   */
  eventStatus: () => `${DRAFT_API}/pl/event-status`,

  /**
   * Draft game state (`current_event`, `next_event`, `processing_status`).
   * Available year-round, including pre-season, so it is the reliable way to
   * ask "has the season started?".
   */
  game: () => `${DRAFT_API}/game`,

  /** League metadata, its entries, and standings. */
  leagueDetails: (leagueId: number) =>
    `${DRAFT_API}/league/${leagueId}/details`,

  /** Live per-element stats for one gameweek, keyed by element ID. */
  eventLive: (gameweek: number) => `${DRAFT_API}/event/${gameweek}/live`,

  /**
   * Who currently owns each element: `{ element, owner, status }`.
   *
   * The right source for squads — it reflects trades and waivers, and it works
   * before GW1, unlike `entryEvent`. **`owner` is an `entry_id`**, not the
   * league entry.
   */
  elementStatus: (leagueId: number) =>
    `${DRAFT_API}/league/${leagueId}/element-status`,

  /** Every pick made in the draft, in order. A historical record only. */
  draftChoices: (leagueId: number) => `${DRAFT_API}/draft/${leagueId}/choices`,

  /**
   * The draft game's static dataset: elements, teams, element types.
   *
   * **No trailing slash** — adding one 404s here, the exact inverse of the
   * classic API below. Draft element IDs must be resolved against this, never
   * against the classic bootstrap: the two disagree on ~21 of 581 elements.
   */
  draftBootstrap: () => `${DRAFT_API}/bootstrap-static`,

  /**
   * One entry's picks for one gameweek.
   * 404s with `"No pick history"` until that entry has played a gameweek.
   *
   * Takes the `entry_id`, **not** the `league_entries[].id` we use as the
   * player ID everywhere else. Passing the wrong one 404s, which this app
   * swallows as "no picks" — so the gameweek would vanish rather than fail
   * loudly. Hence the branded parameter type.
   */
  entryEvent: (entryId: EntryId, gameweek: number) =>
    `${DRAFT_API}/entry/${entryId}/event/${gameweek}`,

  /**
   * The full classic-FPL static dataset: teams, events, elements.
   * The trailing slash is required — without it the API answers 301.
   */
  bootstrapStatic: () => `${FANTASY_API}/bootstrap-static/`,

  /**
   * All 380 Premier League fixtures for the season.
   * The trailing slash is required — without it the API answers 301.
   */
  fixtures: () => `${FANTASY_API}/fixtures/`,
} as const;

/**
 * The Pulse API — the real Premier League, as premierleague.com renders it.
 *
 * Every one of these needs the `Origin` header: go through `fetchPulse`.
 *
 * **`compSeasonId` is season-scoped, exactly like the draft league ID**, so it
 * is never written down. `pulseApi.compSeasons()` lists them and
 * `getCompSeasonId()` in `premier-league-data.ts` picks the newest. Do not be
 * tempted to parse the labels to find it: they are not one format. The current
 * season reads `"English Premier League Season 2026/2027"` while the one before
 * it reads `"2025/26"`.
 */
export const pulseApi = {
  /**
   * Every Premier League season Pulse knows, newest first, as `{ id, label }`.
   * Competition `1` is the Premier League.
   */
  compSeasons: () => `${PULSE_API}/competitions/1/compseasons?pageSize=50`,

  /**
   * The league table. `detail=2` is what adds `form`, `annotations` and the
   * home/away splits; without it you get positions and totals only.
   *
   * Out of season this returns all 20 clubs on zero with `tables[0].gameWeek`
   * of `0` — **not** an empty array. Guard on `gameWeek`, never on length.
   */
  standings: (compSeasonId: number) =>
    `${PULSE_API}/standings?compSeasons=${compSeasonId}&altIds=true&detail=2`,

  /**
   * All 380 fixtures in one response — `pageSize` of 400 returns `numPages: 1`,
   * so this never needs paging. `statuses=U,L,C` asks for upcoming, live and
   * complete, which is everything.
   */
  fixtures: (compSeasonId: number) =>
    `${PULSE_API}/fixtures?comps=1&compSeasons=${compSeasonId}` +
    '&pageSize=400&page=0&sort=asc&statuses=U,L,C&altIds=true',
} as const;

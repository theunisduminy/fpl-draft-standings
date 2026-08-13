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

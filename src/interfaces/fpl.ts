/**
 * The FPL APIs' numeric identities, made impossible to mix up.
 *
 * Three different numbers are in play, all of them plain integers, and two of
 * them sit in the same range for a given season:
 *
 * | Identity        | This season      | Addresses                                  |
 * | --------------- | ---------------- | ------------------------------------------ |
 * | `LeagueEntryId` | 39836–39843, 40460 | a manager *in this league* — our player ID |
 * | `EntryId`       | 39780–39786, 40404 | a manager's team — `/api/entry/{id}/...`   |
 * | `ElementId`     | 1–581            | a footballer                                 |
 *
 * Typed as bare `number`, all three are interchangeable to the compiler, and
 * every way of getting it wrong fails *quietly*: an `EntryId` passed where a
 * `LeagueEntryId` belongs finds no match and renders "Unknown"; the reverse
 * 404s and the gameweek silently disappears from the season.
 *
 * Branding them costs nothing at runtime — these are `number`s once compiled —
 * and turns all of that into a type error.
 *
 * ## Element IDs are not portable between the two APIs
 *
 * `ElementId` is only meaningful against the API it came from. The draft and
 * classic bootstraps both return 581 elements over the same ID range, and 560
 * of them agree — but the rest do not (element 554 is Tzolis on the draft API
 * and Van Oevelen on the classic one). Anything holding a draft element must
 * be resolved against the draft bootstrap. See agents/API.md.
 */

declare const brand: unique symbol;

type Brand<T, B extends string> = T & { readonly [brand]: B };

/**
 * `league_entries[].id` — a manager's membership of this league.
 *
 * This is the app's player ID: it keys `PlayerDetails`, every stored
 * gameweek score, the `league_members` mapping, and the `/players/[playerId]`
 * URL. Season-scoped, like everything else FPL mints.
 */
export type LeagueEntryId = Brand<number, 'LeagueEntryId'>;

/**
 * `league_entries[].entry_id` — a manager's team.
 *
 * Only ever used to address `/api/entry/{entry_id}/...`, and returned as the
 * `owner` of an owned element by `/api/league/{id}/element-status`. Never use
 * it as a player ID.
 */
export type EntryId = Brand<number, 'EntryId'>;

/** `elements[].id` — a footballer, in the API it was read from. */
export type ElementId = Brand<number, 'ElementId'>;

/**
 * `teams[].code` — a Premier League club, **stable across seasons**.
 *
 * The only FPL identifier in this file that is not season-scoped, and the
 * reason it is the one we persist. The sibling `teams[].id` is 1–20 assigned
 * alphabetically and re-minted every August: Arsenal is `id` 1 and `code` 3
 * today, but a promoted club whose name sorts first would take `id` 1 next
 * season and silently repoint every stored row. `code` 3 is Arsenal for good.
 */
export type TeamCode = Brand<number, 'TeamCode'>;

/**
 * Brand a number that is already known to be a league entry.
 *
 * For values crossing into the app from somewhere the type system cannot see:
 * a database column, a URL segment, an upstream payload. Prefer
 * {@link parseLeagueEntryId} for anything that came from a user.
 */
export const asLeagueEntryId = (value: number): LeagueEntryId =>
  value as LeagueEntryId;

/** Brand a number already known to be an entry ID. */
export const asEntryId = (value: number): EntryId => value as EntryId;

/** Brand a number already known to be an element ID. */
export const asElementId = (value: number): ElementId => value as ElementId;

/** Brand a number already known to be a team code — a database column, a payload. */
export const asTeamCode = (value: number): TeamCode => value as TeamCode;

/**
 * Parse an untrusted team code — a form field.
 *
 * Being a real integer is necessary but nowhere near sufficient: the caller
 * still has to check it against the codes upstream actually returned, because
 * any number would survive this. See `updateProfile`.
 */
export function parseTeamCode(raw: string): TeamCode | null {
  if (!/^\d+$/.test(raw)) return null;

  const value = Number(raw);

  return value > 0 ? asTeamCode(value) : null;
}

/**
 * Parse an untrusted league entry ID — a route param, a query string.
 *
 * Returns `null` rather than `NaN` for anything that is not a positive
 * integer, so callers have to handle the bad case. `parseInt` would accept
 * "39837-drop-table" and hand back 39837.
 */
export function parseLeagueEntryId(raw: string): LeagueEntryId | null {
  if (!/^\d+$/.test(raw)) return null;

  const value = Number(raw);

  if (!Number.isSafeInteger(value) || value <= 0) return null;

  return asLeagueEntryId(value);
}

/**
 * One manager in the league, from `/api/league/{id}/details`.
 *
 * Note `id` and `entry_id` are different numbers for the same person — the
 * single most common mistake against this API.
 */
export interface LeagueEntry {
  id: LeagueEntryId;
  entry_id: EntryId;
  entry_name: string;
  player_first_name: string;
  player_last_name: string;
  short_name: string;
  joined_time: string;
  waiver_pick: number;
}

/** One row of `standings` from `/api/league/{id}/details`. */
export interface LeagueStanding {
  league_entry: LeagueEntryId;
  rank: number;
  last_rank: number;
  rank_sort: number;
  total: number;
  matches_played: number;
  matches_won: number;
  matches_drawn: number;
  matches_lost: number;
  points_for: number;
  points_against: number;
  event_total: number;
}

/** `/api/league/{id}/details`, trimmed to the parts we read. */
export interface LeagueDetails {
  league_entries: LeagueEntry[];
  standings: LeagueStanding[];
}

/** One pick from `/api/entry/{entry_id}/event/{gw}`. Positions 1–11 start. */
export interface EntryPick {
  element: ElementId;
  position: number;
}

/** `/api/event/{gw}/live` — per-element stats, keyed by element ID. */
export interface EventLive {
  /**
   * **Empty (`{}`) for a gameweek that has not been scored**, which is truthy.
   * Always check `Object.keys(...).length` — see agents/AGENTS.md.
   */
  elements: Record<string, { stats?: { total_points?: number } }>;
}

/**
 * One element's ownership, from `/api/league/{id}/element-status`.
 *
 * `owner` is an {@link EntryId}, **not** a {@link LeagueEntryId} — this is the
 * third place in the API where the two are easy to confuse. `null` means the
 * element is a free agent.
 */
export interface ElementStatus {
  element: ElementId;
  owner: EntryId | null;
  status: 'a' | 'o';
  in_accepted_trade: boolean;
}

/** One footballer from the **draft** bootstrap. */
export interface DraftElement {
  id: ElementId;
  web_name: string;
  first_name: string;
  second_name: string;
  /** Index into `teams[].id`. */
  team: number;
  /** Index into `element_types[].id`. */
  element_type: number;
  total_points: number;
}

/** One club from the draft bootstrap. */
export interface DraftTeam {
  id: number;
  name: string;
  short_name: string;
}

/**
 * One club from the classic bootstrap's `teams`.
 *
 * `id` is deliberately absent. It is season-scoped and we have no use for it —
 * everything here keys on {@link TeamCode}, so leaving `id` off the type means
 * nobody can reach for the wrong one.
 */
export interface PlTeam {
  code: TeamCode;
  name: string;
  short_name: string;
}

/**
 * A playing position, in the order a team sheet is read.
 *
 * `UNK` is the fallback for an element the bootstrap cannot resolve, so that
 * every consumer handles a real member of the union rather than an arbitrary
 * string. Keeping this closed means a new position is a compile error at every
 * `Record<Position, …>` — the ordering and the badge colours cannot silently
 * fall through.
 */
export const POSITION_ORDER = ['GKP', 'DEF', 'MID', 'FWD', 'UNK'] as const;

export type Position = (typeof POSITION_ORDER)[number];

/** A playing position. `singular_name_short` is `GKP` / `DEF` / `MID` / `FWD`. */
export interface DraftElementType {
  id: number;
  singular_name_short: string;
  singular_name: string;
}

/**
 * `/api/bootstrap-static` on the **draft** host.
 *
 * Not interchangeable with the classic bootstrap of the same name — see
 * {@link ElementId}.
 */
export interface DraftBootstrap {
  elements: DraftElement[];
  teams: DraftTeam[];
  element_types: DraftElementType[];
}

/**
 * One pick from `/api/draft/{leagueId}/choices`.
 *
 * `entry` is an {@link EntryId}. A choice records who drafted a player, which
 * is not necessarily who owns them now.
 */
export interface DraftChoice {
  element: ElementId;
  entry: EntryId;
  round: number;
  pick: number;
  index: number;
  was_auto: boolean;
  seconds_to_pick: number | null;
}

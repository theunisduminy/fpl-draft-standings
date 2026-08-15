import type { TeamCode } from './fpl';

/**
 * The real Premier League: the table, the fixtures, the results.
 *
 * These come from a third upstream — the Pulse API behind premierleague.com —
 * and not from either FPL game. See `agents/API.md` for why: the classic
 * bootstrap carries `played`/`win`/`points` fields on every club and leaves
 * them all at zero, so FPL cannot answer "what is the actual table?" at all.
 *
 * **Pulse types stay in this file and never mix with the FPL ones.** Pulse
 * mints its own club ids (`club.id`: Arsenal is 1, Bournemouth 127) which are a
 * *fourth* integer family alongside `LeagueEntryId`, `EntryId` and `ElementId`,
 * and they overlap all three. Nothing below is branded and nothing below leaves
 * the mapping layer: `toLeagueTableRow` and `toFixture` in
 * `src/utils/premier-league.ts` convert every `Pulse*` shape into the view
 * models at the bottom of this file, which key on {@link TeamCode} like the
 * rest of the app. If a `Pulse*` type is imported by a component, that is the
 * bug.
 */

/* ------------------------------------------------------------------ *
 * Upstream shapes — exactly what Pulse returns, nothing tidied.
 * ------------------------------------------------------------------ */

/** A club, as Pulse describes it. `altIds.opta` is `"t" + our `TeamCode``. */
export interface PulseTeam {
  name: string;
  shortName: string;
  id: number;
  club: { name: string; shortName: string; abbr: string; id: number };
  altIds: { opta: string };
}

/** One row of the table. `detail=2` is what fills `form` and `annotations`. */
export interface PulseStandingsEntry {
  team: PulseTeam;
  position: number;
  /**
   * Where the club started the current gameweek. Absent pre-season, which is
   * one of the two signals that no football has been played yet.
   */
  startingPosition?: number;
  overall: PulseTotals;
  home: PulseTotals;
  away: PulseTotals;
  /** The last five fixtures, newest last. Empty before a ball is kicked. */
  form: PulseFixture[];
  /** Qualification and relegation markers: `EU_CL`, `EU_EL`, `RELEGATED`. */
  annotations?: { type: string; destination?: string }[];
}

export interface PulseTotals {
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalsDifference: number;
  points: number;
}

export interface PulseStandingsResponse {
  compSeason: { id: number; label: string };
  tables: {
    /**
     * **The pre-season tell, and the only reliable one.** Out of season Pulse
     * returns all 20 clubs with every total at zero rather than an empty
     * array, so a length check says "we have a table" about a page of noughts.
     * `gameWeek` is `0` until the first match is played.
     */
    gameWeek: number;
    entries: PulseStandingsEntry[];
  }[];
}

/**
 * One fixture.
 *
 * `teams` is always `[home, away]` — Pulse encodes the venue by position, not
 * by a field, so nothing may sort or filter this array in place.
 */
export interface PulseFixture {
  id: number;
  /** `U` upcoming, `L` live, `C` complete. */
  status: 'U' | 'L' | 'C';
  /** Who won, once there is an answer. `H` home, `A` away, `D` draw. */
  outcome?: 'H' | 'A' | 'D';
  gameweek: { gameweek: number; compSeason: { id: number } };
  kickoff: { millis?: number; label?: string; gmtOffset?: number };
  teams: { team: PulseTeam; score?: number }[];
  ground?: { name: string; city: string };
  /** Minutes played, for a live match: `{ label: "74'00" }`. */
  clock?: { secs: number; label: string };
  altIds: { opta: string };
}

export interface PulseFixturesResponse {
  pageInfo: { page: number; numPages: number; numEntries: number };
  content: PulseFixture[];
}

export interface PulseCompSeasonsResponse {
  content: { id: number; label: string }[];
}

/* ------------------------------------------------------------------ *
 * View models — what the rest of the app is allowed to see.
 * ------------------------------------------------------------------ */

/** How a club finished one of its last five: newest last. */
export type FormResult = 'W' | 'D' | 'L';

/** A club, reduced to what a table row or a fixture card renders. */
export interface PlClub {
  /**
   * The season-stable code {@link clubCrestUrl} takes, recovered from Pulse's
   * `altIds.opta` (`"t3"` → `3`). Verified to match FPL's `teams[].code` for
   * all 20 clubs, which is why this page needs no FPL call and no lookup
   * table.
   */
  code: TeamCode;
  name: string;
  /** `"Bournemouth"`, where `name` is `"Bournemouth"` and abbr is `"BOU"`. */
  shortName: string;
  abbr: string;
}

export interface LeagueTableRow {
  position: number;
  club: PlClub;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
  /** Oldest first, at most five. Empty until the club has played. */
  form: FormResult[];
  /**
   * Places gained since the gameweek began: positive is upward movement.
   * `null` when Pulse gives no `startingPosition`, which is every row
   * pre-season.
   */
  movement: number | null;
  /** `EU_CL`, `EU_EL`, `EU_UECL`, `RELEGATED` — whatever Pulse marks. */
  annotations: string[];
}

export interface PlFixture {
  id: number;
  gameweek: number;
  status: 'U' | 'L' | 'C';
  home: PlClub;
  away: PlClub;
  /** `null` until the match starts. Both or neither. */
  homeScore: number | null;
  awayScore: number | null;
  outcome: 'H' | 'A' | 'D' | null;
  /** Epoch milliseconds. `null` for a fixture with no date set yet. */
  kickoffMillis: number | null;
  /** Pulse's own pre-formatted string, e.g. `"Sat 22 Aug 2026, 12:30 BST"`. */
  kickoffLabel: string | null;
  ground: string | null;
  /** Only ever set while `status` is `L`: `"74'00"`. */
  clockLabel: string | null;
}

/** Every fixture of one gameweek, in kick-off order. */
export interface GameweekFixtures {
  gameweek: number;
  fixtures: PlFixture[];
}

/**
 * Everything the Premier League page renders, read once on the server.
 *
 * `hasStarted` is computed rather than inferred at the call site, because the
 * two ways of getting it wrong — a truthy check on `entries`, or trusting a row
 * of zeros — are the exact mistakes `agents/AGENTS.md` calls out.
 */
export interface PremierLeagueData {
  /**
   * `false` before the first match of the season.
   *
   * Nothing renders it today — the pre-season notice it was added for was
   * dropped, because a table of noughts in August reads as early rather than
   * broken. It stays because it is the one correct answer to "has football
   * been played?", and the wrong ways to ask are the exact traps in
   * `agents/AGENTS.md`. Anything tempted to check `table.length` or a club's
   * `played` should read this instead.
   */
  hasStarted: boolean;
  /**
   * All 20 clubs, in Pulse's order. Pre-season that is every club on zero
   * points, alphabetically, which is exactly what premierleague.com shows.
   */
  table: LeagueTableRow[];
  /** All 38 gameweeks, ascending. */
  gameweeks: GameweekFixtures[];
  /** The gameweek a visitor should land on: live, else next up, else the last. */
  currentGameweek: number;
}

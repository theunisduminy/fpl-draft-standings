import { asTeamCode } from '@/interfaces/fpl';
import type {
  FormResult,
  GameweekFixtures,
  LeagueTableRow,
  MatchdayFixtures,
  PlClub,
  PlFixture,
  PulseCompSeasonsResponse,
  PulseFixture,
  PulseStandingsEntry,
  PulseStandingsResponse,
  PulseTeam,
} from '@/interfaces/premier-league';

/**
 * Turning Pulse payloads into the app's view models. Pure, and tested.
 *
 * The split mirrors `scoring.ts` against `gameweek-data.ts`: everything here
 * is a function of its arguments, so every rule below is pinned by a test in
 * `premier-league.test.ts`. `premier-league-data.ts` keeps the fetching, the
 * caching and the season lookup and calls into this module.
 *
 * The rules worth knowing before you change anything:
 *
 * - **A club we cannot map is dropped, never faked.** `toClub` returns `null`
 *   rather than a placeholder, because the only thing downstream of a club is
 *   a crest URL and the asset host answers a wrong code with `403` — a broken
 *   image and nothing in the log.
 * - **Pre-season is a state, not an absence.** Pulse hands back 20 clubs on
 *   zero points rather than an empty list, so anything asking "has football
 *   been played?" must go through `hasSeasonStarted`, which reads `gameWeek`.
 *   A length check on `entries` is true in August and answers a different
 *   question.
 * - **`teams` is `[home, away]` by position.** Nothing here sorts it.
 */

/** `"t91"` → `91`, the code `clubCrestUrl` wants. `null` if it is not that. */
export function optaTeamCode(optaId: string | undefined): number | null {
  if (!optaId) return null;

  const match = /^t(\d+)$/.exec(optaId);

  return match ? Number(match[1]) : null;
}

/**
 * A Pulse club, reduced to what we render.
 *
 * `null` when the opta alt-ID is missing or malformed — which means the caller
 * omits the row or the fixture entirely. That is the right failure: a table
 * missing a club is visibly wrong, where a table with a blank crest and the
 * name "Unknown" looks like a rendering nit and gets ignored.
 */
export function toClub(team: PulseTeam | undefined): PlClub | null {
  const code = optaTeamCode(team?.altIds?.opta);

  if (!team || code === null) return null;

  return {
    code: asTeamCode(code),
    name: team.club?.name ?? team.name,
    shortName: team.club?.shortName ?? team.shortName ?? team.name,
    abbr: team.club?.abbr ?? '',
  };
}

/**
 * How one club fared in the five fixtures Pulse attaches to its table row.
 *
 * Derived rather than read: Pulse gives the fixtures, not the letters, and
 * whether `outcome: 'H'` is a win depends on which side of `teams` the club
 * was on. Sorted by kick-off rather than trusting the array's order, so the
 * pills read oldest-to-newest whichever way upstream sends them.
 */
export function formFrom(entry: PulseStandingsEntry): FormResult[] {
  const teamId = entry.team?.id;

  return [...(entry.form ?? [])]
    .sort((a, b) => (a.kickoff?.millis ?? 0) - (b.kickoff?.millis ?? 0))
    .map((fixture): FormResult | null => {
      if (!fixture.outcome) return null;
      if (fixture.outcome === 'D') return 'D';

      const wasHome = fixture.teams?.[0]?.team?.id === teamId;
      const wasAway = fixture.teams?.[1]?.team?.id === teamId;

      // A fixture the club does not appear in is upstream nonsense, not a loss.
      if (!wasHome && !wasAway) return null;

      const homeWon = fixture.outcome === 'H';

      return wasHome === homeWon ? 'W' : 'L';
    })
    .filter((result): result is FormResult => result !== null);
}

/** One row of the table. `null` for a club that cannot be mapped. */
export function toLeagueTableRow(
  entry: PulseStandingsEntry,
): LeagueTableRow | null {
  const club = toClub(entry.team);

  if (!club) return null;

  const totals = entry.overall;

  return {
    position: entry.position,
    club,
    played: totals.played,
    won: totals.won,
    drawn: totals.drawn,
    lost: totals.lost,
    goalsFor: totals.goalsFor,
    goalsAgainst: totals.goalsAgainst,
    goalDifference: totals.goalsDifference,
    points: totals.points,
    form: formFrom(entry),
    // Upward movement is a *fall* in position number, hence the subtraction
    // this way round. Absent pre-season, when there is no previous position to
    // have moved from — `null`, so the column renders nothing rather than a
    // confident zero.
    movement:
      typeof entry.startingPosition === 'number'
        ? entry.startingPosition - entry.position
        : null,
    annotations: (entry.annotations ?? []).map(
      (note) => note.destination ?? note.type,
    ),
  };
}

/**
 * Has a ball been kicked this season?
 *
 * `tables[0].gameWeek` is `0` until the first match, while `entries` is a full
 * twenty clubs either way. This is the whole reason the check is a named
 * function: `if (response.tables[0].entries.length)` is true in August and
 * answers the wrong question.
 */
export function hasSeasonStarted(response: PulseStandingsResponse): boolean {
  const table = response.tables?.[0];

  return (table?.gameWeek ?? 0) > 0;
}

/** The table, ordered as Pulse ordered it. Unmappable clubs are dropped. */
export function toLeagueTable(
  response: PulseStandingsResponse,
): LeagueTableRow[] {
  return (response.tables?.[0]?.entries ?? [])
    .map(toLeagueTableRow)
    .filter((row): row is LeagueTableRow => row !== null);
}

/** One fixture. `null` if either club fails to map. */
export function toFixture(fixture: PulseFixture): PlFixture | null {
  const home = toClub(fixture.teams?.[0]?.team);
  const away = toClub(fixture.teams?.[1]?.team);

  if (!home || !away) return null;

  const homeScore = fixture.teams[0]?.score;
  const awayScore = fixture.teams[1]?.score;

  // Scores arrive together or not at all, and `0` is a real score — so the
  // test is for the number, never for truthiness.
  const played = typeof homeScore === 'number' && typeof awayScore === 'number';

  return {
    id: fixture.id,
    gameweek: fixture.gameweek?.gameweek ?? 0,
    status: fixture.status,
    home,
    away,
    homeScore: played ? homeScore : null,
    awayScore: played ? awayScore : null,
    outcome: fixture.outcome ?? null,
    kickoffMillis: fixture.kickoff?.millis ?? null,
    kickoffLabel: fixture.kickoff?.label ?? null,
    ground: fixture.ground?.name ?? null,
    // Only a live match has a meaningful clock. A completed one carries
    // `90+5'00`, which as a badge on a finished result reads as in-progress.
    clockLabel: fixture.status === 'L' ? (fixture.clock?.label ?? null) : null,
  };
}

/**
 * The 380 fixtures, split into gameweeks and sorted by kick-off within each.
 *
 * A fixture with no gameweek is dropped rather than collected under `0`: it is
 * a postponement upstream has not re-scheduled, and a phantom "gameweek 0" tab
 * is worse than its absence.
 */
export function groupByGameweek(fixtures: PlFixture[]): GameweekFixtures[] {
  const byGameweek = new Map<number, PlFixture[]>();

  for (const fixture of fixtures) {
    if (fixture.gameweek < 1) continue;

    const bucket = byGameweek.get(fixture.gameweek);

    if (bucket) bucket.push(fixture);
    else byGameweek.set(fixture.gameweek, [fixture]);
  }

  return [...byGameweek.entries()]
    .sort(([a], [b]) => a - b)
    .map(([gameweek, list]) => ({
      gameweek,
      fixtures: list.sort(
        (a, b) => (a.kickoffMillis ?? 0) - (b.kickoffMillis ?? 0),
      ),
    }));
}

/** Where a fixture with no scheduled date collects. */
export const DATE_TBC = 'Date to be confirmed';

/**
 * Split one gameweek's fixtures into matchdays.
 *
 * A gameweek runs Friday to Monday, so ten fixtures in one list read as a
 * single block when they are really three or four separate afternoons.
 *
 * **The day comes from Pulse's own label, split on the comma**, not from a
 * `Date`. Deriving it here would render the server's timezone on the first
 * paint and the reader's after hydration — a visible flip and a hydration
 * warning — and it would let the heading disagree with the kick-off times
 * printed under it. Pulse has already localised both halves of
 * `"Sat 22 Aug 2026, 12:30 BST"` to UK time, which is the right zone for a
 * Premier League kick-off.
 *
 * Input order is preserved: `groupByGameweek` has already sorted by kick-off,
 * so days come out chronologically without sorting again. Anything undated
 * collects under {@link DATE_TBC}, which upstream does use — a fixture moved
 * for television loses its slot for weeks.
 */
export function groupByDay(fixtures: PlFixture[]): MatchdayFixtures[] {
  const byDay = new Map<string, PlFixture[]>();

  for (const fixture of fixtures) {
    const day = fixture.kickoffLabel?.split(', ')[0] || DATE_TBC;
    const bucket = byDay.get(day);

    if (bucket) bucket.push(fixture);
    else byDay.set(day, [fixture]);
  }

  return [...byDay.entries()].map(([day, list]) => ({ day, fixtures: list }));
}

/**
 * Which gameweek a visitor should land on.
 *
 * In order of preference: one with a match in progress, then the earliest with
 * anything still to play, then the last of the season. The middle case is what
 * makes the page useful on a Tuesday — the weekend's results have finished but
 * the next round has not started, and the interesting tab is the one coming up
 * rather than gameweek 1.
 *
 * Takes `now` as an argument rather than reading the clock, so the rule is
 * testable. Every caller passes `Date.now()`.
 */
export function pickCurrentGameweek(
  gameweeks: GameweekFixtures[],
  now: number,
): number {
  if (gameweeks.length === 0) return 1;

  const live = gameweeks.find((week) =>
    week.fixtures.some((fixture) => fixture.status === 'L'),
  );

  if (live) return live.gameweek;

  const upcoming = gameweeks.find((week) =>
    week.fixtures.some(
      (fixture) =>
        fixture.status === 'U' && (fixture.kickoffMillis ?? Infinity) >= now,
    ),
  );

  return upcoming?.gameweek ?? gameweeks[gameweeks.length - 1].gameweek;
}

/**
 * The current season's Pulse ID: the highest one it lists.
 *
 * **By ID, not by label.** Pulse's own labels are inconsistent between seasons
 * — `"English Premier League Season 2026/2027"` sits directly above
 * `"2025/26"` in the same response — so any parse of them is a bug waiting for
 * next August. IDs ascend, which is the only property this needs.
 */
export function newestCompSeasonId(
  response: PulseCompSeasonsResponse,
): number | null {
  const ids = (response.content ?? [])
    .map((season) => season.id)
    .filter((id) => Number.isFinite(id));

  return ids.length > 0 ? Math.max(...ids) : null;
}

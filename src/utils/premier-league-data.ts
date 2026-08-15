import 'server-only';

import { fetchPulse, pulseApi } from '@/utils/fpl-api';
import type {
  GameweekFixtures,
  LeagueTableRow,
  PlFixture,
  PremierLeagueData,
  PulseCompSeasonsResponse,
  PulseFixturesResponse,
  PulseStandingsResponse,
} from '@/interfaces/premier-league';
import {
  groupByGameweek,
  hasSeasonStarted,
  newestCompSeasonId,
  pickCurrentGameweek,
  toFixture,
  toLeagueTable,
} from '@/utils/premier-league';
import { cachedRead } from './cache';

/**
 * The real Premier League table and fixture list, read on the server.
 *
 * The fetching, caching and season lookup half of the pair; every rule lives
 * next door in `premier-league.ts`, which is pure and tested. Same split as
 * `gameweek-data.ts` against `scoring.ts`, for the same reason: a rule inside
 * an `async` function wrapped around three upstream calls cannot be tested.
 *
 * **There is deliberately no fallback.** The old FPL-derived table was
 * considered and rejected: it cannot see points deductions, so it would differ
 * from the official table by a few points in exactly the season where that
 * matters, and it would do it silently. If Pulse is unreachable the page says
 * the Premier League could not be reached. A wrong table is worse than no
 * table.
 */

const SEASON_KEY = 'pulse-compseason';
const SEASON_TTL_SECONDS = 86_400; // a day — a season ID changes once, in June

const DATA_KEY = 'premier-league';
/**
 * Five minutes. Long enough that a busy Saturday does not re-fetch per
 * visitor, short enough that a live score is never stale enough to argue with
 * the television.
 */
const DATA_TTL_SECONDS = 300;

/**
 * The current season's Pulse ID.
 *
 * Discovered, never written down — it is a season-scoped identifier exactly
 * like `FPL_LEAGUE_ID`, and hard-coding one is what the house rules forbid.
 * Cached for a day on its own key rather than folded into the read below, so
 * the five-minute score refresh does not re-ask a question whose answer
 * changes annually.
 */
const getCompSeasonId = cachedRead(
  SEASON_KEY,
  SEASON_TTL_SECONDS,
  async (): Promise<number> => {
    const response = await fetchPulse<PulseCompSeasonsResponse>(
      pulseApi.compSeasons(),
      SEASON_TTL_SECONDS,
    );

    const id = newestCompSeasonId(response);

    if (id === null) {
      throw new Error('Pulse listed no Premier League seasons.');
    }

    return id;
  },
);

/** The table and every fixture, cached. The page calls this and nothing else. */
export async function getPremierLeagueData(): Promise<PremierLeagueData> {
  const { hasStarted, table, gameweeks } = await readSeason();

  return {
    hasStarted,
    table,
    gameweeks,
    // Computed per request rather than inside the cache: which gameweek is
    // "current" is a function of the clock, and a cached answer would keep
    // pointing at last weekend for the whole TTL.
    currentGameweek: pickCurrentGameweek(gameweeks, Date.now()),
  };
}

const readSeason = cachedRead(
  DATA_KEY,
  DATA_TTL_SECONDS,
  async (): Promise<Omit<PremierLeagueData, 'currentGameweek'>> => {
    const compSeasonId = await getCompSeasonId();

    // Two independent reads of the same season — no reason to serialise them.
    const [standings, fixtures] = await Promise.all([
      fetchPulse<PulseStandingsResponse>(
        pulseApi.standings(compSeasonId),
        DATA_TTL_SECONDS,
      ),
      fetchPulse<PulseFixturesResponse>(
        pulseApi.fixtures(compSeasonId),
        DATA_TTL_SECONDS,
      ),
    ]);

    const table: LeagueTableRow[] = toLeagueTable(standings);

    const mapped = (fixtures.content ?? [])
      .map(toFixture)
      .filter((fixture): fixture is PlFixture => fixture !== null);

    const gameweeks: GameweekFixtures[] = groupByGameweek(mapped);

    return {
      hasStarted: hasSeasonStarted(standings),
      table,
      gameweeks,
    };
  },
);

import type {
  GameweekPerformance,
  GameweekDataResponse,
} from '@/interfaces/players';
import { GameWeekStatus } from '@/interfaces/match';
import type {
  EventLive,
  GameState,
  LeagueEntry,
  LeagueStanding,
} from '@/interfaces/fpl';
import {
  getFinalisedGameweeks,
  getStoredPerformances,
  storeFinalisedGameweeks,
} from '@/server/data/gameweeks';
import {
  aggregatePlayers,
  assignRanks,
  buildRumblerData,
  scoreGameweek,
  type EntryPicks,
} from './scoring';
import { deriveSeasonState } from './season-state';
import { fplApi, getLeagueId, upstreamSignal } from './fpl-api';
import { fetchEntryPicks } from './gameweek-squad';
import { fetchLeagueDetails } from './league';
import { cachedRead } from './cache';

const CACHE_KEY = 'gameweek-data';
/**
 * Five minutes, matching the `revalidate` on the live feed and the picks below.
 *
 * It was an hour, on the reasoning that FPL data only changes once per
 * gameweek. That stopped being true when the season started including the
 * gameweek in progress: caching the aggregate for longer than its own inputs
 * means a reader watching Sunday afternoon sees a score frozen at lunchtime,
 * and the whole point of showing an in-flight week is that it moves. The extra
 * cost is one league read, two state reads and nine calls for the live gameweek
 * per five minutes, which for an eight-person league is nothing.
 */
const CACHE_TTL_SECONDS = 300;
const BATCH_SIZE = 5; // fetch 5 gameweeks at a time to avoid flooding the API

/**
 * Between seasons `/pl/event-status` answers 404 with the bare string
 * "Game not started" — not the usual `{ status: [...] }` object. Treat that as
 * "no gameweeks have been played yet" so the app renders an empty season
 * instead of failing.
 */
async function fetchEventStatus(): Promise<GameWeekStatus[]> {
  const res = await fetch(fplApi.eventStatus(), {
    signal: upstreamSignal(),
    next: { revalidate: 300 },
  });

  if (res.status === 404) {
    return [];
  }

  if (!res.ok) {
    throw new Error(`Event status request failed with ${res.status}`);
  }

  const body = await res.json();
  return Array.isArray(body?.status) ? body.status : [];
}

/**
 * `/api/game` — the only draft endpoint that answers year-round.
 *
 * Resolves to `null` rather than throwing, because it is a cross-check: without
 * it `deriveSeasonState` falls back to `event-status` alone, which is still
 * correct for a completed gameweek and merely defers an in-flight one. Losing
 * the whole season because one state endpoint blipped would be the worse trade.
 */
async function fetchGameState(): Promise<GameState | null> {
  try {
    const res = await fetch(fplApi.game(), {
      signal: upstreamSignal(),
      next: { revalidate: 60 },
    });

    if (!res.ok) return null;

    const body = (await res.json()) as GameState;

    return typeof body?.current_event_finished === 'boolean' ? body : null;
  } catch (error) {
    console.error('[season] /api/game could not be read.', error);
    return null;
  }
}

/**
 * Score a contiguous run of gameweeks from the live feed and everyone's picks.
 *
 * `finished` is threaded straight through to `scoreGameweek` and is what marks
 * the results as safe to persist. The in-flight gameweek goes through this same
 * function with `false`.
 */
async function fetchGameweekBatch(
  startGw: number,
  endGw: number,
  leagueEntries: LeagueEntry[],
  finished: boolean,
): Promise<GameweekPerformance[]> {
  const batchPromises = [];

  for (let gw = startGw; gw <= endGw; gw++) {
    batchPromises.push(
      Promise.all([
        fetch(fplApi.eventLive(gw), {
          signal: upstreamSignal(),
          next: { revalidate: 300 },
        }).then((res) => res.json() as Promise<EventLive>),
        // `entry_id` addresses the URL, `id` identifies the manager. They are
        // different numbers for the same person; the branded types are what
        // stop them being swapped here.
        ...leagueEntries.map((entry): Promise<EntryPicks> =>
          fetchEntryPicks(entry.entry_id, gw)
            .then((picks) => ({ league_entry: entry.id, picks }))
            // A manager whose picks cannot be read drops out with an empty
            // list, which `scoreGameweek` treats as "not played" rather than
            // scoring a partial league.
            .catch(() => ({ league_entry: entry.id, picks: [] })),
        ),
      ])
        .then(([liveData, ...playerPicks]) => ({
          gameweek: gw,
          liveData,
          playerPicks,
        }))
        .catch(() => ({
          gameweek: gw,
          liveData: null as EventLive | null,
          playerPicks: [] as EntryPicks[],
        })),
    );
  }

  const results = await Promise.all(batchPromises);

  // `scoreGameweek` returns nothing for a gameweek that cannot be scored, so an
  // unplayed week falls out of the results rather than being stored as zeros.
  return results.flatMap(({ gameweek, liveData, playerPicks }) =>
    scoreGameweek(gameweek, liveData, playerPicks, finished),
  );
}

/**
 * Fetch only the gameweeks we don't already hold.
 *
 * A finished gameweek is immutable, so anything already in the database is
 * read back rather than refetched. Recomputing the whole season costs
 * `9 x gameweeks` upstream calls — 344 by May — and the in-memory cache does
 * not survive a cold start, so without this every new serverless instance paid
 * that bill in full.
 *
 * Batching still applies to whatever genuinely is missing, so a first run (or
 * a rebuilt database) behaves exactly as it used to.
 */
async function fetchMissingGameweeks(
  missing: number[],
  leagueEntries: LeagueEntry[],
): Promise<GameweekPerformance[]> {
  const fetched: GameweekPerformance[] = [];

  for (let i = 0; i < missing.length; i += BATCH_SIZE) {
    const batch = missing.slice(i, i + BATCH_SIZE);
    // The batch helper takes a range; consecutive gameweeks are the norm, and
    // a sparse batch just means a few wasted slots in one round.
    const batchData = await fetchGameweekBatch(
      batch[0],
      batch[batch.length - 1],
      leagueEntries,
      // Only ever called with gameweeks `deriveSeasonState` has declared final.
      true,
    );
    fetched.push(...batchData.filter((p) => missing.includes(p.event)));
  }

  return fetched;
}

/**
 * Compute the season from scratch: upstream, database, scoring, aggregation.
 *
 * Expensive — three upstream calls and two database round trips before any
 * gameweek work, which measured ~2s from here, plus nine more calls whenever a
 * gameweek is in flight. Readers always reach it through `getGameweekData()`,
 * never directly.
 *
 * Exported only for the sync job, which must **not** go through the cache: its
 * whole purpose is to write any newly finalised gameweek, and a cache hit would
 * return a count without doing that work while still reporting success. Every
 * other caller wants the cached wrapper.
 */
export async function computeSeasonUncached(): Promise<GameweekDataResponse> {
  const leagueId = getLeagueId();

  // The two database reads are keyed off the league alone, so they do not
  // wait on the upstream calls — issuing all five together removes a serial
  // Neon round trip, which measured 290-650ms, from every cold read.
  const [
    { league_entries, standings },
    status,
    game,
    finalised,
    storedPerformances,
  ] = await Promise.all([
    fetchLeagueDetails(leagueId),
    fetchEventStatus(),
    fetchGameState(),
    getFinalisedGameweeks(),
    getStoredPerformances(),
  ]);

  // The one place "is this gameweek over?" is decided. Read `season-state.ts`
  // before touching it: `event-status` has a row per **date**, so the obvious
  // `some(leagues_updated)` reading declares a gameweek complete on its opening
  // Friday night.
  const { currentGameweek, finalisedThrough } = deriveSeasonState(status, game);

  // Fetch only the gap between what we hold and what is genuinely settled.
  // Nothing in flight ever reaches this list — a stored gameweek is never
  // refetched, so storing a provisional one freezes it for the season.
  const missing: number[] = [];
  for (let gw = 1; gw <= finalisedThrough; gw++) {
    if (!finalised.has(gw)) missing.push(gw);
  }

  const freshPerformances = await fetchMissingGameweeks(
    missing,
    league_entries,
  );

  if (freshPerformances.length > 0) {
    await storeFinalisedGameweeks(freshPerformances);
  }

  // The gameweek being played right now, scored fresh on every cache miss and
  // deliberately never written down.
  //
  // **Shown, not hidden.** A league table that ignores the weekend in progress
  // is wrong on the one day everybody looks at it, so the provisional result
  // ranks and pays F1 points exactly like a settled one; the surfaces that show
  // it say that it is provisional. What it must never do is persist, because
  // `gameweeks` is a claim that a result will never change again.
  const inFlight = currentGameweek > finalisedThrough ? currentGameweek : null;

  const provisional = inFlight
    ? await fetchGameweekBatch(inFlight, inFlight, league_entries, false)
    : [];

  const historicalData = [
    ...withoutInFlight(storedPerformances, inFlight, provisional.length > 0),
    ...freshPerformances,
    ...provisional,
  ];

  // Last resort for the current gameweek when its live feed or its picks are
  // unreadable: upstream's own `event_total`, which is a different source from
  // the starting-XI sum stored everywhere else. Provisional for that reason as
  // much as any other — it is never persisted, so the two sources cannot mix in
  // the history, and the gameweek is retried on the next run.
  const fallback = standingsFallback(
    standings,
    currentGameweek,
    historicalData,
  );

  historicalData.push(...fallback);

  const provisionalGameweek =
    provisional.length > 0 || fallback.length > 0 ? currentGameweek : null;

  const scoredGameweeks = Array.from(
    new Set(historicalData.map((gw) => gw.event)),
  ).sort((a, b) => b - a);

  return {
    players: aggregatePlayers(league_entries, historicalData, standings),
    gameweekPerformances: historicalData,
    currentGameweek,
    scoredGameweeks,
    provisionalGameweek,
    rumblerData: buildRumblerData(historicalData, league_entries),
  };
}

/**
 * Drop stored rows for a gameweek that is still being played.
 *
 * There should never be any: a gameweek is only written once
 * `deriveSeasonState` calls it final. But the whole reason this file changed is
 * that the app used to write one on the opening Friday night, and those rows
 * cannot be corrected by a later run — `storeFinalisedGameweeks` inserts with
 * `onConflictDoNothing`. Left in place they would sit beside the live scoring
 * for the same gameweek and every manager would appear twice.
 *
 * So the live scoring wins and the stale rows are logged, loudly, because the
 * fix is a `scripts/forget-gameweek.mjs` run that nobody will make if the
 * symptom quietly disappears. `replaced` guards against the other direction:
 * with nothing to replace them, keeping the rows beats blanking the gameweek.
 */
function withoutInFlight(
  stored: GameweekPerformance[],
  inFlight: number | null,
  replaced: boolean,
): GameweekPerformance[] {
  if (inFlight === null || !replaced) return stored;
  if (!stored.some((gw) => gw.event === inFlight)) return stored;

  console.error(
    `[season] GW${inFlight} is stored as finalised but is still being played. ` +
      'Using the live scoring; delete the stored rows with ' +
      `\`node --env-file=.env.local scripts/forget-gameweek.mjs ${inFlight} --prod\`.`,
  );

  return stored.filter((gw) => gw.event !== inFlight);
}

/**
 * The current gameweek reconstructed from `standings[].event_total`, or nothing.
 *
 * Only fires when the gameweek is genuinely absent from the results, and only
 * when somebody has actually scored. That second guard is the important one:
 * post-draft and pre-kick-off, upstream returns a full row per manager with
 * `event_total: 0`, and ranking eight zeros is precisely the joint-first bug
 * that this whole change exists to stop.
 */
function standingsFallback(
  standings: LeagueStanding[] | undefined,
  currentGameweek: number,
  performances: GameweekPerformance[],
): GameweekPerformance[] {
  if (!standings || currentGameweek <= 0) return [];
  if (performances.some((gw) => gw.event === currentGameweek)) return [];
  if (!standings.some((standing) => standing.event_total > 0)) return [];

  return assignRanks(
    standings.map((standing) => ({
      league_entry: standing.league_entry,
      event_total: standing.event_total,
    })),
  ).map((player) => ({
    event: currentGameweek,
    league_entry: player.league_entry,
    event_total: player.event_total,
    rank: player.rank,
    finished: false,
  }));
}

/**
 * The season, cached.
 *
 * Both cache layers live in `cachedRead`; see there for why a per-process map
 * still earns its place in front of the shared one. Revalidate early with
 * `revalidateTag('gameweek-data', { expire: 0 })` — which is what the cron
 * route does on every sync.
 */
export const getGameweekData = cachedRead(
  CACHE_KEY,
  CACHE_TTL_SECONDS,
  computeSeasonUncached,
);

import type {
  GameweekPerformance,
  GameweekDataResponse,
} from '@/interfaces/players';
import { GameWeekStatus } from '@/interfaces/match';
import type { EventLive, LeagueEntry } from '@/interfaces/fpl';
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
import { fplApi, getLeagueId } from './fpl-api';
import { fetchEntryPicks } from './gameweek-squad';
import { fetchLeagueDetails } from './league';
import { cachedRead } from './cache';

const CACHE_KEY = 'gameweek-data';
const CACHE_TTL_SECONDS = 3600; // 1 hour — FPL data only changes once per gameweek
const BATCH_SIZE = 5; // fetch 5 gameweeks at a time to avoid flooding the API

/**
 * Between seasons `/pl/event-status` answers 404 with the bare string
 * "Game not started" — not the usual `{ status: [...] }` object. Treat that as
 * "no gameweeks have been played yet" so the app renders an empty season
 * instead of failing.
 */
async function fetchEventStatus(): Promise<GameWeekStatus[]> {
  const res = await fetch(fplApi.eventStatus(), { next: { revalidate: 300 } });

  if (res.status === 404) {
    return [];
  }

  if (!res.ok) {
    throw new Error(`Event status request failed with ${res.status}`);
  }

  const body = await res.json();
  return Array.isArray(body?.status) ? body.status : [];
}

async function fetchGameweekBatch(
  startGw: number,
  endGw: number,
  leagueEntries: LeagueEntry[],
): Promise<GameweekPerformance[]> {
  const batchPromises = [];

  for (let gw = startGw; gw <= endGw; gw++) {
    batchPromises.push(
      Promise.all([
        fetch(fplApi.eventLive(gw), {
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
    scoreGameweek(gameweek, liveData, playerPicks),
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
    );
    fetched.push(...batchData.filter((p) => missing.includes(p.event)));
  }

  return fetched;
}

/**
 * Compute the season from scratch: upstream, database, scoring, aggregation.
 *
 * Expensive — two upstream calls and two database round trips before any
 * gameweek work, which measured ~2s from here. Readers always reach it through
 * `getGameweekData()`, never directly.
 *
 * Exported only for the sync job, which must **not** go through the cache: its
 * whole purpose is to write any newly finalised gameweek, and a cache hit would
 * return a count without doing that work while still reporting success. Every
 * other caller wants the cached wrapper.
 */
export async function computeSeasonUncached(): Promise<GameweekDataResponse> {
  const leagueId = getLeagueId();

  // The two database reads are keyed off the league alone, so they do not
  // wait on the upstream calls — issuing all four together removes a serial
  // Neon round trip, which measured 290-650ms, from every cold read.
  const [{ league_entries, standings }, status, finalised, storedPerformances] =
    await Promise.all([
      fetchLeagueDetails(leagueId),
      fetchEventStatus(),
      getFinalisedGameweeks(),
      getStoredPerformances(),
    ]);

  // Derive max gameweek from status array — instant, no extra HTTP calls
  const maxGameweek = Math.max(...status.map((s) => s.event), 0);
  const completedEvents = status.filter((s) => s.leagues_updated);
  const maxCompletedGameweek =
    completedEvents.length > 0
      ? Math.max(...completedEvents.map((s) => s.event))
      : 0;

  const currentEvent = maxGameweek;
  const isCurrentFinished = completedEvents.some(
    (s) => s.event === currentEvent,
  );

  const throughGameweek = maxCompletedGameweek || maxGameweek;

  // Fetch only the gap between what we hold and what has been played.
  const missing: number[] = [];
  for (let gw = 1; gw <= throughGameweek; gw++) {
    if (!finalised.has(gw)) missing.push(gw);
  }

  const freshPerformances = await fetchMissingGameweeks(
    missing,
    league_entries,
  );

  if (freshPerformances.length > 0) {
    await storeFinalisedGameweeks(freshPerformances);
  }

  const historicalData = [...storedPerformances, ...freshPerformances];

  // Fallback for the just-finished gameweek when its live data or picks
  // aren't retrievable. Deliberately not persisted: `standings[].event_total`
  // is a different source from the starting-XI sum we store everywhere else,
  // and mixing the two in the cache would make the history inconsistent.
  // Leaving it out means this gameweek is retried next run, which is correct.
  if (isCurrentFinished && standings) {
    const hasCurrentGameweekData = historicalData.some(
      (gw) => gw.event === currentEvent,
    );

    if (!hasCurrentGameweekData) {
      const currentGameweekData = standings.map((standing) => ({
        league_entry: standing.league_entry,
        event_total: standing.event_total,
      }));

      const rankedCurrentData = assignRanks(currentGameweekData);

      rankedCurrentData.forEach((player) => {
        historicalData.push({
          event: currentEvent,
          league_entry: player.league_entry,
          event_total: player.event_total,
          rank: player.rank,
          finished: true,
        });
      });
    }
  }

  const completedGameweeks = Array.from(
    new Set(historicalData.map((gw) => gw.event)),
  ).sort((a, b) => b - a);

  return {
    players: aggregatePlayers(league_entries, historicalData, standings),
    gameweekPerformances: historicalData,
    currentGameweek: currentEvent,
    completedGameweeks,
    rumblerData: buildRumblerData(historicalData, league_entries),
  };
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

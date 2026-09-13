import 'server-only';

import type { EventLive, GameState } from '@/interfaces/fpl';
import { getStoredPerformances } from '@/server/data/gameweeks';
import { cachedRead } from './cache';
import { fplApi, getLeagueId, upstreamFetch } from './fpl-api';
import { deriveSeasonState } from './season-state';
import { fetchLeagueDetails } from './league';
import { fetchEntryPicks } from './gameweek-squad';
import { aggregatePlayers, type EntryPicks } from './scoring';
import { fetchEventStatus } from './gameweek-data';
import { buildLiveTower, type LiveRoomData } from './live-tower';

/**
 * The live room's data, on its own short cache.
 *
 * The fetching half of the pair; every number it serves is derived next door
 * in `live-tower.ts`, which is pure and tested. Same split as
 * `gameweek-data.ts` against `scoring.ts`, for the same reason: a rule inside
 * an `async` function wrapped around twelve upstream calls cannot be tested.
 *
 * **One cache per thing.** The season aggregate keeps key `gameweek-data` at
 * 300 seconds; this slice reads key `live-gameweek` at 60. Sixty because the
 * inputs themselves move on FPL processing cycles: five minutes froze Sunday
 * scores at lunchtime, while thirty seconds doubles upstream chatter for a
 * league of eight readers with no new information between cycles.
 *
 * **Nothing provisional is persisted.** This module imports no write DAL
 * function — settled ranks for the riser baseline come from
 * `getStoredPerformances()` (read only), and the provisional rows are shaped
 * in memory only. Only plain serialisable data crosses `cachedRead`.
 *
 * Upstream reads stay `no-store` via `upstreamFetch`: caching is
 * `cachedRead`'s job and only its job.
 */

const CACHE_KEY = 'live-gameweek';
const CACHE_TTL_SECONDS = 60;

/** No gameweek in flight: the page renders its idle empty state. */
export interface LiveGameweekIdle {
  state: 'idle';
  gameweek: null;
}

/**
 * What the live room renders: the tower in one of its three states, or idle
 * when no gameweek is being played.
 */
export type LiveGameweekData = LiveRoomData | LiveGameweekIdle;

/**
 * Compute the live slice: league details, event status and game state in
 * parallel, `deriveSeasonState()` to find the in-flight gameweek, then the
 * live feed plus all eight entries' picks when there is one.
 *
 * Request-scoped work only: no module-level promise, no settled value memo
 * beyond what `cachedRead` owns. Readers always reach it through
 * `getLiveGameweek()`, never directly.
 */
export async function computeLiveGameweek(): Promise<LiveGameweekData> {
  const leagueId = getLeagueId();

  // The stored read joins the upstream batch rather than waiting on it: it is
  // keyed off the league alone, so serialising it would put a Neon round trip
  // in front of the live reads for nothing — the same saving
  // `computeSeasonUncached` documents.
  const [{ league_entries }, status, game, stored] = await Promise.all([
    fetchLeagueDetails(leagueId),
    fetchEventStatus(),
    fetchGameState(),
    getStoredPerformances(),
  ]);

  // The one place "is this gameweek over?" is decided. Never re-decided here:
  // `event-status` has a row per date, so the obvious reading declares a
  // gameweek complete on its opening Friday night.
  const { currentGameweek, finalisedThrough } = deriveSeasonState(status, game);

  const inFlight = currentGameweek > finalisedThrough ? currentGameweek : null;

  // Idle without reading picks or the live feed: there is nothing to score and
  // no reason to spend nine upstream calls finding that out.
  if (inFlight === null) {
    return { state: 'idle', gameweek: null };
  }

  const [liveData, ...playerPicks] = await Promise.all([
    fetchLiveFeed(inFlight),
    // `entry_id` addresses the URL, `id` identifies the manager — the branded
    // types are what stop them being swapped here. A manager whose picks
    // cannot be read drops out with an empty list, which `scoreGameweek`
    // treats as "not played" rather than scoring a partial league.
    ...league_entries.map((entry): Promise<EntryPicks> =>
      fetchEntryPicks(entry.entry_id, inFlight)
        .then((picks) => ({ league_entry: entry.id, picks }))
        .catch(() => ({ league_entry: entry.id, picks: [] })),
    ),
  ]);

  // The riser baseline: each manager's settled season F1 rank entering the
  // gameweek, from stored facts alone. Stored rows for the in-flight gameweek
  // should never exist, but if they do they are excluded — the live scoring
  // wins, exactly as `withoutInFlight` insists for the season aggregate.
  const settledRanks = new Map(
    aggregatePlayers(
      league_entries,
      stored.filter((performance) => performance.event !== inFlight),
    ).map((player) => [player.id, player.f1_ranking] as const),
  );

  return buildLiveTower({
    gameweek: inFlight,
    liveData,
    playerPicks,
    entries: league_entries,
    settledRanks,
    // Stamped at shape time: which recompute the reader is seeing.
    computedAt: Date.now(),
  });
}

/**
 * The live slice, cached.
 *
 * Revalidate early with `revalidateTag('live-gameweek', { expire: 0 })` —
 * which is what the cron route does on every sync. The cron job invalidates
 * but never warms this slice: warming a 60 second cache on a three hour
 * schedule buys nothing and spends 12 upstream calls per run.
 */
export const getLiveGameweek = cachedRead(
  CACHE_KEY,
  CACHE_TTL_SECONDS,
  computeLiveGameweek,
);

/**
 * The live feed for one gameweek, or `null` when it cannot be read.
 *
 * A missing feed is "unreadable", never "unscored": the caller shapes it into
 * the unavailable state rather than ranking zeros.
 */
async function fetchLiveFeed(gameweek: number): Promise<EventLive | null> {
  try {
    const res = await upstreamFetch(fplApi.eventLive(gameweek));

    if (!res.ok) return null;

    return (await res.json()) as EventLive;
  } catch (error) {
    console.error(
      `[live] event ${gameweek} live feed could not be read.`,
      error,
    );
    return null;
  }
}

/**
 * `/api/game` — the only draft endpoint that answers year-round.
 *
 * Resolves to `null` rather than throwing, because it is a cross-check:
 * without it `deriveSeasonState` falls back to `event-status` alone, which is
 * still correct for a completed gameweek and merely defers an in-flight one.
 *
 * Local rather than shared with `gameweek-data.ts`: the only difference is
 * the log tag, and that tag is what tells the operator which surface
 * suffered. A parameter for it would be sprawl for a log line.
 */
async function fetchGameState(): Promise<GameState | null> {
  try {
    const res = await upstreamFetch(fplApi.game());

    if (!res.ok) return null;

    const body = (await res.json()) as GameState;

    return typeof body?.current_event_finished === 'boolean' ? body : null;
  } catch (error) {
    console.error('[live] /api/game could not be read.', error);
    return null;
  }
}

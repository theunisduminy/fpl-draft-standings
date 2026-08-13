import {
  emptyPositionTally,
  POSITION_KEYS,
  type PlayerDetails,
  type GameweekPerformance,
  type GameweekDataResponse,
} from '@/interfaces/players';
import { GameWeekStatus } from '@/interfaces/match';
import type {
  EntryPick,
  EventLive,
  LeagueEntry,
  LeagueEntryId,
} from '@/interfaces/fpl';
import {
  getFinalisedGameweeks,
  getStoredPerformances,
  storeFinalisedGameweeks,
} from '@/server/data/gameweeks';
import { fplApi, getLeagueId } from './fpl-api';
import { fetchLeagueDetails } from './league';
import { cachedRead } from './cache';

const F1_POINTS = [20, 15, 12, 10, 8, 6, 4, 2];
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

function assignRanks(
  data: Array<{ event_total: number; league_entry: LeagueEntryId }>,
): Array<{ rank: number; league_entry: LeagueEntryId; event_total: number }> {
  const sorted = [...data].sort((a, b) => b.event_total - a.event_total);
  const rankedData = [];
  let currentRank = 1;

  for (let i = 0; i < sorted.length; i++) {
    if (i > 0 && sorted[i].event_total !== sorted[i - 1].event_total) {
      currentRank = i + 1;
    }
    rankedData.push({ ...sorted[i], rank: currentRank });
  }
  return rankedData;
}

/** One entry's starting XI for a gameweek, tagged with both its identities. */
interface EntryPicks {
  league_entry: LeagueEntryId;
  picks: EntryPick[];
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
          fetch(fplApi.entryEvent(entry.entry_id, gw), {
            next: { revalidate: 300 },
          })
            .then((res) => res.json())
            .then((data) => ({
              league_entry: entry.id,
              picks: (data.picks ?? []) as EntryPick[],
            }))
            .catch(() => ({
              league_entry: entry.id,
              picks: [],
            })),
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
  const performances: GameweekPerformance[] = [];

  results.forEach(({ gameweek, liveData, playerPicks }) => {
    // `elements` is an object, so a bare truthiness check passes on the empty
    // `{}` the API returns for a gameweek that has not been scored yet. Without
    // the key count, every entry scores 0, ties on rank 1, and banks a win.
    if (!liveData?.elements || Object.keys(liveData.elements).length === 0) {
      return;
    }

    // Likewise, entries whose picks failed to load must not be scored as zeros
    // — an unplayed gameweek has to be absent, not a joint-first finish.
    const scoredEntries = playerPicks.filter(
      (playerData) => playerData?.picks?.length,
    );

    if (scoredEntries.length === 0) return;

    const gameweekScores = scoredEntries.map((playerData) => {
      const startingPlayers = playerData.picks.filter(
        (pick) => pick.position <= 11,
      );

      const totalPoints = startingPlayers.reduce((sum, pick) => {
        // Draft element IDs, resolved against the draft API's own live feed —
        // the classic bootstrap numbers a handful of elements differently.
        const liveElement = liveData.elements[pick.element.toString()];
        return sum + (liveElement?.stats?.total_points || 0);
      }, 0);

      return {
        league_entry: playerData.league_entry,
        event_total: totalPoints,
      };
    });

    const rankedData = assignRanks(gameweekScores);

    rankedData.forEach((player) => {
      performances.push({
        event: gameweek,
        league_entry: player.league_entry,
        event_total: player.event_total,
        rank: player.rank,
        finished: true,
      });
    });
  });

  return performances;
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
 * gameweek work, which measured ~2s from here. Always reach it through
 * `getGameweekData()`, never directly.
 */
async function computeSeason(): Promise<GameweekDataResponse> {
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

  const playerMetrics: Record<number, PlayerDetails> = {};

  league_entries.forEach((entry) => {
    playerMetrics[entry.id] = {
      id: entry.id,
      player_name: entry.player_first_name || 'Unknown',
      player_surname: entry.player_last_name || 'Unknown',
      team_name: entry.entry_name || 'Unknown',
      total_points: 0,
      f1_score: 0,
      f1_ranking: 0,
      total_wins: 0,
      position_placed: emptyPositionTally(),
    };
  });

  historicalData.forEach((gameweek) => {
    const player = playerMetrics[gameweek.league_entry];
    if (player) {
      const f1Points = F1_POINTS[gameweek.rank - 1] || 0;
      player.f1_score += f1Points;
      if (gameweek.rank === 1) player.total_wins++;
      // Summed here as the fallback below; overwritten by the official total
      // whenever upstream has one.
      player.total_points += gameweek.event_total;

      const position = POSITION_KEYS[gameweek.rank - 1];
      if (position) player.position_placed[position]++;
    }
  });

  // The official cumulative total, which is the same measure as the sum above
  // but authoritative — it accounts for anything upstream scores differently
  // from a starting-XI sum.
  //
  // Only applied once upstream has a season to report. `standings` is **not**
  // empty before then: once the draft completes it returns a row per manager
  // with `total: 0` and every other field null. Overwriting with those zeros
  // wiped the derived sum and left the table showing real F1 scores beside
  // 0 points, which reads as a bug rather than as pre-season.
  const upstreamHasPlayed = standings?.some((standing) => standing.total > 0);

  if (upstreamHasPlayed) {
    standings.forEach((standing) => {
      const player = playerMetrics[standing.league_entry];
      if (player) {
        player.total_points = standing.total;
      }
    });
  }

  const players = Object.values(playerMetrics);
  players.sort((a, b) => b.f1_score - a.f1_score);
  players.forEach((player, index) => {
    player.f1_ranking = index + 1;
  });

  const gameweeksByEvent: Record<number, GameweekPerformance[]> = {};
  historicalData.forEach((gw) => {
    if (!gameweeksByEvent[gw.event]) {
      gameweeksByEvent[gw.event] = [];
    }
    gameweeksByEvent[gw.event].push(gw);
  });

  const rumblerData = Object.entries(gameweeksByEvent).map(
    ([eventStr, performances]) => {
      const event = parseInt(eventStr, 10);
      const worstRank = Math.max(...performances.map((p) => p.rank));
      const rumblers = performances.filter((p) => p.rank === worstRank);

      const rumblerDetails = rumblers.map((rumbler) => {
        const player = league_entries.find(
          (entry) => entry.id === rumbler.league_entry,
        );
        return {
          points: rumbler.event_total,
          entry_name: player?.entry_name || 'Unknown',
          player_name: player?.player_first_name || 'Unknown',
        };
      });

      return {
        gameweek: event,
        points: rumblerDetails[0]?.points || 0,
        entry_names: rumblerDetails.map((r) => r.entry_name),
        player_names: rumblerDetails.map((r) => r.player_name),
      };
    },
  );

  const completedGameweeks = Array.from(
    new Set(historicalData.map((gw) => gw.event)),
  ).sort((a, b) => b - a);

  return {
    players,
    gameweekPerformances: historicalData,
    currentGameweek: currentEvent,
    completedGameweeks,
    rumblerData: rumblerData.sort((a, b) => b.gameweek - a.gameweek),
  };
}

/**
 * The season, cached.
 *
 * Both cache layers live in `cachedRead`; see there for why a per-process map
 * still earns its place in front of the shared one. Revalidate early with
 * `revalidateTag('gameweek-data')`.
 */
export const getGameweekData = cachedRead(
  CACHE_KEY,
  CACHE_TTL_SECONDS,
  computeSeason,
);

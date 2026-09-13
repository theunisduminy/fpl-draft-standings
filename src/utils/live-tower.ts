/**
 * The Sunday live tower, as pure functions.
 *
 * Every number the `/live` board shows is derived here from three inputs: the
 * draft API's live feed for the in-flight gameweek, every manager's picks for
 * it, and the settled season F1 ranks entering it. Same split as `scoring.ts`
 * against `gameweek-data.ts`, for the same reason: a rule inside an `async`
 * function wrapped around twelve upstream calls cannot be tested.
 *
 * Scoring is reused, never re-decided: provisional points come from
 * `scoreGameweek` with `finished: false` plus its internal `assignRanks` pass,
 * so a provisional rank settles into the identical number by construction. The
 * known mid-gameweek divergence between the XI sum and upstream's
 * `event_total` is resolved by always using the XI sum and saying it is
 * provisional. This module adds no scoring rule of its own.
 *
 * Done means registered minutes: an XI starter with live `minutes > 0` is done
 * or underway, the rest are still to come. The unused-substitute edge (0
 * minutes after full time reads as still to come) is accepted and documented
 * in copy rather than solved with fixture state.
 *
 * Facts only, no colour logic: the module returns ranks, gaps, counts and
 * movement direction, and the component maps them to static classes — the same
 * facts-versus-presentation split as `chart-scales.ts`.
 */

import type { EventLive, LeagueEntry, LeagueEntryId } from '@/interfaces/fpl';
import { hasBeenPlayed, scoreGameweek, type EntryPicks } from './scoring';

/** Where a manager sits relative to their settled station entering the week. */
export type LiveMovement = 'riser' | 'faller' | 'level';

/**
 * One provisional row of the tower, in provisional rank order.
 *
 * `league_entry`, `event_total`, `rank` and `finished` mirror
 * `GameweekPerformance` — except `event`, which lives once on the parent
 * rather than eight times here, and `finished`, which is always `false`: these
 * rows are for display only and must never reach the database.
 */
export interface LiveTowerRow {
  /** The manager — branded, never a plain number. See `LeagueEntryId`. */
  league_entry: LeagueEntryId;
  /** Provisional gameweek rank. Ties share the higher rank (1, 1, 3). */
  rank: number;
  /** Provisional starting-XI sum, not upstream's `event_total`. */
  event_total: number;
  /** Always `false`. A reminder in the type that this row is not storable. */
  finished: false;
  /** Points behind the manager directly above. 0 for first place. */
  interval: number;
  /** Points above provisional last. 0 for last place. */
  cushion: number;
  /** XI starters with live `minutes > 0`. */
  done: number;
  /** XI starters yet to register minutes. */
  toPlay: number;
  /**
   * Provisional gameweek rank against the settled season F1 rank entering the
   * gameweek: a better provisional rank reads as a riser. An unknown baseline
   * (no settled gameweeks yet) reads as level, never as a faller.
   */
  movement: LiveMovement;
  /** `${first} ${last}` from the league entries, for rendering. */
  managerName: string;
  /** `entry_name` from the league entries, for rendering. */
  teamName: string;
}

/** Everything `buildLiveTower` needs, all of it already in memory. */
export interface LiveTowerInput {
  /** The in-flight gameweek being shaped. */
  gameweek: number;
  /** The live feed, or `null` when it could not be read. */
  liveData: EventLive | null;
  /** Every manager's picks; a manager with none drops out (see below). */
  playerPicks: EntryPicks[];
  /** League entries, for manager and team names. */
  entries: LeagueEntry[];
  /** Settled season F1 rank per manager entering the gameweek. */
  settledRanks: ReadonlyMap<LeagueEntryId, number>;
  /** Epoch millis, stamped by the caller at shape time. */
  computedAt: number;
}

interface LiveTowerLive {
  state: 'live';
  gameweek: number;
  computedAt: number;
  /** Explicit marker so every renderer can label without re-deriving. */
  provisional: true;
  /** The gameweek is underway, so there are rows to show. */
  started: true;
  rows: LiveTowerRow[];
}

interface LiveTowerPreKickoff {
  state: 'pre-kickoff';
  gameweek: number;
  computedAt: number;
  provisional: true;
  /** Nobody has taken the field, so ranking zeros would be the joint-first bug. */
  started: false;
  rows: [];
}

interface LiveTowerUnavailable {
  state: 'unavailable';
  gameweek: number;
  computedAt: number;
  provisional: true;
  rows: [];
}

/**
 * The tower in one of three states. Zeros are never ranked: before kick-off
 * and when the feed is unreadable the rows are empty and the page renders an
 * explanatory empty state instead.
 */
export type LiveRoomData =
  LiveTowerLive | LiveTowerPreKickoff | LiveTowerUnavailable;

/**
 * Shape the live tower from the live feed, everyone's picks and settled facts.
 *
 * - `null` feed: unavailable. The failure is reported, not ranked.
 * - Feed nobody has played in: pre-kickoff with `started: false` and no rows.
 *   An all-zero feed before the first whistle is "nothing yet", not a table.
 * - Otherwise the gameweek is scored with `finished: false`. An empty score —
 *   every manager's picks unreadable — is unavailable rather than zeros.
 * - A manager whose own picks are missing drops out with an empty list, which
 *   `scoreGameweek` treats as "not played" rather than scoring a partial
 *   league, so the other rows are unaffected.
 */
export function buildLiveTower(input: LiveTowerInput): LiveRoomData {
  const { gameweek, liveData, playerPicks, entries, settledRanks, computedAt } =
    input;

  if (liveData === null) {
    return {
      state: 'unavailable',
      gameweek,
      computedAt,
      provisional: true,
      rows: [],
    };
  }

  if (!hasBeenPlayed(liveData)) {
    return {
      state: 'pre-kickoff',
      gameweek,
      computedAt,
      provisional: true,
      started: false,
      rows: [],
    };
  }

  const scored = scoreGameweek(gameweek, liveData, playerPicks, false);

  if (scored.length === 0) {
    return {
      state: 'unavailable',
      gameweek,
      computedAt,
      provisional: true,
      rows: [],
    };
  }

  // XI picks per manager, for the done/to-play counts below.
  const xiByEntry = new Map<LeagueEntryId, EntryPicks['picks']>(
    playerPicks.map((player) => [
      player.league_entry,
      (player.picks ?? []).filter((pick) => pick.position <= 11),
    ]),
  );

  const names = new Map(entries.map((entry) => [entry.id, entry] as const));

  const ordered = [...scored].sort(
    (a, b) =>
      a.rank - b.rank ||
      b.event_total - a.event_total ||
      a.league_entry - b.league_entry,
  );

  const lastTotal = ordered[ordered.length - 1].event_total;

  const rows: LiveTowerRow[] = ordered.map((performance, index) => {
    const xi = xiByEntry.get(performance.league_entry) ?? [];

    let done = 0;
    xi.forEach((pick) => {
      // Draft element IDs, resolved against the draft API's own live feed —
      // the same lookup `scoreGameweek` sums, so the counts describe the XI
      // the points came from.
      const minutes =
        liveData.elements[pick.element.toString()]?.stats?.minutes ?? 0;
      if (minutes > 0) done += 1;
    });

    const baseline = settledRanks.get(performance.league_entry);
    const movement: LiveMovement =
      baseline === undefined || performance.rank === baseline
        ? 'level'
        : performance.rank < baseline
          ? 'riser'
          : 'faller';

    const entry = names.get(performance.league_entry);

    return {
      league_entry: performance.league_entry,
      rank: performance.rank,
      event_total: performance.event_total,
      finished: false,
      interval:
        index === 0
          ? 0
          : ordered[index - 1].event_total - performance.event_total,
      cushion: performance.event_total - lastTotal,
      done,
      toPlay: xi.length - done,
      movement,
      managerName:
        entry == null
          ? 'Unknown'
          : `${entry.player_first_name ?? ''} ${entry.player_last_name ?? ''}`.trim() ||
            'Unknown',
      teamName: entry?.entry_name || 'Unknown',
    };
  });

  return {
    state: 'live',
    gameweek,
    computedAt,
    provisional: true,
    started: true,
    rows,
  };
}

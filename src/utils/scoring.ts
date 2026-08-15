/**
 * The scoring layer, as pure functions.
 *
 * Everything here is a total function of its arguments: no fetch, no database,
 * no cache, no clock. That is the whole point — this is the code that decides
 * who won, and it is the code most expensive to get wrong, so it has to be
 * reachable from a test without a network.
 *
 * `gameweek-data.ts` keeps the I/O and the orchestration and calls into here.
 *
 * The rules these functions encode, all of which have already caused real bugs:
 *
 * - **A gameweek with no data is absent, never zeros.** Zeros rank, and ranking
 *   awards F1 points — an unscored gameweek scored as zeros hands all eight
 *   managers a joint first and 20 points each.
 * - **Upstream says "nothing yet" with `{}` and `[]`, both truthy.** Count keys,
 *   never test truthiness.
 * - **Ties share the higher rank and consume the lower ones.** Two managers tied
 *   at the top are both rank 1 and the next is rank 3, so both bank a win.
 */
import {
  emptyPositionTally,
  POSITION_KEYS,
  type PlayerDetails,
  type GameweekPerformance,
  type RumblerGameweekData,
} from '@/interfaces/players';
import type {
  EntryPick,
  EventLive,
  LeagueEntry,
  LeagueEntryId,
  LeagueStanding,
} from '@/interfaces/fpl';

/** F1 points for finishing 1st through 8th. The league is eight managers. */
export const F1_POINTS = [20, 15, 12, 10, 8, 6, 4, 2];

/** One entry's picks for a gameweek, tagged with the manager they belong to. */
export interface EntryPicks {
  league_entry: LeagueEntryId;
  picks: EntryPick[];
}

/**
 * Rank by points, highest first, with ties sharing the higher rank.
 *
 * Tied managers take the same rank and the ranks below them are consumed:
 * `[50, 50, 40]` ranks `1, 1, 3`, not `1, 1, 2`. That matters twice over —
 * rank 1 is a win, and the rank indexes {@link F1_POINTS}, so a tie at the top
 * pays both managers 20 and nobody collects the 15.
 */
export function assignRanks<T extends { event_total: number }>(
  data: T[],
): Array<T & { rank: number }> {
  const sorted = [...data].sort((a, b) => b.event_total - a.event_total);
  const rankedData: Array<T & { rank: number }> = [];
  let currentRank = 1;

  for (let i = 0; i < sorted.length; i++) {
    if (i > 0 && sorted[i].event_total !== sorted[i - 1].event_total) {
      currentRank = i + 1;
    }
    rankedData.push({ ...sorted[i], rank: currentRank });
  }
  return rankedData;
}

/**
 * Score one gameweek from its live feed and every manager's picks.
 *
 * Returns an **empty array** when the gameweek cannot be scored, and the caller
 * must treat that as "not played yet" and store nothing. Three ways that
 * happens, all of which look like a scored gameweek to a careless check:
 *
 * 1. `liveData` is null — the request failed.
 * 2. `liveData.elements` is `{}` — the gameweek exists but has not been scored.
 *    `{}` is truthy, so only the key count catches this.
 * 3. Nobody's picks loaded — scoring the survivors would rank a partial league.
 *
 * Only positions 1–11 count; 12–15 are the bench.
 */
export function scoreGameweek(
  gameweek: number,
  liveData: EventLive | null,
  playerPicks: EntryPicks[],
): GameweekPerformance[] {
  if (!liveData?.elements || Object.keys(liveData.elements).length === 0) {
    return [];
  }

  const scoredEntries = playerPicks.filter(
    (playerData) => playerData?.picks?.length,
  );

  if (scoredEntries.length === 0) return [];

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

  return assignRanks(gameweekScores).map((player) => ({
    event: gameweek,
    league_entry: player.league_entry,
    event_total: player.event_total,
    rank: player.rank,
    finished: true,
  }));
}

/**
 * Aggregate a season into the standings table: F1 score, wins, position tally,
 * total points, and the final ranking.
 *
 * `standings` is the league's own cumulative total and wins the total-points
 * column when it has anything to say — it accounts for whatever upstream scores
 * differently from a starting-XI sum. Until then the sum of the gameweeks
 * stands in.
 *
 * **The guard on `standings` is not an emptiness check.** Once the draft
 * completes, upstream returns a full row per manager with `total: 0` and every
 * other field null. Applying those zeros wiped the derived sum and left the
 * table showing real F1 scores beside 0 points, which reads as a bug rather
 * than as pre-season. So the trigger is "has anyone scored", not "is there a
 * row".
 */
export function aggregatePlayers(
  leagueEntries: LeagueEntry[],
  performances: GameweekPerformance[],
  standings?: LeagueStanding[],
): PlayerDetails[] {
  const playerMetrics: Record<number, PlayerDetails> = {};

  leagueEntries.forEach((entry) => {
    playerMetrics[entry.id] = {
      id: entry.id,
      player_name: entry.player_first_name || 'Unknown',
      player_surname: entry.player_last_name || 'Unknown',
      team_name: entry.entry_name || 'Unknown',
      total_points: 0,
      f1_score: 0,
      f1_ranking: 0,
      points_ranking: 0,
      total_wins: 0,
      position_placed: emptyPositionTally(),
    };
  });

  performances.forEach((gameweek) => {
    const player = playerMetrics[gameweek.league_entry];
    if (!player) return;

    player.f1_score += F1_POINTS[gameweek.rank - 1] || 0;
    if (gameweek.rank === 1) player.total_wins++;
    // Summed as the fallback; overwritten below whenever upstream has a total.
    player.total_points += gameweek.event_total;

    const position = POSITION_KEYS[gameweek.rank - 1];
    if (position) player.position_placed[position]++;
  });

  const upstreamHasPlayed = standings?.some((standing) => standing.total > 0);

  if (upstreamHasPlayed && standings) {
    standings.forEach((standing) => {
      const player = playerMetrics[standing.league_entry];
      if (player) player.total_points = standing.total;
    });
  }

  const players = Object.values(playerMetrics);
  players.sort((a, b) => b.f1_score - a.f1_score);
  players.forEach((player, index) => {
    player.f1_ranking = index + 1;
  });

  const pointsRanks = rankByPoints(players);
  players.forEach((player) => {
    player.points_ranking = pointsRanks.get(player.id) ?? 0;
  });

  return players;
}

/**
 * Where each manager would stand if the league ranked on total points.
 *
 * The league does not — it ranks on F1 score, which counts finishing positions
 * rather than points, so a consistent third place beats one enormous week. The
 * two orders disagree, and that disagreement is the season's most interesting
 * fact, so the standings page shows both. Same tie rule as everywhere else.
 *
 * Exported for its test; every consumer reads `points_ranking` off the player,
 * which {@link aggregatePlayers} sets from this once per season.
 */
export function rankByPoints(
  players: PlayerDetails[],
): Map<LeagueEntryId, number> {
  const ranked = assignRanks(
    players.map((player) => ({
      id: player.id,
      event_total: player.total_points,
    })),
  );

  return new Map(ranked.map((player) => [player.id, player.rank]));
}

/**
 * Where one manager stood after a given gameweek.
 *
 * `f1_score` is cumulative, so a snapshot is the standings table as it was that
 * week rather than that week's result.
 */
export interface SeasonPlace {
  league_entry: LeagueEntryId;
  f1_score: number;
  rank: number;
}

/** The standings after one gameweek, sorted best first. */
export interface SeasonSnapshot {
  gameweek: number;
  places: SeasonPlace[];
}

/**
 * The standings as they stood after each gameweek, oldest first.
 *
 * **One derivation, two surfaces.** The week-on-week move column and the bump
 * chart are both questions about this same series, and two separate loops would
 * be two chances to disagree about a tie. Ranking goes
 * through {@link assignRanks}, so a tie here behaves exactly as it does in the
 * season table: shared higher rank, lower ranks consumed.
 *
 * Every manager who appears anywhere in `performances` appears in every
 * snapshot, scoring 0 until their first gameweek. A ladder whose membership
 * changed week to week would draw lines that begin in mid-air.
 *
 * Gameweeks are taken from the data, not from a range: an unplayed gameweek is
 * absent upstream and must stay absent here, never a flat week of zeros.
 */
export function standingsByGameweek(
  performances: GameweekPerformance[],
): SeasonSnapshot[] {
  if (performances.length === 0) return [];

  const gameweeks = Array.from(
    new Set(performances.map((performance) => performance.event)),
  ).sort((a, b) => a - b);

  const entries = Array.from(
    new Set(performances.map((performance) => performance.league_entry)),
  );

  const cumulative = new Map<LeagueEntryId, number>(
    entries.map((entry) => [entry, 0]),
  );

  return gameweeks.map((gameweek) => {
    performances
      .filter((performance) => performance.event === gameweek)
      .forEach((performance) => {
        const gained = F1_POINTS[performance.rank - 1] || 0;
        cumulative.set(
          performance.league_entry,
          (cumulative.get(performance.league_entry) ?? 0) + gained,
        );
      });

    const places = assignRanks(
      entries.map((entry) => ({
        league_entry: entry,
        event_total: cumulative.get(entry) ?? 0,
      })),
    ).map((place) => ({
      league_entry: place.league_entry,
      f1_score: place.event_total,
      rank: place.rank,
    }));

    return { gameweek, places };
  });
}

/**
 * How far each manager moved between the last two snapshots.
 *
 * Positive is up the table, because that is how a reader reads an up arrow: a
 * manager who went from 5th to 3rd moved `+2`. A manager missing from the
 * previous snapshot is absent from the result, which the table renders as
 * "new" rather than as no change.
 *
 * A plain object rather than a `Map` on purpose: this crosses into a client
 * component, and only JSON survives that boundary.
 */
export function standingsMovement(
  snapshots: SeasonSnapshot[],
): Record<number, number> {
  if (snapshots.length < 2) return {};

  const previous = snapshots[snapshots.length - 2];
  const current = snapshots[snapshots.length - 1];

  const previousRanks = new Map(
    previous.places.map((place) => [place.league_entry, place.rank]),
  );

  const movement: Record<number, number> = {};

  current.places.forEach((place) => {
    const before = previousRanks.get(place.league_entry);
    if (before === undefined) return;

    movement[place.league_entry] = before - place.rank;
  });

  return movement;
}

/** One manager singled out for something, with the number that did it. */
export interface LedgerFact {
  league_entry: LeagueEntryId;
  value: number;
  /** Set only where the fact names a week, e.g. the best single gameweek. */
  gameweek?: number;
}

/**
 * The six facts in the league ledger.
 *
 * Each is `null` until the season has enough played gameweeks to mean
 * anything, and the component renders a dash rather than inventing a leader.
 *
 * **Ties resolve to one manager**, by the highest value then the lowest league
 * entry, so the row is stable between renders. The ledger is a summary strip,
 * not a record book; the tables below it are where a reader goes for the
 * full order.
 */
export interface LeagueLedger {
  mostWins: LedgerFact | null;
  mostPodiums: LedgerFact | null;
  bestWeek: LedgerFact | null;
  /** Lowest spread of finishing positions. Needs at least three gameweeks. */
  steadiest: LedgerFact | null;
  /** The **longest** run of consecutive podium finishes, not the current one. */
  hotStreak: LedgerFact | null;
  /** Last places, counted the way {@link buildRumblerData} counts them. */
  mostRumblers: LedgerFact | null;
}

/** Gameweeks below which "steadiest" is noise rather than a finding. */
const STEADIEST_MINIMUM_GAMEWEEKS = 3;

export function buildLeagueLedger(
  performances: GameweekPerformance[],
): LeagueLedger {
  const byEntry = groupByEntry(performances);
  const entries = Array.from(byEntry.keys());

  const empty = {
    mostWins: null,
    mostPodiums: null,
    bestWeek: null,
    steadiest: null,
    hotStreak: null,
    mostRumblers: null,
  };

  if (entries.length === 0) return empty;

  const rumblerCounts = countRumblers(performances);

  const best = (
    score: (runs: GameweekPerformance[]) => LedgerFact | null,
  ): LedgerFact | null => {
    const facts = entries
      .map((entry) => score(byEntry.get(entry) ?? []))
      .filter((fact): fact is LedgerFact => fact !== null);

    if (facts.length === 0) return null;

    // Highest value wins; the league entry breaks a tie, so the strip does not
    // reshuffle between two managers on the same number.
    return facts.sort(
      (a, b) => b.value - a.value || a.league_entry - b.league_entry,
    )[0];
  };

  const countWhere = (
    runs: GameweekPerformance[],
    matches: (performance: GameweekPerformance) => boolean,
  ): LedgerFact | null => {
    if (runs.length === 0) return null;

    const value = runs.filter(matches).length;

    return value > 0 ? { league_entry: runs[0].league_entry, value } : null;
  };

  return {
    mostWins: best((runs) => countWhere(runs, (run) => run.rank === 1)),
    mostPodiums: best((runs) => countWhere(runs, (run) => run.rank <= 3)),
    bestWeek: best((runs) => {
      if (runs.length === 0) return null;

      const week = [...runs].sort((a, b) => b.event_total - a.event_total)[0];

      return {
        league_entry: week.league_entry,
        value: week.event_total,
        gameweek: week.event,
      };
    }),
    steadiest: best((runs) => {
      if (runs.length < STEADIEST_MINIMUM_GAMEWEEKS) return null;

      // Negated so the shared "highest wins" comparison picks the *lowest*
      // spread. The component reads `Math.abs`.
      return {
        league_entry: runs[0].league_entry,
        value: -standardDeviation(runs.map((run) => run.rank)),
      };
    }),
    hotStreak: best((runs) => {
      const value = longestRun([...runs].sort((a, b) => a.event - b.event));

      return value > 1 ? { league_entry: runs[0].league_entry, value } : null;
    }),
    mostRumblers: best((runs) => {
      if (runs.length === 0) return null;

      const value = rumblerCounts.get(runs[0].league_entry) ?? 0;

      return value > 0 ? { league_entry: runs[0].league_entry, value } : null;
    }),
  };
}

function groupByEntry(
  performances: GameweekPerformance[],
): Map<LeagueEntryId, GameweekPerformance[]> {
  const byEntry = new Map<LeagueEntryId, GameweekPerformance[]>();

  performances.forEach((performance) => {
    const runs = byEntry.get(performance.league_entry) ?? [];
    runs.push(performance);
    byEntry.set(performance.league_entry, runs);
  });

  return byEntry;
}

/**
 * Last places per manager.
 *
 * Last is the worst rank **present that week**, never rank 8 — a week where two
 * managers tie mid-table ends at rank 7, and counting `position_placed.eighth`
 * would report no rumbler at all. Same rule as {@link buildRumblerData}, so the
 * ledger and the rumblers page cannot disagree.
 */
function countRumblers(
  performances: GameweekPerformance[],
): Map<LeagueEntryId, number> {
  const byGameweek = new Map<number, GameweekPerformance[]>();

  performances.forEach((performance) => {
    const week = byGameweek.get(performance.event) ?? [];
    week.push(performance);
    byGameweek.set(performance.event, week);
  });

  const counts = new Map<LeagueEntryId, number>();

  byGameweek.forEach((week) => {
    const worstRank = Math.max(...week.map((performance) => performance.rank));

    week
      .filter((performance) => performance.rank === worstRank)
      .forEach((performance) => {
        counts.set(
          performance.league_entry,
          (counts.get(performance.league_entry) ?? 0) + 1,
        );
      });
  });

  return counts;
}

/** The longest run of consecutive podium finishes in a season, in order. */
function longestRun(runs: GameweekPerformance[]): number {
  let longest = 0;
  let current = 0;

  runs.forEach((run) => {
    current = run.rank <= 3 ? current + 1 : 0;
    if (current > longest) longest = current;
  });

  return longest;
}

/** Population standard deviation. Small, fixed samples; no correction needed. */
function standardDeviation(values: number[]): number {
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance =
    values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;

  return Math.sqrt(variance);
}

/**
 * The rumbler for each gameweek: whoever finished last, newest gameweek first.
 *
 * Last place is the **worst rank present**, not rank 8. A gameweek where two
 * managers tie mid-table has no rank 8 at all, and hard-coding it would report
 * no rumbler for that week.
 */
export function buildRumblerData(
  performances: GameweekPerformance[],
  leagueEntries: LeagueEntry[],
): RumblerGameweekData[] {
  const byEvent: Record<number, GameweekPerformance[]> = {};
  performances.forEach((gw) => {
    (byEvent[gw.event] ??= []).push(gw);
  });

  return Object.entries(byEvent)
    .map(([eventStr, eventPerformances]) => {
      const worstRank = Math.max(...eventPerformances.map((p) => p.rank));
      const rumblers = eventPerformances.filter((p) => p.rank === worstRank);

      const rumblerDetails = rumblers.map((rumbler) => {
        const player = leagueEntries.find(
          (entry) => entry.id === rumbler.league_entry,
        );
        return {
          points: rumbler.event_total,
          entry_name: player?.entry_name || 'Unknown',
          player_name: player?.player_first_name || 'Unknown',
        };
      });

      return {
        gameweek: parseInt(eventStr, 10),
        points: rumblerDetails[0]?.points || 0,
        entry_names: rumblerDetails.map((r) => r.entry_name),
        player_names: rumblerDetails.map((r) => r.player_name),
      };
    })
    .sort((a, b) => b.gameweek - a.gameweek);
}

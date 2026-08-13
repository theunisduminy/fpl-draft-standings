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

  return players;
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

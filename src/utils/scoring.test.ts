import { describe, expect, it } from 'vitest';

import {
  asElementId,
  asEntryId,
  asLeagueEntryId,
  type ElementId,
  type EventLive,
  type LeagueEntry,
  type LeagueEntryId,
  type LeagueStanding,
} from '@/interfaces/fpl';
import {
  emptyPositionTally,
  type GameweekPerformance,
} from '@/interfaces/players';
import {
  aggregatePlayers,
  assignRanks,
  buildLeagueLedger,
  buildRumblerData,
  rankByPoints,
  scoreGameweek,
  standingsByGameweek,
  standingsMovement,
  type EntryPicks,
} from './scoring';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

/** Managers 1..n, with the `id`/`entry_id` split the real API has. */
function makeEntries(count: number): LeagueEntry[] {
  return Array.from({ length: count }, (_, i) => ({
    id: asLeagueEntryId(100 + i),
    entry_id: asEntryId(900 + i),
    entry_name: `Team ${i + 1}`,
    player_first_name: `First${i + 1}`,
    player_last_name: `Last${i + 1}`,
    short_name: `T${i + 1}`,
    joined_time: '2026-08-01T00:00:00Z',
    waiver_pick: i + 1,
  }));
}

/** A live feed where element `n` scored `n` points. */
function makeLive(elementIds: ElementId[]): EventLive {
  return {
    elements: Object.fromEntries(
      elementIds.map((id) => [String(id), { stats: { total_points: id } }]),
    ),
  };
}

/** 15 picks: elements all worth 1 point each, so the starting XI scores 11. */
function makePicks(leagueEntry: LeagueEntryId): EntryPicks {
  return {
    league_entry: leagueEntry,
    picks: Array.from({ length: 15 }, (_, i) => ({
      element: asElementId(1),
      position: i + 1,
    })),
  };
}

function performance(
  event: number,
  leagueEntry: LeagueEntryId,
  rank: number,
  eventTotal = 50,
): GameweekPerformance {
  return {
    event,
    league_entry: leagueEntry,
    event_total: eventTotal,
    rank,
    finished: true,
  };
}

// ---------------------------------------------------------------------------

describe('assignRanks', () => {
  it('ranks by points, highest first', () => {
    const ranked = assignRanks([
      { event_total: 40 },
      { event_total: 60 },
      { event_total: 50 },
    ]);

    expect(ranked.map((r) => [r.event_total, r.rank])).toEqual([
      [60, 1],
      [50, 2],
      [40, 3],
    ]);
  });

  it('gives tied entries the same rank and consumes the ranks below', () => {
    // The 700-point bug lives here: if a tie at the top ranked 1, 1, 2 then
    // three managers would collect first- and second-place F1 points for a
    // two-way tie.
    const ranked = assignRanks([
      { event_total: 50 },
      { event_total: 50 },
      { event_total: 40 },
    ]);

    expect(ranked.map((r) => r.rank)).toEqual([1, 1, 3]);
  });

  it('does not mutate its input', () => {
    const input = [{ event_total: 10 }, { event_total: 30 }];
    assignRanks(input);
    expect(input.map((r) => r.event_total)).toEqual([10, 30]);
  });
});

describe('scoreGameweek', () => {
  const entries = makeEntries(3);
  const picks = entries.map((e) => makePicks(e.id));

  it('sums the starting XI only, ignoring the bench', () => {
    // Every pick is element 1, worth 1 point. 15 picks, 11 of them starters.
    const scored = scoreGameweek(1, makeLive([asElementId(1)]), picks);

    expect(scored).toHaveLength(3);
    expect(scored.every((p) => p.event_total === 11)).toBe(true);
  });

  it('returns nothing when the live feed is an empty object', () => {
    // `{}` is truthy. Without the key count every manager scores 0, ties on
    // rank 1, and banks a win for a gameweek that has not been played.
    expect(scoreGameweek(1, { elements: {} }, picks)).toEqual([]);
  });

  it('returns nothing when the live request failed', () => {
    expect(scoreGameweek(1, null, picks)).toEqual([]);
  });

  it('returns nothing when no manager has picks', () => {
    const empty = entries.map((e) => ({ league_entry: e.id, picks: [] }));
    expect(scoreGameweek(1, makeLive([asElementId(1)]), empty)).toEqual([]);
  });

  it('scores an element missing from the live feed as zero, not NaN', () => {
    const scored = scoreGameweek(1, makeLive([asElementId(999)]), picks);
    expect(scored.every((p) => p.event_total === 0)).toBe(true);
  });

  it('stamps every performance with the gameweek it came from', () => {
    const scored = scoreGameweek(7, makeLive([asElementId(1)]), picks);
    expect(scored.every((p) => p.event === 7)).toBe(true);
  });
});

describe('aggregatePlayers', () => {
  const entries = makeEntries(3);
  const [a, b, c] = entries.map((e) => e.id);

  it('awards F1 points by rank and counts wins', () => {
    const players = aggregatePlayers(entries, [
      performance(1, a, 1),
      performance(1, b, 2),
      performance(1, c, 3),
      performance(2, a, 1),
      performance(2, b, 2),
      performance(2, c, 3),
    ]);

    const byId = Object.fromEntries(players.map((p) => [p.id, p]));
    expect(byId[a].f1_score).toBe(40); // 20 + 20
    expect(byId[b].f1_score).toBe(30); // 15 + 15
    expect(byId[c].f1_score).toBe(24); // 12 + 12
    expect(byId[a].total_wins).toBe(2);
    expect(byId[c].total_wins).toBe(0);
  });

  it('pays both managers of a tie the first-place award', () => {
    const players = aggregatePlayers(entries, [
      performance(1, a, 1),
      performance(1, b, 1),
      performance(1, c, 3),
    ]);

    const byId = Object.fromEntries(players.map((p) => [p.id, p]));
    expect(byId[a].f1_score).toBe(20);
    expect(byId[b].f1_score).toBe(20);
    expect(byId[a].total_wins).toBe(1);
    expect(byId[b].total_wins).toBe(1);
    expect(byId[c].f1_score).toBe(12); // rank 3, not rank 2
  });

  it('ranks the season by F1 score', () => {
    const players = aggregatePlayers(entries, [
      performance(1, c, 1),
      performance(1, a, 2),
      performance(1, b, 3),
    ]);

    expect(players.map((p) => [p.id, p.f1_ranking])).toEqual([
      [c, 1],
      [a, 2],
      [b, 3],
    ]);
  });

  it('tallies finishing positions', () => {
    const players = aggregatePlayers(entries, [
      performance(1, a, 1),
      performance(2, a, 3),
      performance(3, a, 1),
    ]);

    const player = players.find((p) => p.id === a)!;
    expect(player.position_placed.first).toBe(2);
    expect(player.position_placed.third).toBe(1);
    expect(player.position_placed.second).toBe(0);
  });

  it('includes managers with no performances at all', () => {
    const players = aggregatePlayers(entries, [performance(1, a, 1)]);

    expect(players).toHaveLength(3);
    expect(players.find((p) => p.id === b)!.f1_score).toBe(0);
  });

  it('sums the gameweeks when upstream has no total to report', () => {
    const players = aggregatePlayers(entries, [
      performance(1, a, 1, 60),
      performance(2, a, 1, 40),
    ]);

    expect(players.find((p) => p.id === a)!.total_points).toBe(100);
  });

  it('keeps the derived sum when standings exist but nobody has scored', () => {
    // Post-draft, pre-GW1: upstream returns a row per manager with `total: 0`.
    // Applying those zeros left real F1 scores sitting beside 0 points.
    const standings: LeagueStanding[] = entries.map((entry, i) => ({
      league_entry: entry.id,
      rank: i + 1,
      last_rank: 0,
      rank_sort: i + 1,
      total: 0,
      matches_played: 0,
      matches_won: 0,
      matches_drawn: 0,
      matches_lost: 0,
      points_for: 0,
      points_against: 0,
      event_total: 0,
    }));

    const players = aggregatePlayers(
      entries,
      [performance(1, a, 1, 60)],
      standings,
    );

    expect(players.find((p) => p.id === a)!.total_points).toBe(60);
  });

  it('prefers the official total once anyone has scored', () => {
    const standings: LeagueStanding[] = [
      {
        league_entry: a,
        rank: 1,
        last_rank: 1,
        rank_sort: 1,
        total: 137,
        matches_played: 1,
        matches_won: 1,
        matches_drawn: 0,
        matches_lost: 0,
        points_for: 137,
        points_against: 0,
        event_total: 60,
      },
    ];

    const players = aggregatePlayers(
      entries,
      [performance(1, a, 1, 60)],
      standings,
    );

    expect(players.find((p) => p.id === a)!.total_points).toBe(137);
  });
});

describe('rankByPoints', () => {
  const entries = makeEntries(3);
  const [a, b, c] = entries.map((e) => e.id);

  /** Only the fields `rankByPoints` reads; the rest is noise here. */
  function player(id: LeagueEntryId, totalPoints: number) {
    return {
      id,
      player_name: 'X',
      player_surname: 'Y',
      team_name: 'Z',
      total_points: totalPoints,
      f1_score: 0,
      f1_ranking: 0,
      points_ranking: 0,
      total_wins: 0,
      position_placed: emptyPositionTally(),
    };
  }

  it('ranks on points regardless of the F1 order', () => {
    const ranks = rankByPoints([
      player(a, 900),
      player(b, 1100),
      player(c, 1000),
    ]);

    expect([ranks.get(a), ranks.get(b), ranks.get(c)]).toEqual([3, 1, 2]);
  });

  it('shares the higher rank on a tie, as everywhere else', () => {
    const ranks = rankByPoints([
      player(a, 1000),
      player(b, 1000),
      player(c, 900),
    ]);

    expect([ranks.get(a), ranks.get(b), ranks.get(c)]).toEqual([1, 1, 3]);
  });
});

describe('buildRumblerData', () => {
  const entries = makeEntries(3);
  const [a, b, c] = entries.map((e) => e.id);

  it('reports the last-placed manager, newest gameweek first', () => {
    const rumblers = buildRumblerData(
      [
        performance(1, a, 1),
        performance(1, c, 3, 20),
        performance(2, b, 1),
        performance(2, a, 3, 25),
      ],
      entries,
    );

    expect(rumblers.map((r) => r.gameweek)).toEqual([2, 1]);
    expect(rumblers[0].player_names).toEqual(['First1']);
    expect(rumblers[0].points).toBe(25);
    expect(rumblers[1].player_names).toEqual(['First3']);
  });

  it('reports every manager tied for last', () => {
    const rumblers = buildRumblerData(
      [performance(1, a, 1), performance(1, b, 2), performance(1, c, 2)],
      entries,
    );

    expect(rumblers[0].entry_names).toEqual(['Team 2', 'Team 3']);
  });

  it('uses the worst rank present, not a hard-coded last place', () => {
    // A gameweek where a mid-table tie means there is no rank 3 at all.
    const rumblers = buildRumblerData(
      [performance(1, a, 1), performance(1, b, 2), performance(1, c, 2)],
      entries,
    );

    expect(rumblers).toHaveLength(1);
    expect(rumblers[0].entry_names).not.toHaveLength(0);
  });
});

describe('standingsByGameweek', () => {
  const entries = makeEntries(3);
  const [a, b, c] = entries.map((e) => e.id);

  it('accumulates F1 points and ranks the running total', () => {
    const snapshots = standingsByGameweek([
      performance(1, a, 1),
      performance(1, b, 2),
      performance(1, c, 3),
      performance(2, a, 3),
      performance(2, b, 1),
      performance(2, c, 2),
    ]);

    expect(snapshots.map((s) => s.gameweek)).toEqual([1, 2]);
    // GW1: 20/15/12. GW2 adds 12/20/15 → 32/35/27, so b takes the lead.
    expect(
      snapshots[1].places.map((p) => [p.league_entry, p.f1_score]),
    ).toEqual([
      [b, 35],
      [a, 32],
      [c, 27],
    ]);
  });

  it('shares the higher rank on a tie, exactly like the season table', () => {
    const snapshots = standingsByGameweek([
      performance(1, a, 1),
      performance(1, b, 1),
      performance(1, c, 3),
    ]);

    expect(snapshots[0].places.map((p) => p.rank)).toEqual([1, 1, 3]);
  });

  it('keeps every manager in every snapshot, scoring 0 before they appear', () => {
    const snapshots = standingsByGameweek([
      performance(1, a, 1),
      performance(1, b, 2),
      performance(2, c, 1),
      performance(2, a, 2),
      performance(2, b, 3),
    ]);

    expect(snapshots[0].places).toHaveLength(3);
    expect(
      snapshots[0].places.find((p) => p.league_entry === c)?.f1_score,
    ).toBe(0);
  });

  it('takes its gameweeks from the data, never filling a gap with zeros', () => {
    const snapshots = standingsByGameweek([
      performance(1, a, 1),
      performance(3, a, 1),
    ]);

    expect(snapshots.map((s) => s.gameweek)).toEqual([1, 3]);
  });

  it('returns nothing for a season with no performances', () => {
    expect(standingsByGameweek([])).toEqual([]);
  });
});

describe('standingsMovement', () => {
  const entries = makeEntries(3);
  const [a, b, c] = entries.map((e) => e.id);

  it('reports a climb up the table as a positive number', () => {
    const snapshots = standingsByGameweek([
      performance(1, a, 1),
      performance(1, b, 2),
      performance(1, c, 3),
      performance(2, c, 1),
      performance(2, b, 2),
      performance(2, a, 3),
    ]);

    // c: 12 + 20 = 32, b: 15 + 15 = 30, a: 20 + 12 = 32. a and c tie on 32.
    const movement = standingsMovement(snapshots);

    expect(movement[c]).toBe(2);
    expect(movement[a]).toBe(0);
  });

  it('is empty after a single gameweek, so nothing renders as a move', () => {
    const snapshots = standingsByGameweek([
      performance(1, a, 1),
      performance(1, b, 2),
    ]);

    expect(standingsMovement(snapshots)).toEqual({});
  });
});

describe('buildLeagueLedger', () => {
  const entries = makeEntries(3);
  const [a, b, c] = entries.map((e) => e.id);

  /** Three managers, four gameweeks, with a shape each fact can be read off. */
  const season = [
    performance(1, a, 1, 70),
    performance(1, b, 2, 60),
    performance(1, c, 3, 50),
    performance(2, a, 1, 80),
    performance(2, b, 3, 55),
    performance(2, c, 2, 65),
    performance(3, a, 3, 40),
    performance(3, b, 1, 90),
    performance(3, c, 2, 45),
    performance(4, a, 2, 52),
    performance(4, b, 1, 75),
    performance(4, c, 3, 30),
  ];

  it('counts wins and podiums off the finishing ranks', () => {
    const ledger = buildLeagueLedger(season);

    expect(ledger.mostWins).toMatchObject({ league_entry: a, value: 2 });
    // Every manager made the podium every week in a three-manager league.
    expect(ledger.mostPodiums?.value).toBe(4);
  });

  it('names the single best gameweek and which week it was', () => {
    const ledger = buildLeagueLedger(season);

    expect(ledger.bestWeek).toMatchObject({
      league_entry: b,
      value: 90,
      gameweek: 3,
    });
  });

  it('counts last places by the worst rank present, not by rank 8', () => {
    // A two-manager week ends at rank 2, so a hard-coded last place finds none.
    const ledger = buildLeagueLedger([
      performance(1, a, 1),
      performance(1, b, 2),
      performance(2, a, 1),
      performance(2, b, 2),
    ]);

    expect(ledger.mostRumblers).toMatchObject({ league_entry: b, value: 2 });
  });

  it('measures the steadiest manager by the spread of their finishes', () => {
    const ledger = buildLeagueLedger([
      // a finishes 1, 3, 1, 3 — b finishes 2, 2, 2, 2.
      performance(1, a, 1),
      performance(1, b, 2),
      performance(2, a, 3),
      performance(2, b, 2),
      performance(3, a, 1),
      performance(3, b, 2),
      performance(4, a, 3),
      performance(4, b, 2),
    ]);

    expect(ledger.steadiest?.league_entry).toBe(b);
    expect(Math.abs(ledger.steadiest?.value ?? 0)).toBe(0);
  });

  it('withholds steadiest until there are enough gameweeks to mean anything', () => {
    const ledger = buildLeagueLedger([
      performance(1, a, 1),
      performance(1, b, 2),
      performance(2, a, 1),
      performance(2, b, 2),
    ]);

    expect(ledger.steadiest).toBeNull();
  });

  it('reports the longest podium run, not the current one', () => {
    const ledger = buildLeagueLedger([
      // a: podium, podium, podium, off — the run ends but still counts 3.
      performance(1, a, 1),
      performance(2, a, 2),
      performance(3, a, 3),
      performance(4, a, 5),
      performance(5, a, 1),
    ]);

    expect(ledger.hotStreak).toMatchObject({ league_entry: a, value: 3 });
  });

  it('has nothing to say about a season that has not started', () => {
    expect(buildLeagueLedger([])).toEqual({
      mostWins: null,
      mostPodiums: null,
      bestWeek: null,
      steadiest: null,
      hotStreak: null,
      mostRumblers: null,
    });
  });
});

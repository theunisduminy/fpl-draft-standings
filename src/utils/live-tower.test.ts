import { describe, expect, it } from 'vitest';

import {
  asElementId,
  asEntryId,
  asLeagueEntryId,
  type ElementId,
  type EventLive,
  type LeagueEntry,
  type LeagueEntryId,
} from '@/interfaces/fpl';
import type { EntryPicks } from './scoring';
import { buildLiveTower, type LiveTowerInput } from './live-tower';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const GAMEWEEK = 5;
const COMPUTED_AT = 1_726_000_000_000;

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

const FILLER = asElementId(100);
const BENCH = asElementId(9999);

/** A live feed from per-element `{ points, minutes }`, plus a played filler. */
function makeLive(
  stats: Record<number, { points: number; minutes: number }>,
): EventLive {
  return {
    elements: Object.fromEntries([
      ...Object.entries(stats).map(([id, s]) => [
        id,
        { stats: { total_points: s.points, minutes: s.minutes } },
      ]),
      // Shared filler: played but blanked, so the other ten XI slots score 0
      // while still counting as done.
      [String(FILLER), { stats: { total_points: 0, minutes: 90 } }],
    ]),
  };
}

/**
 * Picks whose XI scores `starPoints`: the star at position 1, the filler at
 * 2–11, absent elements on the bench (never looked up).
 */
function starPicks(leagueEntry: LeagueEntryId, star: ElementId): EntryPicks {
  return {
    league_entry: leagueEntry,
    picks: [
      { element: star, position: 1 },
      ...Array.from({ length: 10 }, (_, i) => ({
        element: FILLER,
        position: i + 2,
      })),
      ...Array.from({ length: 4 }, (_, i) => ({
        element: BENCH,
        position: i + 12,
      })),
    ],
  };
}

/** Picks over an explicit XI, for the done/to-play counts. */
function xiPicks(leagueEntry: LeagueEntryId, xi: ElementId[]): EntryPicks {
  return {
    league_entry: leagueEntry,
    picks: [
      ...xi.map((element, i) => ({ element, position: i + 1 })),
      ...Array.from({ length: 4 }, (_, i) => ({
        element: BENCH,
        position: i + 12,
      })),
    ],
  };
}

function input(overrides: Partial<LiveTowerInput>): LiveTowerInput {
  return {
    gameweek: GAMEWEEK,
    liveData: { elements: {} },
    playerPicks: [],
    entries: [],
    settledRanks: new Map(),
    computedAt: COMPUTED_AT,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------

describe('buildLiveTower happy path', () => {
  // Eight managers, varied XI sums with a tie for second: totals
  // 80, 70, 70, 60, 50, 40, 30, 20.
  const entries = makeEntries(8);
  const totals = [80, 70, 70, 60, 50, 40, 30, 20];
  const stars = totals.map((_, i) => asElementId(i + 1));
  const liveData = makeLive(
    Object.fromEntries(
      totals.map((points, i) => [i + 1, { points, minutes: 90 }]),
    ),
  );
  const playerPicks = entries.map((entry, i) => starPicks(entry.id, stars[i]));
  const settledRanks = new Map<LeagueEntryId, number>([
    [entries[0].id, 1],
    [entries[1].id, 2],
    [entries[2].id, 2],
    [entries[3].id, 4],
    [entries[4].id, 5],
    [entries[5].id, 6],
    [entries[6].id, 7],
    [entries[7].id, 8],
  ]);

  const data = buildLiveTower(
    input({ liveData, playerPicks, entries, settledRanks }),
  );

  it('orders eight managers by provisional rank', () => {
    expect(data.state).toBe('live');
    if (data.state !== 'live') return;

    expect(data.rows.map((row) => row.event_total)).toEqual(totals);
    expect(data.rows.map((row) => row.rank)).toEqual([1, 2, 2, 4, 5, 6, 7, 8]);
  });

  it('shares the higher rank on a tie and consumes the next', () => {
    if (data.state !== 'live') return;

    // Both 70s are rank 2 and the 60 behind them is rank 4, not 3 — the same
    // tie rule as `assignRanks`, so a provisional rank settles unchanged.
    expect(data.rows[1].rank).toBe(2);
    expect(data.rows[2].rank).toBe(2);
    expect(data.rows[3].rank).toBe(4);
  });

  it('matches hand computed intervals to the manager directly above', () => {
    if (data.state !== 'live') return;

    // 80 clear, then 10 back to the first 70, nothing between the tied 70s,
    // then 10 a step all the way down.
    expect(data.rows.map((row) => row.interval)).toEqual([
      0, 10, 0, 10, 10, 10, 10, 10,
    ]);
  });

  it('matches hand computed cushions above provisional last', () => {
    if (data.state !== 'live') return;

    expect(data.rows.map((row) => row.cushion)).toEqual([
      60, 50, 50, 40, 30, 20, 10, 0,
    ]);
  });

  it('reads first place interval and last place cushion as zero', () => {
    if (data.state !== 'live') return;

    expect(data.rows[0].interval).toBe(0);
    expect(data.rows[data.rows.length - 1].cushion).toBe(0);
  });

  it('marks every row unfinished and the data provisional with its stamp', () => {
    if (data.state !== 'live') return;

    expect(data.provisional).toBe(true);
    expect(data.gameweek).toBe(GAMEWEEK);
    expect(data.computedAt).toBe(COMPUTED_AT);

    for (const row of data.rows) {
      expect(row.finished).toBe(false);
    }
  });

  it('carries manager and team names from the league entries', () => {
    if (data.state !== 'live') return;

    expect(data.rows[0].managerName).toBe('First1 Last1');
    expect(data.rows[0].teamName).toBe('Team 1');
  });
});

describe('buildLiveTower done versus to play', () => {
  it('counts six starters with minutes as done and five on zero as to play', () => {
    const entries = makeEntries(1);
    const [entry] = entries;
    const played = [11, 12, 13, 14, 15, 16].map(asElementId);
    const unplayed = [21, 22, 23, 24, 25].map(asElementId);

    const liveData = makeLive({
      ...Object.fromEntries(
        played.map((id) => [id, { points: 5, minutes: 90 }]),
      ),
      ...Object.fromEntries(
        unplayed.map((id) => [id, { points: 0, minutes: 0 }]),
      ),
    });

    const data = buildLiveTower(
      input({
        liveData,
        playerPicks: [xiPicks(entry.id, [...played, ...unplayed])],
        entries,
        settledRanks: new Map([[entry.id, 1]]),
      }),
    );

    expect(data.state).toBe('live');
    if (data.state !== 'live') return;

    expect(data.rows).toHaveLength(1);
    expect(data.rows[0].done).toBe(6);
    expect(data.rows[0].toPlay).toBe(5);
    expect(data.rows[0].event_total).toBe(30);
  });

  it('ignores the bench when counting done and to play', () => {
    const entries = makeEntries(1);
    const [entry] = entries;
    const xi = Array.from({ length: 11 }, (_, i) => asElementId(30 + i));

    const liveData = makeLive(
      Object.fromEntries(xi.map((id) => [id, { points: 2, minutes: 90 }])),
    );

    const data = buildLiveTower(
      input({
        liveData,
        playerPicks: [xiPicks(entry.id, xi)],
        entries,
        settledRanks: new Map([[entry.id, 1]]),
      }),
    );

    if (data.state !== 'live') return;

    // Eleven starters all played: 11 done, none to come, bench or no bench.
    expect(data.rows[0].done).toBe(11);
    expect(data.rows[0].toPlay).toBe(0);
  });
});

describe('buildLiveTower riser and faller state', () => {
  it('reads a better provisional rank as a riser, worse as a faller, equal as level', () => {
    const entries = makeEntries(3);
    const [a, b, c] = entries;
    const totals = [60, 50, 40];
    const liveData = makeLive(
      Object.fromEntries(
        totals.map((points, i) => [41 + i, { points, minutes: 90 }]),
      ),
    );

    const data = buildLiveTower(
      input({
        liveData,
        playerPicks: entries.map((entry, i) =>
          starPicks(entry.id, asElementId(41 + i)),
        ),
        entries,
        // A entered the week 3rd and leads provisionally (riser); B holds 2nd
        // (level); C entered 1st and trails provisionally (faller).
        settledRanks: new Map<LeagueEntryId, number>([
          [a.id, 3],
          [b.id, 2],
          [c.id, 1],
        ]),
      }),
    );

    expect(data.state).toBe('live');
    if (data.state !== 'live') return;

    expect(data.rows.map((row) => [row.league_entry, row.movement])).toEqual([
      [a.id, 'riser'],
      [b.id, 'level'],
      [c.id, 'faller'],
    ]);
  });

  it('reads an unknown baseline as level, never as a faller', () => {
    // Early season, before anything is settled: no baseline to fall from.
    const entries = makeEntries(2);
    const liveData = makeLive({
      51: { points: 60, minutes: 90 },
      52: { points: 40, minutes: 90 },
    });

    const data = buildLiveTower(
      input({
        liveData,
        playerPicks: [
          starPicks(entries[0].id, asElementId(51)),
          starPicks(entries[1].id, asElementId(52)),
        ],
        entries,
        settledRanks: new Map(),
      }),
    );

    if (data.state !== 'live') return;

    expect(data.rows.map((row) => row.movement)).toEqual(['level', 'level']);
  });
});

describe('buildLiveTower edge cases', () => {
  it('reports started false with no ranked rows before kick-off', () => {
    // The shape that broke GW1 of 2026/27: every element listed, all on zero,
    // hours before the first kick-off. Ranking it is eight joint firsts.
    const entries = makeEntries(8);
    const liveData: EventLive = {
      elements: Object.fromEntries(
        Array.from({ length: 20 }, (_, i) => [
          String(i + 1),
          { stats: { total_points: 0, minutes: 0 } },
        ]),
      ),
    };

    const data = buildLiveTower(
      input({
        liveData,
        playerPicks: entries.map((entry, i) =>
          starPicks(entry.id, asElementId(i + 1)),
        ),
        entries,
        settledRanks: new Map(entries.map((entry) => [entry.id, 1])),
      }),
    );

    expect(data.state).toBe('pre-kickoff');
    if (data.state !== 'pre-kickoff') return;

    expect(data.started).toBe(false);
    expect(data.rows).toEqual([]);
    expect(data.provisional).toBe(true);
    expect(data.gameweek).toBe(GAMEWEEK);
    expect(data.computedAt).toBe(COMPUTED_AT);
  });

  it('drops a manager with no picks without shifting the other seven', () => {
    const entries = makeEntries(8);
    const totals = [80, 70, 70, 60, 50, 40, 30, 20];
    const liveData = makeLive(
      Object.fromEntries(
        totals.map((points, i) => [i + 1, { points, minutes: 90 }]),
      ),
    );

    // The fifth manager's picks never loaded (upstream 404): empty list,
    // which `scoreGameweek` treats as "not played" for them alone.
    const playerPicks: EntryPicks[] = entries.map((entry, i) =>
      i === 4
        ? { league_entry: entry.id, picks: [] }
        : starPicks(entry.id, asElementId(i + 1)),
    );

    const data = buildLiveTower(
      input({
        liveData,
        playerPicks,
        entries,
        settledRanks: new Map(entries.map((entry) => [entry.id, 4])),
      }),
    );

    expect(data.state).toBe('live');
    if (data.state !== 'live') return;

    expect(data.rows).toHaveLength(7);
    expect(data.rows.some((row) => row.league_entry === entries[4].id)).toBe(
      false,
    );
    // Everyone else keeps their own XI sum; the missing manager simply is not
    // there, mirroring the partial-league guard in `scoreGameweek`.
    expect(data.rows.map((row) => row.event_total)).toEqual([
      80, 70, 70, 60, 40, 30, 20,
    ]);
  });
});

describe('buildLiveTower error path', () => {
  it('yields unavailable rather than ranked zeros when the feed is null', () => {
    const entries = makeEntries(8);

    const data = buildLiveTower(
      input({
        liveData: null,
        playerPicks: entries.map((entry) => ({
          league_entry: entry.id,
          picks: [],
        })),
        entries,
        settledRanks: new Map(entries.map((entry) => [entry.id, 1])),
      }),
    );

    expect(data.state).toBe('unavailable');
    expect(data.rows).toEqual([]);
    expect(data.provisional).toBe(true);
    expect(data.gameweek).toBe(GAMEWEEK);
    expect(data.computedAt).toBe(COMPUTED_AT);
  });

  it('yields unavailable when every manager’s picks are unreadable', () => {
    const entries = makeEntries(8);
    const liveData = makeLive({ 61: { points: 10, minutes: 90 } });

    const data = buildLiveTower(
      input({
        liveData,
        playerPicks: entries.map((entry) => ({
          league_entry: entry.id,
          picks: [],
        })),
        entries,
        settledRanks: new Map(entries.map((entry) => [entry.id, 1])),
      }),
    );

    // The feed says football was played but nobody has picks to score: there
    // is nothing honest to rank, so the page renders its empty state.
    expect(data.state).toBe('unavailable');
    expect(data.rows).toEqual([]);
  });
});

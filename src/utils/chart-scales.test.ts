import { describe, expect, it } from 'vitest';

import { asLeagueEntryId } from '@/interfaces/fpl';
import type { SeasonSnapshot } from '@/utils/scoring';
import {
  bumpSeries,
  heatStep,
  HEAT_LEVELS,
  MIN_DECISIVE_MEETINGS,
  scaleTicks,
  seriesKey,
  versusBand,
} from './chart-scales';

describe('versusBand', () => {
  it('reads a record of nothing but draws as even, never as a defeat', () => {
    // The defect this pins: dividing wins by `won + lost || 1` made an
    // all-drawn record score zero, which fell past every band to the heaviest
    // red — the grid saying "hammered" about a pair who have never lost to
    // each other, and contradicting the tie-is-a-draw rule in `scoring.ts`.
    expect(versusBand(0, 12, 0)).toBe('even');
  });

  it('reads a pair who have never met as even', () => {
    expect(versusBand(0, 0, 0)).toBe('even');
  });

  it('withholds the outer bands until there is enough evidence', () => {
    // One gameweek into a season every pair has met once, so every ratio is
    // 1 or 0. Without this the whole grid is solid green and red in week one.
    expect(versusBand(1, 0, 0)).toBe('good');
    expect(versusBand(0, 0, 1)).toBe('poor');
  });

  it('allows the outer bands once the meetings are there', () => {
    expect(versusBand(MIN_DECISIVE_MEETINGS, 0, 0)).toBe('strong');
    expect(versusBand(0, 0, MIN_DECISIVE_MEETINGS)).toBe('weak');
  });

  it('keeps a near-even record in the middle rather than calling it an edge', () => {
    expect(versusBand(6, 0, 5)).toBe('even');
    expect(versusBand(5, 0, 6)).toBe('even');
  });

  it('is symmetric: swapping wins and losses mirrors the band', () => {
    const mirror: Record<string, string> = {
      strong: 'weak',
      good: 'poor',
      even: 'even',
      poor: 'good',
      weak: 'strong',
    };

    for (const [won, lost] of [
      [9, 1],
      [7, 3],
      [6, 5],
      [3, 7],
      [1, 9],
    ]) {
      expect(versusBand(lost, 0, won)).toBe(mirror[versusBand(won, 0, lost)]);
    }
  });

  it('ignores draws when weighing the balance', () => {
    // Draws are neither side's advantage, so padding a record with them must
    // not move it along the scale.
    expect(versusBand(8, 20, 2)).toBe(versusBand(8, 0, 2));
  });
});

describe('heatStep', () => {
  it('gives zero its own step, distinct from the faintest count', () => {
    expect(heatStep(0, 10)).toBe(0);
    expect(heatStep(1, 10)).toBeGreaterThan(0);
  });

  it('paints the busiest cell at full intensity', () => {
    expect(heatStep(10, 10)).toBe(HEAT_LEVELS);
  });

  it('does not light up the whole grid on the first gameweek', () => {
    // With `busiest` floored at 1, a single finish in week one was also the
    // busiest cell in the grid, so every played cell rendered at maximum.
    expect(heatStep(1, 1)).toBeLessThan(HEAT_LEVELS);
  });

  it('never exceeds the ramp it is indexing into', () => {
    for (const count of [1, 5, 20, 38]) {
      const step = heatStep(count, 1);
      expect(step).toBeGreaterThanOrEqual(0);
      expect(step).toBeLessThanOrEqual(HEAT_LEVELS);
    }
  });

  it('rises with the count', () => {
    const steps = [1, 5, 10, 20, 38].map((count) => heatStep(count, 38));

    for (let i = 1; i < steps.length; i += 1) {
      expect(steps[i]).toBeGreaterThanOrEqual(steps[i - 1]);
    }
  });
});

describe('scaleTicks', () => {
  it('always labels the scale, even when the range is too narrow to step by ten', () => {
    // The defect this pins: a range of 51 to 55 stepped by 10 from 60, which
    // is already past the end, so the loop produced nothing and the box plot
    // rendered with no axis at all — every distance in it unreadable.
    expect(scaleTicks(51, 55).length).toBeGreaterThanOrEqual(2);
    expect(scaleTicks(41, 49).length).toBeGreaterThanOrEqual(2);
    expect(scaleTicks(0, 3).length).toBeGreaterThanOrEqual(2);
  });

  it('prefers round tens across a normal season range', () => {
    expect(scaleTicks(20, 90)).toEqual([20, 40, 60, 80]);
  });

  it('keeps every tick inside the scale it labels', () => {
    for (const [floor, ceiling] of [
      [20, 90],
      [51, 55],
      [41, 49],
      [0, 12],
    ]) {
      for (const tick of scaleTicks(floor, ceiling)) {
        expect(tick).toBeGreaterThanOrEqual(floor);
        expect(tick).toBeLessThanOrEqual(ceiling);
      }
    }
  });

  it('returns ascending ticks', () => {
    const ticks = scaleTicks(37, 96);

    expect([...ticks].sort((a, b) => a - b)).toEqual(ticks);
  });

  it('does not invent a scale for a degenerate range', () => {
    expect(scaleTicks(50, 50)).toEqual([50]);
  });
});

describe('bumpSeries', () => {
  const [a, b, c] = [
    asLeagueEntryId(100),
    asLeagueEntryId(101),
    asLeagueEntryId(102),
  ];

  const snapshots: SeasonSnapshot[] = [
    {
      gameweek: 1,
      places: [
        { league_entry: a, f1_score: 20, rank: 1 },
        { league_entry: b, f1_score: 15, rank: 2 },
        { league_entry: c, f1_score: 12, rank: 3 },
      ],
    },
    {
      gameweek: 2,
      places: [
        { league_entry: b, f1_score: 35, rank: 1 },
        { league_entry: a, f1_score: 32, rank: 2 },
        { league_entry: c, f1_score: 20, rank: 3 },
      ],
    },
  ];

  it('keys every manager under seriesKey, so a chart can find its own lines', () => {
    // This is the regression that made the chart render with no lines at all:
    // the points were written keyed by display name and read back by league
    // entry. Nothing in typecheck, lint or the build can see a string that
    // fails to match another string, so only this assertion can.
    const { points } = bumpSeries(snapshots, 'position');

    for (const entry of [a, b, c]) {
      for (const point of points) {
        expect(point[seriesKey(entry)]).toBeDefined();
      }
    }
  });

  it('plots the rank in position mode', () => {
    const { points } = bumpSeries(snapshots, 'position');

    expect(points[0][seriesKey(a)]).toBe(1);
    expect(points[1][seriesKey(a)]).toBe(2);
    expect(points[1][seriesKey(b)]).toBe(1);
  });

  it('pins the leader at zero and puts everyone else below in gap mode', () => {
    const { points } = bumpSeries(snapshots, 'gap');

    expect(points[1][seriesKey(b)]).toBe(0);
    expect(points[1][seriesKey(a)]).toBe(-3);
    expect(points[1][seriesKey(c)]).toBe(-15);
  });

  it('reports the furthest anyone has fallen behind', () => {
    expect(bumpSeries(snapshots, 'gap').deepest).toBe(-15);
  });

  it('never reports a positive deepest, so the axis cannot invert', () => {
    expect(bumpSeries([], 'gap').deepest).toBe(0);
    expect(bumpSeries(snapshots, 'position').deepest).toBeLessThanOrEqual(0);
  });

  it('labels each point with its gameweek', () => {
    expect(
      bumpSeries(snapshots, 'position').points.map((p) => p.event),
    ).toEqual(['GW1', 'GW2']);
  });
});

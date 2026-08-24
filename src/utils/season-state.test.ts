import { describe, expect, it } from 'vitest';

import type { GameState } from '@/interfaces/fpl';
import type { GameWeekStatus } from '@/interfaces/match';
import { deriveSeasonState } from './season-state';

/** One `event-status` row. Remember: a row is a **date**, not a gameweek. */
function row(
  event: number,
  date: string,
  leaguesUpdated: boolean,
): GameWeekStatus {
  return {
    bonus_added: leaguesUpdated,
    date,
    event,
    leagues_updated: leaguesUpdated,
    points: leaguesUpdated ? 'r' : '',
  };
}

function game(currentEvent: number | null, finished: boolean): GameState {
  return {
    current_event: currentEvent,
    current_event_finished: finished,
    next_event: currentEvent === null ? 1 : currentEvent + 1,
    processing_status: 'n',
    waivers_processed: false,
  };
}

/**
 * The exact payload observed on 2026-08-24, mid-GW1: four match days, three of
 * them already scored, one game left to play.
 */
const GW1_IN_PROGRESS: GameWeekStatus[] = [
  row(1, '2026-08-21', true),
  row(1, '2026-08-22', true),
  row(1, '2026-08-23', true),
  row(1, '2026-08-24', false),
];

describe('deriveSeasonState', () => {
  it('does not finalise a gameweek whose match days are only partly scored', () => {
    // The bug, in one assertion. `status.some((s) => s.leagues_updated)` is
    // true here — three of the four rows say so — and reading it that way
    // declared GW1 complete on the Friday night, wrote eight managers on zero
    // points into the database as final, and paid every one of them a win and
    // 20 F1 points.
    expect(deriveSeasonState(GW1_IN_PROGRESS, game(1, false))).toEqual({
      currentGameweek: 1,
      finalisedThrough: 0,
    });
  });

  it('finalises a gameweek once every match day and the game agree', () => {
    const done = GW1_IN_PROGRESS.map((r) => ({ ...r, leagues_updated: true }));

    expect(deriveSeasonState(done, game(1, true))).toEqual({
      currentGameweek: 1,
      finalisedThrough: 1,
    });
  });

  it('waits for league scoring even after the last whistle', () => {
    // `current_event_finished` flips when the football stops; `leagues_updated`
    // flips when the draft league has actually been scored, bonus included.
    // Finalising on the first alone stores a gameweek without its bonus points.
    expect(deriveSeasonState(GW1_IN_PROGRESS, game(1, true))).toEqual({
      currentGameweek: 1,
      finalisedThrough: 0,
    });
  });

  it('waits for the game even after every match day is scored', () => {
    const done = GW1_IN_PROGRESS.map((r) => ({ ...r, leagues_updated: true }));

    expect(deriveSeasonState(done, game(1, false))).toEqual({
      currentGameweek: 1,
      finalisedThrough: 0,
    });
  });

  it('treats every gameweek below the current one as settled', () => {
    // `event-status` only carries the current gameweek's dates, so nothing in
    // it can speak for GW1-4. The game moving on is the evidence.
    const state = deriveSeasonState(
      [row(5, '2026-09-19', false)],
      game(5, false),
    );

    expect(state).toEqual({ currentGameweek: 5, finalisedThrough: 4 });
  });

  it('is an empty season before the first gameweek', () => {
    // Pre-season: `event-status` 404s to `[]` and `current_event` is null.
    expect(deriveSeasonState([], game(null, false))).toEqual({
      currentGameweek: 0,
      finalisedThrough: 0,
    });
  });

  it('falls back to the status rows when /api/game cannot be read', () => {
    expect(deriveSeasonState(GW1_IN_PROGRESS, null)).toEqual({
      currentGameweek: 1,
      finalisedThrough: 0,
    });

    const done = GW1_IN_PROGRESS.map((r) => ({ ...r, leagues_updated: true }));
    expect(deriveSeasonState(done, null)).toEqual({
      currentGameweek: 1,
      finalisedThrough: 1,
    });
  });

  it('does not finalise a gameweek it has no status rows for', () => {
    // "We cannot tell" is not "finished". `every` on an empty list is `true`,
    // which is exactly the trap this guards.
    expect(deriveSeasonState([], game(3, true))).toEqual({
      currentGameweek: 3,
      finalisedThrough: 2,
    });
  });

  it('ignores rows belonging to other gameweeks', () => {
    // A payload carrying the tail of GW1 and the start of GW2 must not let
    // GW1's finished rows finalise GW2.
    const mixed = [row(1, '2026-08-24', true), row(2, '2026-08-29', false)];

    expect(deriveSeasonState(mixed, game(2, false))).toEqual({
      currentGameweek: 2,
      finalisedThrough: 1,
    });
  });
});

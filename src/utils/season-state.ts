/**
 * Which gameweek is in play, and which gameweeks are actually over.
 *
 * Pure, and separated out for the same reason `scoring.ts` is: this is the
 * decision that says whether a result may be written to the database and never
 * looked at again. It got that decision wrong on the first weekend of the
 * 2026/27 season, and the cost was a permanently corrupted GW1.
 *
 * ## `/pl/event-status` has one row per **date**, not per gameweek
 *
 * This is the trap. The field names read like a gameweek summary and the
 * payload is a gameweek's *match days*:
 *
 * ```jsonc
 * { "status": [
 *   { "date": "2026-08-21", "event": 1, "leagues_updated": true,  "points": "p" },
 *   { "date": "2026-08-22", "event": 1, "leagues_updated": true,  "points": "p" },
 *   { "date": "2026-08-23", "event": 1, "leagues_updated": true,  "points": "p" },
 *   { "date": "2026-08-24", "event": 1, "leagues_updated": false, "points": ""  },
 * ] }
 * ```
 *
 * `leagues_updated` means "the league table was brought up to date after *that
 * day's* matches" — not "this gameweek is final". So
 * `status.filter((s) => s.leagues_updated)` reports GW1 complete on the Friday
 * night, with three days of football still to play. That is what the app did,
 * and combined with a live feed that was all zeros before kick-off it wrote
 * eight managers on 0 points, all tied on rank 1, straight into
 * `gameweek_scores` — where a finalised gameweek is never refetched. Every
 * manager banked a win and 20 F1 points, permanently.
 *
 * ## The rule
 *
 * A gameweek is final when **both** sources agree, and `/api/game` is the
 * senior of the two because it answers year-round and says exactly one thing:
 *
 * - Any gameweek **below** `current_event` is over — the game has moved on.
 * - `current_event` is over only when `current_event_finished` is true **and**
 *   every one of its `event-status` rows has `leagues_updated`.
 *
 * The second half is not redundant. `current_event_finished` flips when the
 * last whistle blows; `leagues_updated` flips when the draft league's scoring
 * has actually been processed, bonus points included. Waiting for both means a
 * gameweek is occasionally finalised one cron run later than it could have
 * been, which costs nothing — the in-flight path still shows it — while the
 * opposite mistake is unrecoverable without a manual delete.
 */
import type { GameWeekStatus } from '@/interfaces/match';
import type { GameState } from '@/interfaces/fpl';

export interface SeasonState {
  /**
   * The gameweek being played, or the most recent one if none is in progress.
   * `0` before the season starts.
   */
  currentGameweek: number;
  /**
   * The highest gameweek whose scoring is final and therefore safe to store.
   * `0` when none is — including all through the opening gameweek.
   */
  finalisedThrough: number;
}

/**
 * Derive the season's position from the two upstream state endpoints.
 *
 * `game` is `null` when `/api/game` could not be read. The fallback is
 * deliberately the pessimistic one: without it, a gameweek is final only if
 * every `event-status` row for it says so, which is still correct for a
 * completed gameweek and simply defers an in-flight one.
 */
export function deriveSeasonState(
  status: GameWeekStatus[],
  game: GameState | null,
): SeasonState {
  const statusMax = status.reduce((max, row) => Math.max(max, row.event), 0);

  // `current_event` is `null` pre-season, and `event-status` 404s to `[]` at
  // the same time, so both being absent means the season has not started.
  const currentGameweek = game?.current_event ?? statusMax;

  if (currentGameweek <= 0) return { currentGameweek: 0, finalisedThrough: 0 };

  const rows = status.filter((row) => row.event === currentGameweek);

  // Every row, not some row — see the module comment. No rows at all is "we
  // cannot tell", which is not the same as "finished".
  const leagueScoringDone =
    rows.length > 0 && rows.every((row) => row.leagues_updated);

  // Without `/api/game` the status rows are all we have. With it, its verdict
  // has to agree.
  const currentIsFinal = game
    ? game.current_event_finished && leagueScoringDone
    : leagueScoringDone;

  return {
    currentGameweek,
    finalisedThrough: currentIsFinal ? currentGameweek : currentGameweek - 1,
  };
}

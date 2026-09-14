import type { EventLive } from '@/interfaces/fpl';
import type { GameweekPerformance } from '@/interfaces/players';

import { hasBeenPlayed } from './scoring';

/**
 * The pure half of two phase finalisation: fingerprint a scored gameweek and
 * decide whether its candidate may be confirmed.
 *
 * No fetch, no database, no cache, no clock. Timestamps arrive as arguments,
 * so every path below is reachable from a test without waiting out the hold.
 *
 * The rule this exists for: on 2026-08-21 a single agreeing but wrong read
 * was enough to freeze GW1 as eight managers on nil points, joint first, for
 * three days. A newly finished gameweek is now held as a candidate and stored
 * only after two consecutive agreeing reads separated by at least
 * {@link CANDIDATE_HOLD_SECONDS}. The fingerprint compares scored content,
 * not verdicts, so two different wrong payloads can never confirm each other.
 *
 * `gameweek-data.ts` keeps the I/O and calls into here. The candidate row
 * itself (league scoped, fingerprint plus first seen timestamp) is owned by
 * the DAL; this module only decides record, hold, confirm, reset or drop.
 */

/**
 * How long a candidate waits between its first sighting and the read that may
 * confirm it, in seconds.
 *
 * Two hours against the three hour cron in `vercel.json` (`0 *\/3 * * *`).
 * Two rapid page renders can never confirm each other, while one genuine cron
 * tick always can, so the worst case added delay is about one cron cycle.
 */
export const CANDIDATE_HOLD_SECONDS = 7200;

/**
 * A stable serialisation of one gameweek's scored content.
 *
 * Sorted `(league_entry, event_total, rank)` rows plus the played flag, so
 * input order never matters and any changed total, rank or played signal
 * reads as a different fingerprint. `finished` is deliberately excluded: it
 * is a verdict about the rows, not content, and both agreeing reads score
 * with it true.
 */
export function fingerprintPerformances(
  performances: readonly GameweekPerformance[],
  liveData: EventLive | null,
): string {
  // The same minutes or total points signal `hasBeenPlayed` uses, so an
  // unscored feed wearing the shape of a scored one cannot agree with the
  // real thing.
  const played = hasBeenPlayed(liveData) ? 1 : 0;
  const rows = [...performances]
    .sort((a, b) => a.league_entry - b.league_entry)
    .map(
      (performance) =>
        `${performance.league_entry}:${performance.event_total}:${performance.rank}`,
    )
    .join(';');

  return `v1:played=${played}:${rows}`;
}

/**
 * The candidate the DAL holds, if any. The row carries more (league scoping,
 * last checked stamp, block reason); the decision only needs what proves
 * agreement across two reads.
 */
export interface CandidateRecord {
  fingerprint: string;
  /** Epoch seconds of the first sighting. Passed in, never read from a clock. */
  firstSeenSeconds: number;
}

export interface EvaluateCandidateArgs {
  /** The stored candidate, or null on first sighting. */
  existing: CandidateRecord | null;
  /** From {@link fingerprintPerformances}, over this read's performances. */
  fingerprint: string;
  /** `deriveSeasonState` still calls this gameweek final on this read. */
  deciderFinal: boolean;
  /** Epoch seconds now. Passed in, never read from a clock. */
  nowSeconds: number;
  /** This read scored no performances, so there is nothing to agree on. */
  isEmpty: boolean;
}

export type CandidateOutcome = 'record' | 'hold' | 'confirm' | 'reset' | 'drop';

export interface CandidateDecision {
  outcome: CandidateOutcome;
  /**
   * The candidate to keep. Null on drop: the DAL deletes the row. On record
   * and reset it carries the fresh fingerprint and timestamp; on hold and
   * confirm it echoes the stored one.
   */
  candidate: CandidateRecord | null;
}

/**
 * Decide what a fresh read means for a gameweek's candidate.
 *
 * Never throws: every refusal path returns data, following the
 * `rejectUnfinalisable` precedent, because the caller serves every page
 * render and a throw would take the site down to prevent a write.
 *
 * - First sighting of scored content while the decider says final: record.
 * - Same fingerprint but the hold has not elapsed: hold.
 * - Same fingerprint past the hold with the decider still final: confirm.
 * - Different fingerprint: reset with the new fingerprint and a fresh clock.
 * - Decider no longer final: drop, even with a matching fingerprint.
 * - Empty read: hold, never confirm, and never reset an existing candidate's
 *   clock on a transient empty read.
 */
export function evaluateCandidate(
  args: EvaluateCandidateArgs,
): CandidateDecision {
  const { existing, fingerprint, deciderFinal, nowSeconds, isEmpty } = args;

  // The decider has the only vote on finished. A reversal drops the candidate
  // outright, so a gameweek that unfinishes cannot be confirmed by stale
  // agreement.
  if (!deciderFinal) return { outcome: 'drop', candidate: null };

  // Nothing scored means nothing to agree on. Holding rather than resetting
  // keeps a transient empty read from restarting the hold for no reason, and
  // an empty fingerprint string is caller nonsense that must never confirm.
  if (isEmpty || fingerprint === '') {
    if (existing === null) {
      return {
        outcome: 'hold',
        candidate: { fingerprint, firstSeenSeconds: nowSeconds },
      };
    }

    return { outcome: 'hold', candidate: existing };
  }

  if (existing === null) {
    return {
      outcome: 'record',
      candidate: { fingerprint, firstSeenSeconds: nowSeconds },
    };
  }

  // Same verdict, different content: the two reads disagree, so the hold
  // restarts from this read rather than confirming.
  if (fingerprint !== existing.fingerprint) {
    return {
      outcome: 'reset',
      candidate: { fingerprint, firstSeenSeconds: nowSeconds },
    };
  }

  if (nowSeconds - existing.firstSeenSeconds >= CANDIDATE_HOLD_SECONDS) {
    return { outcome: 'confirm', candidate: existing };
  }

  return { outcome: 'hold', candidate: existing };
}

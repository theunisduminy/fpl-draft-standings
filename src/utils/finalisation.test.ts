import { describe, expect, it } from 'vitest';

import { asLeagueEntryId, type EventLive } from '@/interfaces/fpl';
import type { GameweekPerformance } from '@/interfaces/players';

import {
  CANDIDATE_HOLD_SECONDS,
  evaluateCandidate,
  fingerprintPerformances,
  type CandidateRecord,
} from './finalisation';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const HOUR = 3600;
const FIRST_SEEN = 1_756_000_000;

function performance(
  leagueEntry: number,
  eventTotal: number,
  rank: number,
): GameweekPerformance {
  return {
    event: 1,
    league_entry: asLeagueEntryId(leagueEntry),
    event_total: eventTotal,
    rank,
    finished: true,
  };
}

/** Eight managers scored and ranked, best first. */
function scoredWeek(): GameweekPerformance[] {
  return [60, 55, 50, 45, 40, 35, 30, 25].map((total, index) =>
    performance(100 + index, total, index + 1),
  );
}

/** A live feed where the given elements have played 90 minutes. */
function playedLive(ids: number[]): EventLive {
  return {
    elements: Object.fromEntries(
      ids.map((id) => [
        String(id),
        { stats: { total_points: 6, minutes: 90 } },
      ]),
    ),
  };
}

/** The pre kickoff shape: every element listed, none having played. */
function unplayedLive(ids: number[]): EventLive {
  return {
    elements: Object.fromEntries(
      ids.map((id) => [String(id), { stats: { total_points: 0, minutes: 0 } }]),
    ),
  };
}

function candidateFor(
  fingerprint: string,
  firstSeenSeconds = FIRST_SEEN,
): CandidateRecord {
  return { fingerprint, firstSeenSeconds };
}

// ---------------------------------------------------------------------------
// fingerprintPerformances
// ---------------------------------------------------------------------------

describe('fingerprintPerformances', () => {
  it('is stable regardless of input order', () => {
    const live = playedLive([1, 2, 3]);
    const forward = fingerprintPerformances(scoredWeek(), live);
    const backward = fingerprintPerformances([...scoredWeek()].reverse(), live);

    expect(backward).toBe(forward);
  });

  it('changes when a total changes', () => {
    const live = playedLive([1, 2, 3]);
    const before = fingerprintPerformances(scoredWeek(), live);
    const changed = scoredWeek().map((row) =>
      row.league_entry === asLeagueEntryId(100)
        ? { ...row, event_total: row.event_total + 1 }
        : row,
    );

    expect(fingerprintPerformances(changed, live)).not.toBe(before);
  });

  it('changes when a rank changes', () => {
    const live = playedLive([1, 2, 3]);
    const before = fingerprintPerformances(scoredWeek(), live);
    const changed = scoredWeek().map((row) =>
      row.league_entry === asLeagueEntryId(100) ? { ...row, rank: 2 } : row,
    );

    expect(fingerprintPerformances(changed, live)).not.toBe(before);
  });

  it('mixes in the played flag, so unscored feeds cannot agree with scored ones', () => {
    const week = scoredWeek();
    const ids = [1, 2, 3];

    expect(fingerprintPerformances(week, unplayedLive(ids))).not.toBe(
      fingerprintPerformances(week, playedLive(ids)),
    );
  });

  it('fingerprints an empty list stably without matching scored content', () => {
    const first = fingerprintPerformances([], null);
    const second = fingerprintPerformances([], null);

    expect(second).toBe(first);
    expect(first).not.toBe(
      fingerprintPerformances(scoredWeek(), playedLive([1])),
    );
  });
});

// ---------------------------------------------------------------------------
// CANDIDATE_HOLD_SECONDS
// ---------------------------------------------------------------------------

describe('CANDIDATE_HOLD_SECONDS', () => {
  it('holds two hours against the three hour cron', () => {
    // Two rapid page renders must never confirm each other, while one genuine
    // cron tick always can. A change here moves the R4 freshness bound, so it
    // is pinned rather than derived.
    expect(CANDIDATE_HOLD_SECONDS).toBe(2 * HOUR);
  });
});

// ---------------------------------------------------------------------------
// evaluateCandidate
// ---------------------------------------------------------------------------

describe('evaluateCandidate', () => {
  it('records a first sighting of scored content while the decider says final', () => {
    const fingerprint = fingerprintPerformances(
      scoredWeek(),
      playedLive([1, 2, 3]),
    );

    expect(
      evaluateCandidate({
        existing: null,
        fingerprint,
        deciderFinal: true,
        nowSeconds: FIRST_SEEN,
        isEmpty: false,
      }),
    ).toEqual({
      outcome: 'record',
      candidate: { fingerprint, firstSeenSeconds: FIRST_SEEN },
    });
  });

  it('confirms identical fingerprints three hours apart with the decider still final', () => {
    const fingerprint = fingerprintPerformances(
      scoredWeek(),
      playedLive([1, 2, 3]),
    );

    expect(
      evaluateCandidate({
        existing: candidateFor(fingerprint),
        fingerprint,
        deciderFinal: true,
        nowSeconds: FIRST_SEEN + 3 * HOUR,
        isEmpty: false,
      }),
    ).toEqual({
      outcome: 'confirm',
      candidate: candidateFor(fingerprint),
    });
  });

  it('confirms exactly on the hold boundary', () => {
    const fingerprint = fingerprintPerformances(
      scoredWeek(),
      playedLive([1, 2, 3]),
    );

    expect(
      evaluateCandidate({
        existing: candidateFor(fingerprint),
        fingerprint,
        deciderFinal: true,
        nowSeconds: FIRST_SEEN + CANDIDATE_HOLD_SECONDS,
        isEmpty: false,
      }).outcome,
    ).toBe('confirm');
  });

  it('holds identical fingerprints five minutes apart, rather than confirming', () => {
    const fingerprint = fingerprintPerformances(
      scoredWeek(),
      playedLive([1, 2, 3]),
    );

    expect(
      evaluateCandidate({
        existing: candidateFor(fingerprint),
        fingerprint,
        deciderFinal: true,
        nowSeconds: FIRST_SEEN + 5 * 60,
        isEmpty: false,
      }),
    ).toEqual({
      outcome: 'hold',
      candidate: candidateFor(fingerprint),
    });
  });

  it('holds one second before the hold elapses', () => {
    const fingerprint = fingerprintPerformances(
      scoredWeek(),
      playedLive([1, 2, 3]),
    );

    expect(
      evaluateCandidate({
        existing: candidateFor(fingerprint),
        fingerprint,
        deciderFinal: true,
        nowSeconds: FIRST_SEEN + CANDIDATE_HOLD_SECONDS - 1,
        isEmpty: false,
      }).outcome,
    ).toBe('hold');
  });

  it('resets with the new fingerprint and a fresh timestamp on disagreement', () => {
    const live = playedLive([1, 2, 3]);
    const oldFingerprint = fingerprintPerformances(scoredWeek(), live);
    const drifted = scoredWeek().map((row) =>
      row.league_entry === asLeagueEntryId(101)
        ? { ...row, event_total: row.event_total + 2 }
        : row,
    );
    const newFingerprint = fingerprintPerformances(drifted, live);
    const now = FIRST_SEEN + 3 * HOUR;

    expect(
      evaluateCandidate({
        existing: candidateFor(oldFingerprint),
        fingerprint: newFingerprint,
        deciderFinal: true,
        nowSeconds: now,
        isEmpty: false,
      }),
    ).toEqual({
      outcome: 'reset',
      candidate: { fingerprint: newFingerprint, firstSeenSeconds: now },
    });
  });

  it('restarts the hold after a reset, rather than confirming on the old clock', () => {
    const live = playedLive([1, 2, 3]);
    const drifted = scoredWeek().map((row) =>
      row.league_entry === asLeagueEntryId(101)
        ? { ...row, event_total: row.event_total + 2 }
        : row,
    );
    const newFingerprint = fingerprintPerformances(drifted, live);
    const resetAt = FIRST_SEEN + 3 * HOUR;

    // The reset decision carries the fresh timestamp; a read agreeing with it
    // five minutes later must hold, even though the original first sighting
    // is long past the hold.
    const reset = evaluateCandidate({
      existing: candidateFor(fingerprintPerformances(scoredWeek(), live)),
      fingerprint: newFingerprint,
      deciderFinal: true,
      nowSeconds: resetAt,
      isEmpty: false,
    });

    expect(reset.outcome).toBe('reset');
    expect(reset.candidate).toEqual({
      fingerprint: newFingerprint,
      firstSeenSeconds: resetAt,
    });

    expect(
      evaluateCandidate({
        existing: reset.candidate ?? candidateFor(newFingerprint, resetAt),
        fingerprint: newFingerprint,
        deciderFinal: true,
        nowSeconds: resetAt + 5 * 60,
        isEmpty: false,
      }).outcome,
    ).toBe('hold');
  });

  it('drops the candidate when the decider is no longer final, even with a matching fingerprint', () => {
    const fingerprint = fingerprintPerformances(
      scoredWeek(),
      playedLive([1, 2, 3]),
    );

    expect(
      evaluateCandidate({
        existing: candidateFor(fingerprint),
        fingerprint,
        deciderFinal: false,
        nowSeconds: FIRST_SEEN + 3 * HOUR,
        isEmpty: false,
      }),
    ).toEqual({ outcome: 'drop', candidate: null });
  });

  it('drops on a first sighting the decider does not call final', () => {
    expect(
      evaluateCandidate({
        existing: null,
        fingerprint: 'v1:played=1:100:60:1',
        deciderFinal: false,
        nowSeconds: FIRST_SEEN,
        isEmpty: false,
      }),
    ).toEqual({ outcome: 'drop', candidate: null });
  });

  it('drops on a decider reversal even when the read is empty', () => {
    const stored = candidateFor(
      fingerprintPerformances(scoredWeek(), playedLive([1, 2, 3])),
    );

    expect(
      evaluateCandidate({
        existing: stored,
        fingerprint: fingerprintPerformances([], null),
        deciderFinal: false,
        nowSeconds: FIRST_SEEN + 3 * HOUR,
        isEmpty: true,
      }),
    ).toEqual({ outcome: 'drop', candidate: null });
  });

  it('never confirms an empty performance list', () => {
    const emptyFingerprint = fingerprintPerformances([], null);

    expect(
      evaluateCandidate({
        existing: candidateFor(emptyFingerprint),
        fingerprint: emptyFingerprint,
        deciderFinal: true,
        nowSeconds: FIRST_SEEN + 3 * HOUR,
        isEmpty: true,
      }).outcome,
    ).not.toBe('confirm');
  });

  it('holds an empty read against the stored candidate instead of resetting its clock', () => {
    const stored = candidateFor(
      fingerprintPerformances(scoredWeek(), playedLive([1, 2, 3])),
    );

    expect(
      evaluateCandidate({
        existing: stored,
        fingerprint: fingerprintPerformances([], null),
        deciderFinal: true,
        nowSeconds: FIRST_SEEN + 3 * HOUR,
        isEmpty: true,
      }),
    ).toEqual({ outcome: 'hold', candidate: stored });
  });

  it('holds rather than records an empty first sighting', () => {
    expect(
      evaluateCandidate({
        existing: null,
        fingerprint: fingerprintPerformances([], null),
        deciderFinal: true,
        nowSeconds: FIRST_SEEN,
        isEmpty: true,
      }).outcome,
    ).toBe('hold');
  });

  it('holds when the clock runs backwards instead of throwing or confirming', () => {
    const fingerprint = fingerprintPerformances(
      scoredWeek(),
      playedLive([1, 2, 3]),
    );

    expect(
      evaluateCandidate({
        existing: candidateFor(fingerprint),
        fingerprint,
        deciderFinal: true,
        nowSeconds: FIRST_SEEN - HOUR,
        isEmpty: false,
      }).outcome,
    ).toBe('hold');
  });

  it('never confirms caller nonsense: an empty fingerprint string holds', () => {
    const stored = candidateFor('v1:played=1:100:60:1');

    expect(
      evaluateCandidate({
        existing: stored,
        fingerprint: '',
        deciderFinal: true,
        nowSeconds: FIRST_SEEN + 3 * HOUR,
        isEmpty: false,
      }).outcome,
    ).toBe('hold');
  });
});

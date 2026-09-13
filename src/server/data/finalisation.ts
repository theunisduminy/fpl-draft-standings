import 'server-only';

import { and, asc, eq } from 'drizzle-orm';

import { getDb } from '@/server/db/client';
import { finalisationCandidates } from '@/server/db/schema';
import type { FinalisationCandidateRow } from '@/server/db/schema';
import { getLeagueId } from '@/utils/fpl-api';
import {
  truncateText,
  TRIPWIRE_EVIDENCE_MAX_CHARS,
} from '@/utils/shape-tripwires';

/**
 * Persistence for finalisation candidates.
 *
 * A candidate is a claim that one read found a gameweek finished — nothing
 * more. The two-phase finalise path (see `src/utils/gameweek-data.ts`)
 * records one on first sighting and deletes it on confirm or drop, so rows
 * here are always transient: they never accumulate, and they are never read
 * as scores.
 *
 * Everything is scoped to the current league, like `src/server/data/gameweeks.ts`.
 * The insert is conflict-ignoring, so two instances recording the same
 * payload converge instead of competing.
 */

/** Every held candidate for the current league, oldest gameweek first. */
export async function readCandidates(): Promise<FinalisationCandidateRow[]> {
  const leagueId = getLeagueId();

  return getDb()
    .select()
    .from(finalisationCandidates)
    .where(eq(finalisationCandidates.leagueId, leagueId))
    .orderBy(asc(finalisationCandidates.gameweek));
}

function candidateScope(gameweek: number) {
  const leagueId = getLeagueId();

  return and(
    eq(finalisationCandidates.leagueId, leagueId),
    eq(finalisationCandidates.gameweek, gameweek),
  );
}

/**
 * Record a sighting of a finished-but-unstored gameweek.
 *
 * Insert-only: a first sighting inserts, a repeat sighting with the same
 * fingerprint only touches `lastChecked`, and a sighting with a *different*
 * fingerprint resets the row (new fingerprint, fresh `firstSeen`, cleared
 * block reason) rather than duplicating it. Nothing here ever confirms — the
 * caller decides that from the pure agreement rules, then deletes via
 * {@link confirmCandidate}.
 */
export async function recordCandidate(
  gameweek: number,
  fingerprint: string,
): Promise<void> {
  const leagueId = getLeagueId();
  const db = getDb();
  const now = new Date();
  const scope = candidateScope(gameweek);

  const existing = await db.select().from(finalisationCandidates).where(scope);
  const current = existing[0];

  if (!current) {
    await db
      .insert(finalisationCandidates)
      .values({
        leagueId,
        gameweek,
        fingerprint,
        firstSeen: now,
        lastChecked: now,
      })
      .onConflictDoNothing();
    return;
  }

  if (current.fingerprint !== fingerprint) {
    await db
      .update(finalisationCandidates)
      .set({
        fingerprint,
        firstSeen: now,
        lastChecked: now,
        blockReason: null,
      })
      .where(scope);
    return;
  }

  await db
    .update(finalisationCandidates)
    .set({ lastChecked: now })
    .where(scope);
}

/**
 * Delete the candidate for a gameweek, on confirm (it is now stored) or on
 * drop (the decider no longer calls it final). Deleting is the only removal
 * path — candidates are never edited into facts.
 */
export async function confirmCandidate(gameweek: number): Promise<void> {
  await getDb().delete(finalisationCandidates).where(candidateScope(gameweek));
}

/**
 * Attach a refusal reason to a gameweek without confirming it.
 *
 * Creates the row when none exists (a blocked gameweek may never have been
 * recorded as a plain candidate); otherwise updates only the block reason and
 * `lastChecked`, leaving the fingerprint and the hold clock untouched.
 */
export async function noteBlocked(
  gameweek: number,
  fingerprint: string,
  reason: string,
): Promise<void> {
  const leagueId = getLeagueId();
  const now = new Date();
  // Bounded like probe evidence, so logs and the row stay readable. No
  // suffix: the column holds the reason, not a log line.
  const blockReason = truncateText(reason, TRIPWIRE_EVIDENCE_MAX_CHARS, '');

  await getDb()
    .insert(finalisationCandidates)
    .values({
      leagueId,
      gameweek,
      fingerprint,
      firstSeen: now,
      lastChecked: now,
      blockReason,
    })
    .onConflictDoUpdate({
      target: [
        finalisationCandidates.leagueId,
        finalisationCandidates.gameweek,
      ],
      set: { blockReason, lastChecked: now },
    });
}

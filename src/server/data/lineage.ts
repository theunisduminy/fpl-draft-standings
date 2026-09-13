import 'server-only';

import { asc, eq } from 'drizzle-orm';

import { getDb } from '@/server/db/client';
import {
  draftPicks,
  ownershipSnapshots,
  type DraftPickRow,
} from '@/server/db/schema';
import { getLeagueId } from '@/utils/fpl-api';
// Row-mapping helpers owned by the sibling pure module (`src/utils/draft-lineage.ts`,
// U1). The DAL never builds a fact inline: it accepts exactly what these helpers
// produce, so the write types below are derived from their return types rather
// than restated here. Names follow the `toElementRows` / `toTeamRows` precedent
// in `src/utils/reference-mapping.ts`.
import {
  toDraftPickRows,
  toOwnershipSnapshotRows,
} from '@/utils/draft-lineage';

/**
 * Persistence for the draft-to-waiver lineage: the frozen draft record and the
 * weekly ownership snapshots.
 *
 * Both tables hold **immutable facts**, so both writes are insert-only
 * (`onConflictDoNothing`, first write wins) on the `storeFinalisedGameweeks`
 * precedent in `src/server/data/gameweeks.ts`. A snapshot that lands against
 * the wrong ownership cannot be corrected by a later run — which is why the
 * cron only ever snapshots gameweeks its own finalise step newly stored, and
 * why an empty row set is refused with a log rather than written.
 *
 * **Everything here is scoped to the current league**, because a league id is
 * effectively a season id — see the schema. Joins key on the stable
 * `ElementCode`, never the season-minted `ElementId`; the scoped ids ride
 * along as audit columns.
 *
 * Thin on purpose, on the `src/server/data/elements.ts` precedent: these
 * functions move rows and nothing else. What a row *means* lives in the pure
 * sibling module above, where it is tested without a database.
 */

/** One seeded draft fact, exactly as the pure mapping helper produces it. */
export type DraftPickSeedRow = ReturnType<typeof toDraftPickRows>[number];
/** One ownership fact, exactly as the pure mapping helper produces it. */
export type OwnershipSnapshotSeedRow = ReturnType<
  typeof toOwnershipSnapshotRows
>[number];

/**
 * Which gameweeks already hold an ownership snapshot, for the current league.
 *
 * The retry half of the never-backfill rule: the cron derives snapshot
 * coverage from stored-minus-snapshotted rather than from one run's diff, so
 * a coinciding lineage failure delays a snapshot instead of deleting it.
 */
export async function readSnapshottedGameweeks(): Promise<number[]> {
  const leagueId = getLeagueId();

  const rows = await getDb()
    .selectDistinct({ gameweek: ownershipSnapshots.gameweek })
    .from(ownershipSnapshots)
    .where(eq(ownershipSnapshots.leagueId, leagueId));

  return rows.map((row) => row.gameweek);
}

/**
 * Every stored draft pick for the current league, in draft-board order.
 *
 * Ordered by draft event then index, so the August draft's 120 picks read
 * before the GW24 re-draft's, and each draft reads in the order it was made.
 *
 * **Never swallows its own errors.** A connection failure returning `[]`
 * would read as "no draft yet" and send the provenance join down its
 * upstream fallback while Neon was down.
 */
export async function readDraftPicks(): Promise<DraftPickRow[]> {
  const leagueId = getLeagueId();

  return getDb()
    .select()
    .from(draftPicks)
    .where(eq(draftPicks.leagueId, leagueId))
    .orderBy(asc(draftPicks.draftEvent), asc(draftPicks.draftIndex));
}

/**
 * Seed the frozen draft record, once per draft id.
 *
 * Insert-only: re-seeding the same payload writes zero rows. An empty choices
 * response against a populated table therefore keeps the table (R2 working),
 * and a populated table is never re-synced. Returns the count actually
 * written, via `RETURNING`, so the cron guard can tell seed from no-op.
 *
 * Refuses an empty row set with a log and writes nothing — the
 * `storeFinalisedGameweeks` refusal precedent. There is nothing provisional
 * to check here beyond emptiness: finalisation authority stays with
 * `deriveSeasonState()`, and the caller only seeds a started draft id.
 */
export async function seedDraftPicks(
  rows: DraftPickSeedRow[],
): Promise<number> {
  if (rows.length === 0) {
    console.error(
      '[lineage] Refusing to seed draft picks: empty row set. Writing nothing.',
    );
    return 0;
  }

  const inserted = await getDb()
    .insert(draftPicks)
    .values(rows)
    .onConflictDoNothing()
    .returning();

  return inserted.length;
}

/**
 * Store one gameweek's ownership snapshot.
 *
 * Insert-only with first write wins: re-storing keeps the first snapshot.
 * Covers exactly the gameweeks the same cron run newly finalised — never a
 * backfill, because `element-status` reflects the present and re-reading it
 * against an old gameweek would misattribute. Returns the count actually
 * written.
 *
 * Refuses an empty row set with a log and writes nothing, mirroring
 * `rejectUnfinalisable` next door: a failed `element-status` read must fail
 * its lineage step, never freeze in as 581 free agents.
 */
export async function storeOwnershipSnapshots(
  gameweek: number,
  rows: OwnershipSnapshotSeedRow[],
): Promise<number> {
  if (rows.length === 0) {
    console.error(
      `[lineage] Refusing to store ownership snapshot for GW${gameweek}: ` +
        'empty row set. It stays absent and will be retried.',
    );
    return 0;
  }

  const inserted = await getDb()
    .insert(ownershipSnapshots)
    .values(rows)
    .onConflictDoNothing()
    .returning();

  return inserted.length;
}

import 'server-only';

import { eq, sql } from 'drizzle-orm';

import { getDb } from '@/server/db/client';
import { draftElements } from '@/server/db/schema';
import type { DraftElementRow, NewDraftElementRow } from '@/server/db/schema';
import { getLeagueId } from '@/utils/fpl-api';

/**
 * Persistence for the footballers.
 *
 * Thin on purpose: these functions move rows and nothing else. What a row
 * *means* — how a payload becomes one, whether a set of them may be trusted —
 * lives in `src/utils/reference-mapping.ts`, where it is pure and tested.
 *
 * **Everything here is scoped to the current league**, because a league id is
 * effectively a season id. `element_id` is re-minted every August, so an
 * unscoped query would not merely return stale rows — it would answer with a
 * different footballer.
 */

export interface StoredElements {
  rows: DraftElementRow[];
  /**
   * The **oldest** `synced_at` in the set, not the newest.
   *
   * A staleness check is only as good as its weakest row. All rows normally
   * carry the same stamp — a sync rewrites the whole set — so the two agree;
   * they diverge exactly when a sync failed partway, which is when a reader
   * most needs to be told the table is stale rather than reassured by whichever
   * rows did get written.
   *
   * `null` when there are no rows, which the caller reads as `empty` anyway.
   */
  syncedAt: Date | null;
}

/**
 * Every stored element for the current season.
 *
 * Takes no id filter. The league's whole set is ~581 narrow rows, and reading
 * it unfiltered is what lets the caller issue this query in parallel with the
 * ownership call rather than waiting to learn which ids to ask for.
 * Completeness against the owned ids is then decided in pure code.
 *
 * **Never swallows its own errors.** A connection failure returning `[]` would
 * be indistinguishable from an empty table, and the caller's fallback log would
 * say "never synced" while Neon was down.
 */
export async function readElements(): Promise<StoredElements> {
  const leagueId = getLeagueId();

  const rows = await getDb()
    .select()
    .from(draftElements)
    .where(eq(draftElements.leagueId, leagueId));

  return { rows, syncedAt: oldestSync(rows) };
}

/**
 * Write the season's elements, overwriting what is there.
 *
 * `onConflictDoUpdate`, unlike `storeFinalisedGameweeks` next door, and the
 * difference is the point: a finished gameweek is immutable, so overwriting one
 * would be a bug, while reference data is *expected* to move — a player is
 * transferred, points accumulate. Doing nothing on conflict here would freeze
 * the table at its first sync.
 *
 * No prune. A footballer who leaves the league still needs a name for the
 * gameweeks they played in.
 */
export async function upsertElements(
  rows: NewDraftElementRow[],
): Promise<number> {
  if (rows.length === 0) return 0;

  await getDb()
    .insert(draftElements)
    .values(rows)
    .onConflictDoUpdate({
      target: [draftElements.leagueId, draftElements.elementId],
      set: {
        code: sqlExcluded('code'),
        webName: sqlExcluded('web_name'),
        position: sqlExcluded('position'),
        teamCode: sqlExcluded('team_code'),
        totalPoints: sqlExcluded('total_points'),
        syncedAt: new Date(),
      },
    });

  return rows.length;
}

/**
 * The value the insert would have written, for use in a conflict update.
 *
 * Postgres exposes it as the `excluded` pseudo-table. Written out rather than
 * assembled from the column object so a typo is visible here rather than as a
 * column that silently never updates.
 */
function sqlExcluded(column: string) {
  return sql.raw(`excluded.${column}`);
}

function oldestSync(rows: { syncedAt: Date }[]): Date | null {
  if (rows.length === 0) return null;

  return rows.reduce(
    (oldest, row) => (row.syncedAt < oldest ? row.syncedAt : oldest),
    rows[0].syncedAt,
  );
}

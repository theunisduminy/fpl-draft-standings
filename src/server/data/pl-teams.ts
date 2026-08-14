import 'server-only';

import { and, eq, notInArray, sql } from 'drizzle-orm';

import { getDb } from '@/server/db/client';
import { plTeams } from '@/server/db/schema';
import type { NewPlTeamRow, PlTeamRow } from '@/server/db/schema';
import { getLeagueId } from '@/utils/fpl-api';
import { latestSync } from '@/utils/reference-mapping';

/**
 * Persistence for the 20 clubs.
 *
 * A separate module from `elements.ts` because the DAL convention is one module
 * per domain and a club is not a footballer — and because this one has a rule
 * that one does not: it prunes.
 *
 * Scoped by league like everything else, even though `TeamCode` survives a
 * season, so the season's club *set* stays recoverable after promotion and
 * relegation.
 */

export interface StoredTeams {
  rows: PlTeamRow[];
  /** When this table last synced — see the note in `elements.ts`. */
  syncedAt: Date | null;
}

/** Every stored club for the current season. Errors are the caller's to handle. */
export async function readTeams(): Promise<StoredTeams> {
  const leagueId = getLeagueId();

  const rows = await getDb()
    .select()
    .from(plTeams)
    .where(eq(plTeams.leagueId, leagueId));

  return { rows, syncedAt: latestSync(rows) };
}

/**
 * Write the season's clubs and drop any that are no longer in the payload.
 *
 * **The prune is not tidiness.** `isKnownTeamCode` consults this table as an
 * allowlist on behalf of `updateProfile`, and a Server Action is a public POST
 * endpoint. Upserting without pruning would leave a relegated club permanently
 * acceptable input — a validation rule that quietly gets more permissive every
 * August.
 *
 * Upsert first, delete second, never the reverse: the allowlist must not be
 * briefly empty, and `neon-http` has no transactions to hide a gap inside.
 * That ordering makes the delete a single statement against the rows the insert
 * just wrote, so the worst interleaving a concurrent reader can see is one
 * extra club, not none.
 */
export async function upsertTeams(rows: NewPlTeamRow[]): Promise<number> {
  // An empty payload means the fetch gave us nothing, not that the Premier
  // League folded. Pruning on it would empty the allowlist.
  if (rows.length === 0) return 0;

  const leagueId = getLeagueId();
  const db = getDb();

  await db
    .insert(plTeams)
    .values(rows)
    .onConflictDoUpdate({
      target: [plTeams.leagueId, plTeams.code],
      set: {
        name: sql.raw('excluded.name'),
        shortName: sql.raw('excluded.short_name'),
        syncedAt: new Date(),
      },
    });

  await db.delete(plTeams).where(
    and(
      eq(plTeams.leagueId, leagueId),
      notInArray(
        plTeams.code,
        rows.map((row) => row.code),
      ),
    ),
  );

  return rows.length;
}

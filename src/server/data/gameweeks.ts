import 'server-only';

import { and, asc, eq } from 'drizzle-orm';

import { getDb } from '@/server/db/client';
import { gameweekScores, gameweeks } from '@/server/db/schema';
import { getLeagueId } from '@/utils/fpl-api';
import { asLeagueEntryId } from '@/interfaces/fpl';
import type { GameweekPerformance } from '@/interfaces/players';

/**
 * Persistence for finished gameweeks.
 *
 * A finished gameweek never changes, so once it is stored we never ask the FPL
 * API about it again. This is what turns a cold standings computation from
 * ~344 upstream calls into one query plus whatever is genuinely new.
 *
 * **Everything here is scoped to the current league**, because a league id is
 * effectively a season id — see the schema. Nothing in this module reads or
 * writes across seasons, so last season's rows are inert rather than wrong.
 */

/** Gameweek numbers already finalised and stored for the current season. */
export async function getFinalisedGameweeks(): Promise<Set<number>> {
  const leagueId = getLeagueId();

  const rows = await getDb()
    .select({ gameweek: gameweeks.gameweek })
    .from(gameweeks)
    .where(eq(gameweeks.leagueId, leagueId));

  return new Set(rows.map((row) => row.gameweek));
}

/** Every stored score for the current season, shaped as a performance record. */
export async function getStoredPerformances(): Promise<GameweekPerformance[]> {
  const leagueId = getLeagueId();

  const rows = await getDb()
    .select()
    .from(gameweekScores)
    .where(eq(gameweekScores.leagueId, leagueId))
    .orderBy(asc(gameweekScores.gameweek), asc(gameweekScores.rank));

  // The column holds a league entry; the driver can only tell us it is an
  // integer, so this is where it gets its identity back.
  return rows.map((row) => ({
    event: row.gameweek,
    league_entry: asLeagueEntryId(row.leagueEntry),
    event_total: row.points,
    rank: row.rank,
    finished: true,
  }));
}

/**
 * Store a batch of freshly computed gameweeks and mark them finalised.
 *
 * Gameweeks that produced no performances are **not** recorded — an unscored
 * gameweek must stay absent so it is retried later, rather than being frozen
 * in as a set of zeros. That is the persistent version of the bug where every
 * manager tied on rank 1 and banked a win.
 *
 * {@link rejectUnfinalisable} makes that rule structural rather than a
 * convention the callers are trusted to keep, and **this is the last line of
 * defence**: the insert is `onConflictDoNothing`, so a bad row can never be
 * corrected by a later write. A gameweek stored wrongly stays wrong until
 * somebody deletes it by hand. Not hypothetical — GW1 of 2026/27 sat in
 * production for three days as eight managers on zero points and joint first,
 * paying every one of them a win and 20 F1 points.
 *
 * Returns the gameweeks actually written, which is not necessarily every one it
 * was handed.
 */
export async function storeFinalisedGameweeks(
  performances: GameweekPerformance[],
): Promise<number[]> {
  const storable = rejectUnfinalisable(performances);

  if (storable.length === 0) return [];

  const leagueId = getLeagueId();
  const stored = [...new Set(storable.map((p) => p.event))].sort(
    (a, b) => a - b,
  );
  const db = getDb();

  await db
    .insert(gameweekScores)
    .values(
      storable.map((performance) => ({
        leagueId,
        gameweek: performance.event,
        leagueEntry: performance.league_entry,
        points: performance.event_total,
        rank: performance.rank,
      })),
    )
    .onConflictDoNothing();

  await db
    .insert(gameweeks)
    .values(stored.map((gameweek) => ({ leagueId, gameweek })))
    .onConflictDoNothing();

  return stored;
}

/**
 * Drop any gameweek that has no business being frozen into the database.
 *
 * Two rules, both learned the expensive way:
 *
 * - **Provisional results are not facts.** `finished` is `false` while a
 *   gameweek is being played; those rows are for display only.
 * - **A gameweek where every manager scored 0 has not been played.** Eight
 *   managers field eleven footballers each and any one of them on the pitch for
 *   an hour banks two points, so a clean sweep of zeros is an unscored live
 *   feed wearing the shape of a scored one.
 *
 * It **filters and logs rather than throwing**, deliberately. The caller is
 * `computeSeasonUncached`, which every page render goes through, so a throw
 * here would take the whole site down to prevent a write. Refusing the write is
 * the entire job; the read carries on, the gameweek stays absent, and the next
 * run tries again — which is what should have happened in the first place.
 */
function rejectUnfinalisable(
  performances: GameweekPerformance[],
): GameweekPerformance[] {
  const events = new Set(performances.map((p) => p.event));
  const refused = new Map<number, string>();

  events.forEach((event) => {
    const week = performances.filter((p) => p.event === event);

    if (week.some((p) => !p.finished)) {
      refused.set(event, 'still provisional');
    } else if (week.every((p) => p.event_total === 0)) {
      refused.set(event, 'every manager scored 0');
    }
  });

  if (refused.size === 0) return performances;

  refused.forEach((reason, event) => {
    console.error(
      `[gameweeks] Refusing to finalise GW${event}: ${reason}. It stays absent and will be retried.`,
    );
  });

  return performances.filter((p) => !refused.has(p.event));
}

/** Remove a stored gameweek, so the next read refetches it from the API. */
export async function forgetGameweek(gameweek: number): Promise<void> {
  const leagueId = getLeagueId();
  const db = getDb();

  await db
    .delete(gameweekScores)
    .where(
      and(
        eq(gameweekScores.leagueId, leagueId),
        eq(gameweekScores.gameweek, gameweek),
      ),
    );

  await db
    .delete(gameweeks)
    .where(
      and(eq(gameweeks.leagueId, leagueId), eq(gameweeks.gameweek, gameweek)),
    );
}

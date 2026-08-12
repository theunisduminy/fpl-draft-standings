import 'server-only';

import { asc } from 'drizzle-orm';

import { getDb } from '@/server/db/client';
import { gameweekScores, gameweeks } from '@/server/db/schema';
import type { GameweekPerformance } from '@/interfaces/players';

/**
 * Persistence for finished gameweeks.
 *
 * A finished gameweek never changes, so once it is stored we never ask the FPL
 * API about it again. This is what turns a cold standings computation from
 * ~344 upstream calls into one query plus whatever is genuinely new.
 */

/** Gameweek numbers we have already finalised and stored. */
export async function getFinalisedGameweeks(): Promise<Set<number>> {
  const rows = await getDb()
    .select({ gameweek: gameweeks.gameweek })
    .from(gameweeks);

  return new Set(rows.map((row) => row.gameweek));
}

/** Every stored score, shaped as the app's existing performance record. */
export async function getStoredPerformances(): Promise<GameweekPerformance[]> {
  const rows = await getDb()
    .select()
    .from(gameweekScores)
    .orderBy(asc(gameweekScores.gameweek), asc(gameweekScores.rank));

  return rows.map((row) => ({
    event: row.gameweek,
    league_entry: row.leagueEntry,
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
 */
export async function storeFinalisedGameweeks(
  performances: GameweekPerformance[],
): Promise<number[]> {
  if (performances.length === 0) return [];

  const byGameweek = new Map<number, GameweekPerformance[]>();
  for (const performance of performances) {
    const bucket = byGameweek.get(performance.event) ?? [];
    bucket.push(performance);
    byGameweek.set(performance.event, bucket);
  }

  const stored = [...byGameweek.keys()].sort((a, b) => a - b);
  const db = getDb();

  await db
    .insert(gameweekScores)
    .values(
      performances.map((performance) => ({
        gameweek: performance.event,
        leagueEntry: performance.league_entry,
        points: performance.event_total,
        rank: performance.rank,
      })),
    )
    .onConflictDoNothing();

  await db
    .insert(gameweeks)
    .values(stored.map((gameweek) => ({ gameweek })))
    .onConflictDoNothing();

  return stored;
}

import {
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

/**
 * Application tables live in `public`. Identity lives in the `neon_auth`
 * schema, which Neon Auth owns and migrates — we read from it, never define it.
 */

/**
 * One row per (gameweek, league entry): what a manager actually scored and
 * where they placed that week.
 *
 * These are **facts**, deliberately. The F1 points table is *our policy* and
 * stays in code (`F1_POINTS`), so the season score is derived at read time.
 * Persisting `f1_score` would mean a backfill every time the table is tuned.
 *
 * Rows are only written once a gameweek is final (`leagues_updated` upstream),
 * at which point they never change — which is what makes caching them safe.
 */
export const gameweekScores = pgTable(
  'gameweek_scores',
  {
    gameweek: integer('gameweek').notNull(),
    /** `league_entries[].id` upstream — the league entry, not the `entry_id`. */
    leagueEntry: integer('league_entry').notNull(),
    points: integer('points').notNull(),
    rank: integer('rank').notNull(),
    recordedAt: timestamp('recorded_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.gameweek, table.leagueEntry] })],
);

/**
 * Which gameweeks have been finalised and stored.
 *
 * Separate from `gameweek_scores` so "we hold no rows for GW7" is
 * distinguishable from "GW7 is finished and genuinely had no scores" — the
 * distinction that the empty-`elements` bug turned on.
 */
export const gameweeks = pgTable('gameweeks', {
  gameweek: integer('gameweek').primaryKey(),
  finalisedAt: timestamp('finalised_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/**
 * Links a Neon Auth user to their manager in the league.
 *
 * `userId` references `neon_auth.user.id`, but **without a foreign key**.
 * Neon Auth is beta and manages that schema's migrations itself; a hard
 * cross-schema constraint would make its rebuilds our problem. With eight
 * known members the integrity cost of leaving it off is nil.
 */
export const profiles = pgTable('profiles', {
  userId: uuid('user_id').primaryKey(),
  /** `league_entries[].id` upstream. One profile per manager. */
  leagueEntry: integer('league_entry').notNull().unique(),
  displayName: text('display_name'),
  bio: text('bio'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type GameweekScoreRow = typeof gameweekScores.$inferSelect;
export type NewGameweekScoreRow = typeof gameweekScores.$inferInsert;
export type ProfileRow = typeof profiles.$inferSelect;

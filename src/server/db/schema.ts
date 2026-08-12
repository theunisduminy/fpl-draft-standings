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
 * Who is in the league, and which manager each of them is.
 *
 * This is **curated, not claimed**. The league is eight known people, so the
 * mapping is admin-seeded rather than self-service: nobody picks which manager
 * they are, which removes the whole class of shenanigans that a claim flow
 * invites (grabbing someone else's record, swapping after a bad week).
 *
 * It is the single source of truth for two questions that used to have
 * separate answers:
 *
 *   - **May this person sign in?** — is their email in this table?
 *   - **Which manager are they?** — `league_entry`.
 *
 * Adding someone to the league is therefore one row, not an env var edit and
 * a redeploy.
 */
export const leagueMembers = pgTable('league_members', {
  /** Lowercased on the way in — email casing is not meaningful. */
  email: text('email').primaryKey(),
  /** `league_entries[].id` upstream. One member per manager, and vice versa. */
  leagueEntry: integer('league_entry').notNull().unique(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/**
 * The parts of a profile its owner controls.
 *
 * Deliberately holds no `league_entry`: which manager someone is comes from
 * `league_members`, keyed by the email on their session. Storing it here too
 * would be a second, forgeable copy of the same fact.
 *
 * `userId` references `neon_auth.user.id`, but **without a foreign key**.
 * Neon Auth is beta and manages that schema's migrations itself; a hard
 * cross-schema constraint would make its rebuilds our problem. With eight
 * known members the integrity cost of leaving it off is nil.
 */
export const profiles = pgTable('profiles', {
  userId: uuid('user_id').primaryKey(),
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
export type LeagueMemberRow = typeof leagueMembers.$inferSelect;
export type ProfileRow = typeof profiles.$inferSelect;

import {
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
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
    /**
     * The season, identified by its league. Without it, next season's
     * gameweek 1 collides with this season's and the cache silently serves
     * the wrong year's scores.
     */
    leagueId: integer('league_id').notNull(),
    gameweek: integer('gameweek').notNull(),
    /** `league_entries[].id` upstream — the league entry, not the `entry_id`. */
    leagueEntry: integer('league_entry').notNull(),
    points: integer('points').notNull(),
    rank: integer('rank').notNull(),
    recordedAt: timestamp('recorded_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    primaryKey({
      columns: [table.leagueId, table.gameweek, table.leagueEntry],
    }),
  ],
);

/**
 * Which gameweeks have been finalised and stored.
 *
 * Separate from `gameweek_scores` so "we hold no rows for GW7" is
 * distinguishable from "GW7 is finished and genuinely had no scores" — the
 * distinction that the empty-`elements` bug turned on.
 */
export const gameweeks = pgTable(
  'gameweeks',
  {
    leagueId: integer('league_id').notNull(),
    gameweek: integer('gameweek').notNull(),
    finalisedAt: timestamp('finalised_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.leagueId, table.gameweek] })],
);

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
export const leagueMembers = pgTable(
  'league_members',
  {
    /**
     * The season, identified by its league. **Both FPL identifiers are
     * season-scoped:** a renewed league gets a new id, and its
     * `league_entries[].id` and `entry_id` values are minted fresh with it —
     * most of ours were issued in one block the day the league formed, and a
     * late joiner's sit well outside it (40460, against 39836–39842). So the
     * ids are not even contiguous within a season, let alone stable across one.
     *
     * Without this column a mapping would survive into next season pointing at
     * a number that either no longer exists or, worse, now belongs to somebody
     * else — wrong, while still satisfying every constraint.
     */
    leagueId: integer('league_id').notNull(),
    /** Lowercased on the way in — email casing is not meaningful. */
    email: text('email').notNull(),
    /** `league_entries[].id` upstream — the league entry, not the `entry_id`. */
    leagueEntry: integer('league_entry').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.leagueId, table.email] }),
    // One manager per person, per season — in both directions.
    unique().on(table.leagueId, table.leagueEntry),
  ],
);

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
  /**
   * `teams[].code` from the classic bootstrap — **not** `teams[].id`.
   *
   * The one FPL identifier that survives a season rollover. `id` is 1–20 handed
   * out alphabetically each August, so storing it would repoint every row the
   * first time a promoted club sorted differently. See `TeamCode` in
   * `src/interfaces/fpl.ts`.
   *
   * Nullable: unlike a display name and a bio, this is not part of compulsory
   * onboarding.
   */
  favouriteTeam: integer('favourite_team'),
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

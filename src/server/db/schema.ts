import {
  boolean,
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
  /**
   * `teams[].code` from the classic bootstrap — **not** `teams[].id`.
   *
   * The one FPL identifier that survives a season rollover. `id` is 1–20 handed
   * out alphabetically each August, so storing it would repoint every row the
   * first time a promoted club sorted differently. See `TeamCode` in
   * `src/interfaces/fpl.ts`.
   *
   * Compulsory, alongside the display name: `isProfileComplete` requires both.
   * It is shown on the profile, not on the standings.
   *
   * Still **nullable in the database**, and deliberately. Completeness is a
   * rule, and the app decides its rules in code — a `NOT NULL` migration would
   * have had to invent a club for every member who signed up before it, and
   * there is no right answer to invent. Those rows stay null, the gate reads
   * them as incomplete, and their owners pick a club once.
   */
  favouriteTeam: integer('favourite_team'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/**
 * The footballers, flattened out of the draft bootstrap.
 *
 * An **accelerator, never a source of truth.** Every reader that consults this
 * table can answer without it — see `getElementLookup`, which falls back to the
 * bootstrap whenever the table is empty, stale, incomplete or unreachable. A
 * failed sync makes a page slower; it must never make one wrong.
 *
 * The point is proportion. Resolving ~120 owned element ids into names,
 * positions and clubs costs an 850 KB download of all 581 elements plus their
 * full statistical payload, because there is no way to ask upstream for a
 * subset. This holds the handful of fields anyone actually reads.
 *
 * **Populated from the draft bootstrap and resolvable only against draft
 * element ids.** The draft and classic APIs disagree on about 21 of their 581
 * elements, and mixing them is silent — see `ElementId` in
 * `src/interfaces/fpl.ts`.
 */
export const draftElements = pgTable(
  'draft_elements',
  {
    /**
     * The season, identified by its league. `element_id` below is re-minted
     * every August, so without this column last season's rows would not merely
     * be stale — they would answer, with another footballer entirely.
     */
    leagueId: integer('league_id').notNull(),
    /**
     * `elements[].id` from the **draft** bootstrap. Season-scoped, which is
     * exactly why it is only ever a key alongside `league_id`.
     *
     * It is the key rather than `code` because ownership hands the reader
     * element ids: `element_status[].element` is an id, so keying by code
     * would force every lookup through a second translation.
     */
    elementId: integer('element_id').notNull(),
    /**
     * `elements[].code` — the season-stable identity, and what a headshot URL
     * is built from (`resources.premierleague.com/.../p{code}.png`). Stored as
     * an attribute rather than a key: it is what outlives the season, while
     * `element_id` is what addresses the row within one.
     */
    code: integer('code').notNull(),
    /** `web_name` — the only name rendered today. */
    webName: text('web_name').notNull(),
    /** `GKP` | `DEF` | `MID` | `FWD` | `UNK`, resolved from `element_type`. */
    position: text('position').notNull(),
    /**
     * `teams[].code` for the club, **not** `teams[].id`. Joins to
     * `pl_teams.code`, which is the one identifier both bootstraps agree on
     * and the only one that survives August.
     */
    teamCode: integer('team_code').notNull(),
    /**
     * Season total. Stale between syncs by design — see KTD4 in the plan.
     *
     * **Pre-season this is the _previous_ season's total.** Upstream carries it
     * until shortly before GW1 and resets it then, so between the draft and the
     * first kick-off this column reads 239 for Haaland while no gameweek has
     * been played. That is upstream's number, not a sync bug, and it corrects
     * itself without intervention. `events.current === null` in the bootstrap
     * is how you tell the two apart.
     */
    totalPoints: integer('total_points').notNull(),
    /**
     * When this row was last written. Read rather than assumed: the staleness
     * predicate compares it against one budget, and a reader that trusted the
     * table blindly would serve a transferred player's old club forever.
     */
    syncedAt: timestamp('synced_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.leagueId, table.elementId] })],
);

/**
 * The 20 Premier League clubs.
 *
 * Keyed by `code` rather than `id` because, unlike a footballer, a club is only
 * ever looked up by code: `profiles.favourite_team` stores one, and a crest URL
 * is built from one. There is no id-shaped question to answer.
 *
 * Still scoped by league, even though `TeamCode` is season-stable, so the
 * season's club *set* stays recoverable. One global club table could not answer
 * "which 20 were in the league that year" after promotion and relegation.
 */
export const plTeams = pgTable(
  'pl_teams',
  {
    leagueId: integer('league_id').notNull(),
    /** `teams[].code` — stable across seasons. See `TeamCode`. */
    code: integer('code').notNull(),
    name: text('name').notNull(),
    shortName: text('short_name').notNull(),
    syncedAt: timestamp('synced_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.leagueId, table.code] })],
);

/**
 * Who owned whom when each gameweek settled.
 *
 * **Immutable facts, written once.** A snapshot row records what
 * `element-status` said in the cron run that finalised its gameweek, and
 * first write wins (`onConflictDoNothing`): re-reading present ownership
 * against an old gameweek would misattribute, so only newly finalised
 * gameweeks are ever snapshotted and a stored row is never re-synced.
 * Gameweeks finalised before this feature launched stay absent rather than
 * reconstructed — `element-status` only reflects the present.
 *
 * Keyed by the stable `element_code`, never the season-minted `element_id`,
 * so a row still names the right footballer next August. The scoped ids ride
 * along as audit columns: `element_id` is what `element-status` actually
 * handed over, and the owner is stored twice — the `entry_id` upstream gave
 * (`owner_entry`, null for a free agent) plus the `league_entry` resolved
 * against the same run's entries list (`owner_league_entry`) — so a past
 * owner answers without any upstream call, entries list included.
 */
export const ownershipSnapshots = pgTable(
  'ownership_snapshots',
  {
    /**
     * The season, identified by its league. Both the element id and the
     * owner ids below are re-minted every August — see `league_members` —
     * so without this column last season's rows would answer this season's
     * questions, with other footballers and other managers.
     */
    leagueId: integer('league_id').notNull(),
    gameweek: integer('gameweek').notNull(),
    /** `elements[].code` — the season-stable identity. See `ElementCode`. */
    elementCode: integer('element_code').notNull(),
    /**
     * `element_status[].element` from the **draft** API. Season-scoped, which
     * is exactly why it sits beside `league_id` and never keys the row.
     */
    elementId: integer('element_id').notNull(),
    /**
     * `element_status[].owner` — an `entry_id`, **not** a `league_entry`.
     * Null means the element was a free agent, which is a fact, not a gap.
     */
    ownerEntry: integer('owner_entry'),
    /**
     * The owner's `league_entries[].id`, resolved against the same run's
     * league details. Null for a free agent, and for an owner the entries
     * list did not name — where the row keeps `owner_entry` and resolves
     * nothing rather than dropping the fact.
     */
    ownerLeagueEntry: integer('owner_league_entry'),
    recordedAt: timestamp('recorded_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    primaryKey({
      columns: [table.leagueId, table.gameweek, table.elementCode],
    }),
  ],
);

/**
 * The frozen draft record: every pick of every draft, as chosen.
 *
 * **A record, never re-synced.** Seeded once per draft id from the choices
 * endpoint while the table holds no rows for that draft; a populated table
 * is never written again, and an empty choices response against one keeps
 * the table — that is the point, the board renders from here after upstream
 * wipes the endpoint. Keyed by the upstream draft id alongside the draft
 * `event`, with `league_id` keeping both season-scoped values safe.
 *
 * Joins key on stable `element_code`, with the season-scoped `element_id`
 * and `entry` retained as audit columns, following the `draft_elements`
 * precedent of carrying both.
 */
export const draftPicks = pgTable(
  'draft_picks',
  {
    /** The season, identified by its league. See `ownershipSnapshots`. */
    leagueId: integer('league_id').notNull(),
    /** `drafts[].id` upstream — which draft this pick belongs to. */
    draftId: integer('draft_id').notNull(),
    /** `choices[].index` — the pick's position in its draft. */
    draftIndex: integer('draft_index').notNull(),
    /** `drafts[].event` — the gameweek the draft belongs to. */
    draftEvent: integer('draft_event').notNull(),
    round: integer('round').notNull(),
    pick: integer('pick').notNull(),
    /** `choices[].entry` — an `entry_id`, not a `league_entry`. */
    entry: integer('entry').notNull(),
    /** `choices[].element` from the draft API. Season-scoped; audit only. */
    elementId: integer('element_id').notNull(),
    /** `elements[].code` — the season-stable identity. The join key. */
    elementCode: integer('element_code').notNull(),
    wasAuto: boolean('was_auto').notNull(),
    /** Null when upstream sends null; stored as-is for the later views. */
    secondsToPick: integer('seconds_to_pick'),
  },
  (table) => [
    primaryKey({
      columns: [table.leagueId, table.draftId, table.draftIndex],
    }),
  ],
);

export type GameweekScoreRow = typeof gameweekScores.$inferSelect;
export type NewGameweekScoreRow = typeof gameweekScores.$inferInsert;

/**
 * Gameweeks held as finalisation candidates, waiting for a second agreeing read.
 *
 * Ephemeral proposal state, not facts: a row here claims only that one read
 * found the gameweek finished, and it is deleted on confirm or drop — never
 * promoted in place. It holds no scores and no derived values, so it stays on
 * the persistence line's safe side.
 *
 * Why it exists: GW1 of 2026/27 was stored from a single agreeing-but-wrong
 * read (unscored live feed shaped like a scored one) and, the insert being
 * `onConflictDoNothing`, stayed wrong for three days. A candidate is written
 * only after two consecutive reads agree on identical content across a cron
 * boundary, which instance memory cannot prove — hence a row, keyed like every
 * other gameweek fact by (league_id, gameweek).
 */
export const finalisationCandidates = pgTable(
  'finalisation_candidates',
  {
    leagueId: integer('league_id').notNull(),
    gameweek: integer('gameweek').notNull(),
    /**
     * Stable serialisation of the scored content the first read saw. The
     * confirming read must reproduce it exactly; a differing payload resets
     * the row instead of confirming.
     */
    fingerprint: text('fingerprint').notNull(),
    /** When the candidate was first recorded. The hold interval counts from here. */
    firstSeen: timestamp('first_seen', { withTimezone: true })
      .notNull()
      .defaultNow(),
    /** When the candidate was last re-observed, so stale rows stay visible. */
    lastChecked: timestamp('last_checked', { withTimezone: true })
      .notNull()
      .defaultNow(),
    /**
     * Why the write is currently refused, truncated to 500 characters. Null
     * while the candidate is merely held for its second read.
     */
    blockReason: text('block_reason'),
  },
  (table) => [primaryKey({ columns: [table.leagueId, table.gameweek] })],
);

export type FinalisationCandidateRow =
  typeof finalisationCandidates.$inferSelect;
export type NewFinalisationCandidateRow =
  typeof finalisationCandidates.$inferInsert;
export type LeagueMemberRow = typeof leagueMembers.$inferSelect;
export type ProfileRow = typeof profiles.$inferSelect;
export type DraftElementRow = typeof draftElements.$inferSelect;
export type NewDraftElementRow = typeof draftElements.$inferInsert;
export type PlTeamRow = typeof plTeams.$inferSelect;
export type NewPlTeamRow = typeof plTeams.$inferInsert;
export type OwnershipSnapshotRow = typeof ownershipSnapshots.$inferSelect;
export type NewOwnershipSnapshotRow = typeof ownershipSnapshots.$inferInsert;
export type DraftPickRow = typeof draftPicks.$inferSelect;
export type NewDraftPickRow = typeof draftPicks.$inferInsert;

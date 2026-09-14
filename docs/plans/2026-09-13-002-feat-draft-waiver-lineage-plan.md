---
title: Draft to waiver lineage
type: feat
status: active
date: 2026-09-13
---

# Draft to waiver lineage

## Summary

Persist two small immutable tables, weekly ownership snapshots and the frozen draft record, so past owners and the full draft board answer from Postgres instead of upstream. All views join at render time on stable codes, and a pure tested selector attributes every gameweek to the correct draft across the GW24 re-draft.

---

## Problem Frame

The squads page knows who owns whom right now, from `element-status` joined to draft choices in memory, but it remembers nothing. Once a waiver moves a player, the previous owner is gone, and if upstream ever wipes draft choices the draft provenance colours go with it. The league argues about draft steals and waiver pickups with no record to settle it.

---

## Assumptions

_This plan was authored without synchronous user confirmation. The items below are agent inferences that fill gaps in the input, un-validated bets that should be reviewed before implementation proceeds._

- `docs/brainstorms/` does not exist in this repo, so there is no origin requirements doc and this plan carries both the what and the how.
- The choices endpoint is league scoped, not draft scoped, so rows fetched before the GW24 draft are attributed to the August draft, and post re-draft endpoint behaviour is unverified until February.
- Ownership snapshots store both the season scoped ids (`element_id`, owner `entry_id`) and the stable codes plus the resolved `league_entry`, on the precedent of `gameweek_scores` storing `league_entry` under a `league_id` scope.
- Draft picks are keyed by upstream `drafts[].id` alongside the draft `event` number, with `league_id` keeping both season scoped values safe.
- Backfilling ownership for gameweeks finalised before this feature launches is impossible, because `element-status` only reflects the present, so those gameweeks stay absent rather than reconstructed.
- Three hourly cron cadence is frequent enough that first write wins snapshots land within hours of finalisation, which is close enough for waiver attribution.

---

## Requirements

- R1. Any past gameweek's owner for any footballer is answerable from the database without a new upstream call.
- R2. The full 15 round draft board renders from the database after upstream wipes the choices endpoint.
- R3. Post February gameweeks attribute to the GW24 draft and pre February gameweeks attribute to the August draft.
- R4. No derived values are persisted and no provisional data is stored.
- R5. Reads join at render time on stable codes, with the database first and upstream as fallback, and never a new `/api/*` route.
- R6. All writes are owned by the existing cron sync job, scoped by `league_id`, and production migrates by hand.

---

## Scope Boundaries

- Trade fairness scoring algorithms.
- Waiver recommendation engine.
- Any change to F1 scoring, which stays in `src/utils/scoring.ts`.
- Multi league support; everything is scoped to `FPL_LEAGUE_ID`.
- The decision ledger views themselves (draft steal, best waiver, worst trade, ownership streaks); this plan persists the facts that enable them and wires the draft board read path only.
- A trades table; `/api/draft/league/{leagueId}/trades` is probed and currently returns `{ trades: [] }`, so there is nothing worth persisting yet.

### Deferred to Follow-Up Work

- Ledger views and streak surfaces: a later plan once both tables hold a season of facts.
- Post re-draft verification of the choices endpoint shape in February 2027: a calendar reminder, not code.
- A trades persistence unit if the trades endpoint ever returns rows: separate migration and plan.

---

## Context & Research

### Relevant Code and Patterns

- `src/utils/squads.ts` already calls `fplApi.elementStatus()` and `fplApi.draftChoices()` and joins choices for provenance colour only (`drafted`, `acquired`, `free-agent`). This plan persists what that module currently holds in memory.
- `src/utils/fpl-api.ts` already has `elementStatus` and `draftChoices` builders, so no new gateway code is needed. There is no trades builder, deliberately, per the non-goal above.
- `src/interfaces/fpl.ts` types `DraftChoice` (`element`, `entry` as `EntryId`, `round`, `pick`, `index`, `was_auto`, `seconds_to_pick`) and `ElementStatus` (`owner` as `EntryId | null`), but `LeagueDetails` is trimmed to `league_entries` plus `standings` and drops the `league.drafts[]` list this plan needs.
- `agents/API.md` documents the `drafts[]` list with two entries (id 8911 at event 1, id 32922 at event 24) and warns against assuming one element or reading `drafts[0]`.
- `src/app/api/cron/revalidate/route.ts` is the write owner template: bearer `CRON_SECRET`, reference sync plus `computeSeasonUncached()` finalisation in parallel, then invalidate, clear, and warm. The `TAGS` list must register any new `cachedRead` tag in the same change.
- `src/server/data/gameweeks.ts` sets the persistence precedent: `storeFinalisedGameweeks` filters provisional and all zero gameweeks, writes `onConflictDoNothing`, and returns the gameweeks actually written.
- `src/utils/season-state.ts` with `src/utils/season-state.test.ts` is the pure plus tested pattern to copy: `deriveSeasonState()` is the only place that decides finalisation, and the test pins the per date versus per gameweek trap with named fixtures.
- `src/utils/reference-mapping.ts` with `src/utils/reference-mapping.test.ts` is the pure mapping pattern: payload to rows, staleness and completeness rules, all tested without database or fetch.
- `src/server/data/elements.ts` shows the thin DAL shape (`readElements`, `upsertElements` with `onConflictDoUpdate`) and league scoping via `getLeagueId()`.
- `src/server/db/schema.ts` primary key convention is `(league_id, ...)` on every table, `draft_elements` stores both season scoped `element_id` and stable `code`, and `pl_teams` is keyed by stable `code`.
- `src/utils/draft-elements.ts` shows the table first with bootstrap fallback shape plus `ensureCovers` completeness, which the draft board read path inverts (database is the record here, upstream is the fallback only while the table is empty).
- `src/utils/gameweek-data.ts` computes through `computeSeasonUncached()`, which is what the cron finalisation step calls directly so a warm process map cannot report success without writing.

### Institutional Learnings

- No `docs/solutions/` directory exists in this repo, so there are no prior institutional learnings to cite.

### External References

- No external references beyond the upstream behaviours already captured in `agents/API.md`.

---

## Key Technical Decisions

- Two tables, both immutable facts: `ownership_snapshots` keyed by `(league_id, gameweek, element_code)` and `draft_picks` keyed by `(league_id, draft_id, draft_index)`.
- Joins key on stable `ElementCode`, never season minted `ElementId`, with the scoped ids retained as audit columns alongside, following the `draft_elements` precedent of carrying both.
- Snapshot owner stores the `EntryId` from `element-status` plus the `LeagueEntryId` resolved against the same run's league details, so R1 answers without any upstream call including the entries list.
- A pure selector `draftForGameweek(drafts, gameweek)` returns the draft with the greatest `event` at or below the gameweek, in a new pure module `src/utils/draft-lineage.ts` with a colocated test in the `season-state.test.ts` style.
- Snapshot writes are insert only (`onConflictDoNothing`, first write wins) and cover exactly the gameweeks the same cron run newly finalised, never a backfill of older gameweeks whose ownership is unrecoverable.
- Draft seed is one shot per draft id with a cron guard: an empty table for a started draft seeds from choices, a populated table never re-syncs, and an empty choices response against a populated table keeps the table (that is R2 working).
- The squads draft provenance read goes database first with upstream choices as fallback only while the table is empty, which is the deliberate inverse of the reference table trust direction, because draft picks are a record rather than an accelerator.
- No new `/api/*` route and no new page in this plan; the draft board renders through the existing squads read path and Server Components calling the DAL.

---

## Open Questions

### Resolved During Planning

- Where do `drafts[]` come from: the existing league details response, requiring only a type extension, not a new endpoint.
- Whether a trades builder is needed: no, the endpoint returns empty and trades are a non-goal.
- Whether ownership snapshots need a staleness budget like reference tables: no, they are immutable facts written once, closer to `gameweek_scores` than to `draft_elements`.
- Whether to snapshot every finalised gameweek each run: no, only newly finalised ones, because re-reading present ownership against old gameweeks would misattribute.
- Next migration number: `drizzle/0006_*`, since `drizzle/` holds applied migrations through `0005_drop_profile_bio.sql`, generated via `pnpm db:generate` and never hand edited beyond naming.

### Deferred to Implementation

- Exact snapshot column for the resolved manager if `league_entries` mapping shifts mid run: why deferred, the entries list is read in the same run so any choice is consistent, and the implementer picks the narrower of storing `league_entry` versus re-resolving live.
- Whether `seconds_to_pick` arrives null often enough to need display handling: why deferred, it is stored nullable and rendered later, so no read path decision blocks this plan.
- Post re-draft choices endpoint behaviour (per draft filtering, combined list, or wipe): why deferred, it is unobservable until the February 2027 draft exists, and the seed plus guard design is safe under all three.

---

## Implementation Units

### U1. Draft selector and lineage types

**Goal:** The pure, tested vocabulary the rest of the plan builds on.

**Requirements:** R3, R4

**Dependencies:** None

**Files:**

- Create: `src/utils/draft-lineage.ts`
- Modify: `src/interfaces/fpl.ts`
- Test: `src/utils/draft-lineage.test.ts`

**Approach:**

- Add a minimal `DraftInfo` type (`id`, `event`, `draft_started`, `draft_completed`) and extend `LeagueDetails` with `league: { drafts: DraftInfo[] }`, keeping the existing trimmed shape otherwise untouched.
- Implement `draftForGameweek(drafts, gameweek)` as a pure function returning the draft with the greatest `event` at or below the gameweek, or null when none qualifies.
- Add pure row mapping helpers (choice plus resolved codes to draft pick facts; status plus resolved owner to snapshot facts) so U3 and U4 contain no inline rules.

**Patterns to follow:**

- `src/utils/season-state.ts` for pure module shape and comment led reasoning.
- `src/utils/season-state.test.ts` for named fixture payloads and trap pinning tests.

**Test scenarios:**

- Happy path: drafts at events 1 and 24, gameweek 10 returns the August draft id, gameweek 24 and gameweek 30 return the GW24 draft id.
- Edge case: gameweek 0 and an empty drafts list return null rather than defaulting to the first draft.
- Edge case: unsorted drafts input still resolves by greatest event at or below the gameweek.
- Edge case: a gameweek between two draft events attributes to the earlier draft.
- Error path: a gameweek below the earliest draft event returns null, and callers treat that as unattributable rather than throwing.

**Verification:**

- `pnpm test src/utils/draft-lineage.test.ts` passes, plus `pnpm lint` and `pnpm typecheck` clean.

---

### U2. Lineage migration and schema

**Goal:** The two immutable tables exist with law compliant keys.

**Requirements:** R4, R6

**Dependencies:** None

**Files:**

- Create: `drizzle/0006_draft_waiver_lineage.sql` (via `pnpm db:generate`, exact suffix may vary)
- Modify: `src/server/db/schema.ts`
- Test: `src/utils/draft-lineage.test.ts` (mapping helpers covering both tables, from U1)

**Approach:**

- Define `ownershipSnapshots` with primary key `(leagueId, gameweek, elementCode)` carrying `elementId`, `ownerEntry` (nullable `EntryId`, null for free agents), `ownerLeagueEntry` (nullable), and `recordedAt` default now.
- Define `draftPicks` with primary key `(leagueId, draftId, draftIndex)` carrying `draftEvent`, `round`, `pick`, `entry`, `elementId`, `elementCode`, `wasAuto`, `secondsToPick` (nullable).
- Generate the migration from the schema, apply to the sandbox branch only, and leave production for the by hand step.

**Patterns to follow:**

- `src/server/db/schema.ts` existing tables for key style, league scoping comments, and stable code versus season id documentation.
- `drizzle/0004_reference_tables.sql` for migration shape.

**Test scenarios:**

- Happy path: mapping helper turns one `DraftChoice` plus resolved codes into a draft pick fact with round, pick, index, `was_auto`, and `seconds_to_pick` preserved.
- Happy path: mapping helper turns one owned `ElementStatus` plus resolved owner into a snapshot fact, and one unowned status into a snapshot fact with null owner.
- Edge case: a choice whose element has no resolvable code is dropped from the seed set rather than stored with a null code.
- Integration: generated SQL creates both tables with the intended primary keys on the sandbox branch.

**Verification:**

- `pnpm db:generate` output reviewed, sandbox migration applies cleanly, `pnpm typecheck` passes.

---

### U3. Lineage DAL reads and writes

**Goal:** A thin, league scoped data module owning both tables.

**Requirements:** R1, R2, R4

**Dependencies:** U1, U2

**Files:**

- Create: `src/server/data/lineage.ts`
- Test: `src/utils/draft-lineage.test.ts` (pure mapping already covered in U1; DAL behaviour verified via assay below, since no database test harness exists)

**Approach:**

- Provide `readDraftPicks()` returning all picks for the current league ordered by draft event then index, and `readOwnershipSnapshot(gameweek)` plus `readOwnershipHistory(elementCode)` for the ledger future.
- Provide `seedDraftPicks(rows)` as insert only with `onConflictDoNothing`, returning the count actually written, and `storeOwnershipSnapshots(gameweek, rows)` with the same insert only semantics.
- Refuse provisional input the way `storeFinalisedGameweeks` does: empty row sets write nothing and log, and every query filters on `getLeagueId()`.

**Patterns to follow:**

- `src/server/data/gameweeks.ts` for scoping, insert only writes, and filter plus log refusal.
- `src/server/data/elements.ts` for thin DAL with meaning kept in the pure module.

**Test scenarios:**

- Happy path: seeding 120 August picks then re-seeding the same payload writes zero new rows and returns success.
- Happy path: storing a 581 row snapshot for a newly finalised gameweek, then re-storing, keeps the first write (first write wins).
- Edge case: an empty snapshot row set writes nothing and logs rather than marking anything finalised.
- Error path: a database failure propagates rather than returning an empty set that reads as never synced.

**Verification:**

- Manual assay against the sandbox branch: seed, re-seed idempotence, and snapshot round trip read back the expected row counts.

---

### U4. Cron lineage sync step

**Goal:** The robot owns all writes on the existing three hourly schedule.

**Requirements:** R1, R2, R4, R6

**Dependencies:** U1, U3

**Files:**

- Modify: `src/app/api/cron/revalidate/route.ts`
- Modify: `agents/API.md`

**Approach:**

- After the existing parallel reference plus finalise steps, run a sequential `lineage` step receiving the gameweeks the finalise step newly stored, and snapshot exactly those gameweeks from a fresh `element-status` read with code resolution through the element lookup.
- Seed draft picks when a started draft id in `drafts[]` has no rows yet: fetch choices once, resolve codes, attribute rows to that draft id, and insert. Never re-sync a populated draft, and never delete on an empty choices response.
- Extend `finaliseGameweeks` internally to return both its display detail and the newly stored gameweek list, keeping the `StepResult` outward shape unchanged.
- Document the choices seeding and guard behaviour in `agents/API.md` beside the existing draft choices section.

**Patterns to follow:**

- `src/app/api/cron/revalidate/route.ts` existing `step` wrapper, per step outcomes, and the `computeSeasonUncached` direct call that bypasses the warm process map.
- `src/utils/squads.ts` `fetchDraftChoices` lenient handling (missing choices are not an error) for the seed read.

**Test scenarios:**

- Happy path: a run that newly finalises GW5 stores one 581 row snapshot for GW5 only, leaving GW1 to GW4 untouched.
- Happy path: first run with an empty picks table seeds 120 August rows; the next run writes nothing.
- Edge case: choices endpoint returns empty against a populated picks table, and the table is kept (R2 working).
- Edge case: a run that finalises nothing stores no snapshots and reports the step ok with zero gameweeks.
- Error path: a failed `element-status` read fails only the lineage step while reference and finalise outcomes still report honestly.

**Verification:**

- Authenticated local cron invocation against the sandbox branch shows the expected per step outcomes, and a replayed run reports idempotent no-ops.

---

### U5. Database first draft provenance reads

**Goal:** R2 holds on the read path: the draft board serves from Postgres with upstream only as pre-seed fallback.

**Requirements:** R2, R5

**Dependencies:** U3, U4

**Files:**

- Modify: `src/utils/squads.ts`
- Modify: `src/app/api/cron/revalidate/route.ts` (register any new `cachedRead` tag in `TAGS`)
- Test: `src/utils/draft-lineage.test.ts` (pure join from stored picks to the existing `Acquisition` union)

**Approach:**

- Read stored draft picks through the U3 DAL first; use them for the `choiceByElement` join when they cover the requested elements, and fall back to live choices only while the table is empty.
- Keep the `Acquisition` union (`drafted`, `acquired`, `free-agent`) and its join semantics exactly as today so no component changes in this plan.
- If the provenance join introduces its own `cachedRead`, register its tag in the cron `TAGS` list in the same change, per the standing invariant.

**Patterns to follow:**

- `src/utils/draft-elements.ts` fallback shape, inverted in trust direction and logged the same way through `reportUnusableReference` style messaging.
- `src/utils/squads.ts` existing `toSquadPlayer` join, unchanged in behaviour.

**Test scenarios:**

- Happy path: stored picks for all 120 drafted elements produce identical `Acquisition` values to the live choices join for a fixed fixture.
- Happy path: with a populated table and upstream choices unreachable, squads still render full provenance.
- Edge case: with an empty table and upstream reachable, squads render from live choices exactly as today.
- Edge case: stored picks missing one owned element fall the provenance read back to live choices rather than rendering one `free-agent` hole.
- Integration: cron warm covers the squads cache tag and a revalidate cycle keeps provenance served from the database.

**Verification:**

- Squads page renders identical provenance before and after seeding on the sandbox branch, and renders from the database with upstream blocked.

---

## System-Wide Impact

- **Interaction graph:** the cron route gains one sequential step after finalisation; squads reads gain one DAL read before the existing upstream calls; no page, component, or cache topology changes.
- **Error propagation:** lineage failures stay inside their own step result or fallback log, following the existing convention that a database or upstream blip costs latency, never correctness, and never a 500 on a page.
- **State lifecycle risks:** first write wins on both tables means a wedged early snapshot cannot be corrected by a later run; the mitigation is snapshotting only newly finalised gameweeks plus the `scripts/forget-gameweek.mjs` style manual delete escape hatch if a bad snapshot ever lands.
- **API surface parity:** no new routes and no new gateway builders; the only contract change is the `LeagueDetails` type gaining the `league.drafts` list it previously dropped.
- **Integration coverage:** unit tests pin the selector and mappings, but only the sandbox cron assay proves the seed guard, the snapshot timing, and the provenance fallback together.
- **Unchanged invariants:** F1 scoring, finalisation authority in `deriveSeasonState()`, reference table trust direction, branded id discipline, and the Server Component read pattern all stand untouched.

---

## Risks & Dependencies

| Risk                                                                                             | Mitigation                                                                                                   |
| ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------ |
| Element-status reflects the present, so a late snapshot misattributes ownership for its gameweek | Snapshot only newly finalised gameweeks in the same run, first write wins, and accept absence for older ones |
| Choices endpoint shape after the GW24 re-draft is unverified (per draft, combined, or wiped)     | Seed now against the single started draft, guard on draft id, and schedule February verification             |
| Owner `EntryId` to manager resolution depends on the live entries list at snapshot time          | Store the resolved `league_entry` alongside the `entry_id` so R1 never needs upstream                        |
| Snapshot volume (~581 rows per week, ~22k per season) surprises on the Neon branch               | Narrow rows and one indexed key; confirm storage after the first sandbox snapshot                            |
| A populated picks table masks a genuinely new draft if the guard keys wrongly                    | Guard keys on upstream draft id, not on row count, so a new started draft always seeds                       |
| Pre-launch finalised gameweeks have no ownership history and never will                          | Document the gap openly; absence is honest, reconstruction would violate R4                                  |

---

## Documentation / Operational Notes

- Update `agents/API.md` draft choices section with the seed plus guard behaviour in the same change that touches the cron route.
- Update `agents/ARCHITECTURE.md` persistence line table with the two new tables as immutable facts rows, and the folder map if `src/server/data/lineage.ts` and `src/utils/draft-lineage.ts` warrant entries.
- Production migration runs by hand via `pnpm db:migrate:prod` after sandbox verification, reading the target line before trusting the tick, per the established warning.
- Sandbox refresh for local work goes through an authenticated local cron call with the `CRON_SECRET` bearer token, as with reference tables.
- Set a February 2027 reminder to verify choices endpoint behaviour once the GW24 draft exists, before relying on second draft attribution in production.

---

## Sources & References

- Related code: `src/utils/squads.ts`, `src/utils/fpl-api.ts`, `src/interfaces/fpl.ts`, `src/utils/season-state.ts`, `src/utils/reference-mapping.ts`, `src/utils/draft-elements.ts`, `src/utils/league.ts`, `src/utils/gameweek-data.ts`
- Cron and persistence: `src/app/api/cron/revalidate/route.ts`, `src/server/db/client.ts`, `src/server/db/schema.ts`, `src/server/data/gameweeks.ts`, `src/server/data/elements.ts`
- Tests as pattern: `src/utils/season-state.test.ts`, `src/utils/reference-mapping.test.ts`, `src/utils/fpl-api.test.ts`
- Backbone docs: `agents/AGENTS.md`, `agents/ARCHITECTURE.md`, `agents/API.md`, `agents/STRATEGY.md`
- Migrations: `drizzle/0004_reference_tables.sql` through `drizzle/0005_drop_profile_bio.sql`
- Prior plan: `docs/plans/2026-08-14-001-feat-db-reference-cache-plan.md`

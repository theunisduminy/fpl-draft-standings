---
title: Finalisation safety system
type: feat
status: active
date: 2026-09-13
---

# Finalisation safety system

## Summary

This plan hardens the gameweek finalisation path so a wrong write becomes structurally unlikely and, if one still lands, reversible without hand written SQL. A newly finished gameweek is held as a candidate for one cron cycle and stored only after two consecutive agreeing reads, explicit shape tripwire probes block the write with payload evidence when upstream drifts, and the forget gameweek script becomes a guarded first class undo. No scoring policy, auth behaviour, or league scoping changes.

---

## Problem frame

A finalised gameweek is never refetched and writes use onConflictDoNothing, so a gameweek stored early stays wrong for the season. On 2026-08-21 the app stored eight joint first nil point weeks before kickoff and served that for three days until rows were deleted by hand. The current guards (deriveSeasonState, hasBeenPlayed, rejectUnfinalisable) all sit on a single read, so one agreeing but wrong read is still enough to freeze a bad result.

---

## Assumptions

_This plan was authored without synchronous user confirmation. The items below are agent inferences that fill gaps in the input, unvalidated bets that should be reviewed before implementation proceeds._

- The cron interval stays at three hours (vercel.json, `0 */3 * * *`), so a hold of about two hours guarantees at least one full cron cycle passes between the two agreeing reads.
- A small candidate workflow table is an acceptable addition to the persistence line in agents/ARCHITECTURE.md, read as ephemeral proposal state scoped by league_id rather than as derived values or provisional scores.
- No new UI surface is needed. Candidates, holds, blocks, and evidence surface through the existing cron step JSON plus server logs, which the eight person audience already monitors indirectly through the site behaving correctly.
- The undo stays a script rather than becoming an admin page, because an administrative act on a table of facts does not justify a new authenticated surface, and the proxy 307 rule makes new routes carry auth design cost.
- Probe evidence is truncated to a bounded snippet (500 characters plus observed field values) so logs stay readable and carry no credentials, since upstream payloads hold none.
- There is no origin brainstorm document. docs/brainstorms/ does not exist in the repo, so this plan carries both the what and the how.

---

## Requirements

- R1. No gameweek finalises on a single agreeing read: a gameweek that newly passes the finished check is held as a candidate and written only after two consecutive agreeing reads separated by at least the hold interval.
- R2. Upstream shape drift blocks finalisation with evidence instead of corrupting it: each of the seven known traps is an explicit probe, and any probe failure refuses the write while attaching the offending payload snippet.
- R3. Mistaken finalisation is reversible without manual database surgery: a guarded undo deletes only the league_id plus gameweek slice and leaves the next read to refetch it.
- R4. Monday freshness cost is explicit and bounded: the worst case added delay is about one cron cycle, and the plan states it.

---

## Scope boundaries

- Changing the F1 scoring policy (F1_POINTS, rank to points mapping, rumbler definition).
- Touching auth: proxy behaviour, membership checks, onboarding, or session handling.
- Multi league support: everything stays scoped to FPL_LEAGUE_ID equals 8337 through getLeagueId().
- New pages, new /api routes for components, or client side fetching of any kind.
- Storing provisional data, all zero gameweeks, derived F1 scores, or season minted identifiers.
- Backfilling or re scoring already stored gameweeks, which remain immutable facts.

### Deferred to follow-up work

- Alerting beyond cron step JSON and logs (for example email or chat notifications on blocked finalisation): separate change once block frequency is observed.
- An authenticated admin surface for the undo: revisit only if script runs become frequent enough to justify the auth design.
- Pulse probe enforcement beyond loud failure with evidence: the no fallback rule already fails loudly, probes only attach the reason.

---

## Context and research

### Relevant code and patterns

- `src/utils/season-state.ts`: deriveSeasonState is the sole finality decider. Any gameweek below current_event is over; current_event is over only when current_event_finished agrees and every event-status row for it says leagues_updated. Tests live in `src/utils/season-state.test.ts`.
- `src/utils/gameweek-data.ts`: computeSeasonUncached fetches the gap between stored and finalised gameweeks, stores via storeFinalisedGameweeks, then scores the in flight gameweek with finished false and never stores it. getGameweekData is the cached wrapper; the cron route deliberately calls the uncached computation.
- `src/server/data/gameweeks.ts`: storeFinalisedGameweeks with the rejectUnfinalisable last line of defence (refuses provisional rows and all zero weeks, filters and logs rather than throwing), inserts with onConflictDoNothing, plus the existing forgetGameweek scoped delete by league_id and gameweek.
- `src/server/db/schema.ts`: gameweek_scores keyed by (league_id, gameweek, league_entry) and gameweeks keyed by (league_id, gameweek). New workflow state follows the same league scoping shape. Migrations live in `drizzle/` and production migrates by hand.
- `src/app/api/cron/revalidate/route.ts`: bearer CRON_SECRET route with per step results, a timestamp guarded single flight slot, and finaliseGameweeks calling computeSeasonUncached directly. TAGS lists every cachedRead tag.
- `src/utils/scoring.ts` with `src/utils/scoring.test.ts`: pure rules (hasBeenPlayed, scoreGameweek absence semantics, assignRanks ties) beside the impure fetch sibling, which is the pattern new rules must follow.
- `src/utils/fpl-api.ts`: sole upstream gateway, server only, builders return request descriptors; upstreamFetch applies timeout plus fresh connection plus one retry on network throw.
- `src/utils/cache.ts`: cachedRead with request scoped dedup; the cron clear then warm ordering is load bearing.
- `scripts/forget-gameweek.mjs`: current escape hatch, sandbox by default, prod only with the prod flag, prints rows before deleting the league_id plus gameweek slice from both tables.
- `agents/AGENTS.md`, `agents/ARCHITECTURE.md`, `agents/API.md`, `agents/STRATEGY.md`: the laws and the seven documented traps with observed payloads.

### Institutional learnings

- No docs/solutions/ directory exists in the repo, so there are no prior written learnings to carry forward. The incident record lives inline in code comments and agents/API.md, which this plan cites per unit instead.

### External references

- No external references beyond the repo docs. Upstream APIs are undocumented and unversioned, so observed payloads in agents/API.md are the contract.

---

## Key technical decisions

- Two phase finalise with a persisted candidate: the first read that finds a gameweek final but unstored records a candidate row (league_id, gameweek, fingerprint, first seen timestamp). The write happens only when a later read, at least CANDIDATE_HOLD_SECONDS after the first, still finds it final with an identical fingerprint. Rationale: instance memory does not survive serverless cold starts, so only a database row can prove two reads agreed across a cron boundary.
- Fingerprint over scored content, not over verdicts: the fingerprint is a stable serialisation of sorted (league_entry, event_total, rank) for the gameweek plus the played signal. Rationale: re comparing the verdict alone would let two different wrong payloads confirm each other; identical content on two reads is the actual agreement.
- Hold interval of two hours against a three hour cron: CANDIDATE_HOLD_SECONDS defaults to 7200. Rationale: two rapid page renders can never confirm each other, while one genuine cron tick always can, which makes the R4 cost exactly one cron cycle in the normal case.
- One pure probes module for all seven traps: `src/utils/shape-tripwires.ts` beside scoring.ts and season-state.ts, each probe returning pass or fail plus bounded evidence. Rationale: keeps the pure and impure split, makes every trap independently testable, and lets the draft subset gate finalisation while the Pulse subset annotates the existing loud failure.
- Probes gate, they do not throw: a failed probe refuses the write, logs evidence through console.error, and surfaces per probe outcomes in the cron finalise step detail. Rationale: matches rejectUnfinalisable precedent, since the caller serves every page render and a throw would take the site down to prevent a write.
- Writes stay onConflictDoNothing: the two phase gate narrows what reaches the insert; the insert semantics do not change. Rationale: conflict ignore remains the correct last resort for concurrent writers, and changing it would trade a silent skip for a loud failure on a path two instances can legitimately share.
- Undo stays a script, promoted: harden scripts/forget-gameweek.mjs with dry run by default, explicit confirmation output, strict league_id plus gameweek slice, and a re queue step that triggers or instructs a revalidate run. Pure argument and slice validation moves to an importable scripts/forget-gameweek.lib.mjs so Vitest can pin it. Rationale: keeps the admin act out of the served app while making the safe path the default path.
- deriveSeasonState remains the sole finality decider: candidates and probes consume its verdict; nothing else decides finished. Rationale: the law exists because two deciders already disagreed once.

---

## Open questions

### Resolved during planning

- Where candidate state lives: in Postgres behind a new Drizzle migration, not in memory or in the Data Cache. Memory does not cross instances and cache entries are not proof of agreement.
- Whether probes replace existing guards: no, they sit in front of the write as named gates with evidence. hasBeenPlayed, deriveSeasonState, and rejectUnfinalisable keep their current jobs.
- Whether the cron schedule changes: no. Three hourly stands; the hold interval is tuned to it and R4 is stated against it.
- Whether Pulse probes block anything new: no new blocking. Pulse has no fallback by design, so its probes attach evidence to the failure the page already raises.
- How the undo re queues a fetch: deleting the gameweek rows plus the gameweeks marker is sufficient, because computeSeasonUncached already treats any unstored gameweek at or below finalisedThrough as missing and refetches it. The script verifies by instructing or triggering one revalidate run.

### Deferred to implementation

- Exact evidence truncation shape and per probe detail strings: bounded at 500 characters plus named fields, final wording left to the implementing change with reviewer sign off.
- Whether the candidate row also stores the full fingerprint input for post mortem: costs little, value unproven. Default to fingerprint plus block reason only.
- Whether to add a cron step that reports held candidates distinctly from blocked ones: intended (held versus blocked versus finalised in the step detail), exact JSON keys left to implementation.

---

## Implementation units

### U1. Candidate agreement rules (pure)

**Goal:** Provide the pure two read agreement logic: fingerprint a scored gameweek and decide whether a candidate may be confirmed.

**Requirements:** R1, R4.

**Dependencies:** None.

**Files:**

- Create: `src/utils/finalisation.ts`
- Modify: none.
- Test: `src/utils/finalisation.test.ts`

**Approach:**

- Implement fingerprintPerformances as a stable serialisation over sorted (league_entry, event_total, rank) plus a played flag derived from the same minutes or total_points signal hasBeenPlayed uses.
- Implement evaluateCandidate covering first sighting (record candidate), agreeing second read after the hold interval (confirm), disagreeing fingerprint (reset with new fingerprint and timestamp), and decider no longer final (drop candidate).
- Keep the hold interval a named exported constant with a comment tying it to the three hour cron schedule, so the R4 bound is readable at the definition site.

**Patterns to follow:**

- `src/utils/scoring.ts` for pure rules with no fetch, database, cache, or clock (pass timestamps in).
- `src/utils/season-state.ts` for decision functions that return data rather than throwing.

**Test scenarios:**

- Happy path: identical fingerprints 3 hours apart with decider still final evaluates to confirm.
- Edge case: identical fingerprints 5 minutes apart evaluates to hold, not confirm.
- Edge case: differing fingerprints on the second read evaluates to reset with the new fingerprint and a fresh timestamp.
- Edge case: decider no longer final on the second read evaluates to drop, even with a matching fingerprint.
- Edge case: empty performance list never confirms.

**Verification:**

- `pnpm test src/utils/finalisation.test.ts` passes, plus `pnpm lint` and `pnpm typecheck` clean.

---

### U2. Shape tripwire probes (pure)

**Goal:** Encode the seven known upstream traps as named probes that return pass or fail with bounded payload evidence.

**Requirements:** R2.

**Dependencies:** None.

**Files:**

- Create: `src/utils/shape-tripwires.ts`
- Modify: none.
- Test: `src/utils/shape-tripwires.test.ts`

**Approach:**

- Cover the seven traps from agents/AGENTS.md and agents/API.md: event-status bare string 404 body, per date versus per gameweek rows (inputs for the every row rule present), live elements empty object, live elements fully zero with nobody played, league entry id versus entry_id resolution (standings league_entry values resolve to known league_entries id values), Pulse table gameWeek zero pre season, Pulse season selection by highest id rather than label parsing.
- Each probe returns a uniform result with probe name, pass flag, and evidence limited to a short snippet plus observed field values.
- Reuse hasBeenPlayed for the played probe rather than reimplementing the minutes signal.

**Patterns to follow:**

- `src/utils/scoring.ts` and `src/utils/season-state.ts` for pure, tested rules; branded LeagueEntryId and EntryId types from `src/interfaces/fpl.ts` for identity probes.
- `src/utils/reference-mapping.ts` style for payload to judgement mapping with explicit staleness and shape comments.

**Test scenarios:**

- Happy path: fully scored GW payloads pass all draft probes; a started Pulse season with gameWeek above zero and max id selection passes Pulse probes.
- Edge case: `{}` elements, 609 elements all on zero minutes, and bare string event-status bodies each fail their own probe with evidence attached.
- Edge case: standings rows referencing entry_id values instead of league entry id values fail the identity probe.
- Edge case: Pulse payload with 20 entries but gameWeek zero fails the started probe; season list with mixed label formats still selects the highest id.
- Error path: malformed or missing probe inputs fail closed (fail the probe, never pass on unknown shape).

**Verification:**

- `pnpm test src/utils/shape-tripwires.test.ts` passes with one test per trap plus the fail closed case; `pnpm lint` and `pnpm typecheck` clean.

---

### U3. Candidate persistence (migration plus DAL)

**Goal:** Persist finalisation candidates per league so two reads across a cron boundary can provably agree.

**Requirements:** R1, R4.

**Dependencies:** U1 (agreement shapes inform the row shape).

**Files:**

- Create: `drizzle/0006_finalisation_candidates.sql` (generated, never hand edited after applying)
- Modify: `src/server/db/schema.ts`, `src/server/data/gameweeks.ts` (or a new `src/server/data/finalisation.ts` if the change prefers a sibling DAL module)
- Test: `src/utils/finalisation.test.ts` (pure agreement already covered in U1; DAL behaviour verified by integration check below)

**Approach:**

- Add a candidates table keyed by (league_id, gameweek) holding fingerprint text, first seen timestamp, last checked timestamp, and an optional truncated block reason. Every query filters on getLeagueId().
- DAL functions: readCandidates, recordCandidate, confirmCandidate (delete on confirm or drop), and noteBlocked (update block reason without confirming).
- Generate the migration with `pnpm db:generate`, apply to sandbox with `pnpm db:migrate`, and document the hand applied production step in the change description without running it from this plan.

**Patterns to follow:**

- `src/server/data/gameweeks.ts` for league scoped reads and writes through getDb from `src/server/db/client.ts`.
- `drizzle/0002_scope_by_league.sql` for the league scoping precedent; never edit an applied migration.

**Test scenarios:**

- Happy path: record then confirm removes the candidate and returns the gameweek as writable once.
- Edge case: record for league 8337 is invisible to reads under any other league id.
- Edge case: re recording the same gameweek with a new fingerprint resets first seen rather than duplicating.
- Integration: sandbox round trip of record, read, confirm, and drop paths against the migrated sandbox branch.

**Verification:**

- Migration applies cleanly to sandbox, DAL round trip verified there, `pnpm typecheck` clean, and the change description carries the exact production migrate command for a human run.

---

### U4. Two phase finalise wiring (data layer plus cron)

**Goal:** Route every finalised gameweek write through candidate agreement and tripwire gates, in both page renders and the sync job.

**Requirements:** R1, R2, R4.

**Dependencies:** U1, U2, U3.

**Files:**

- Create: none.
- Modify: `src/utils/gameweek-data.ts`, `src/app/api/cron/revalidate/route.ts`
- Test: `src/utils/finalisation.test.ts`, `src/utils/shape-tripwires.test.ts` (pure coverage); impure wiring verified by cron dry run below.

**Approach:**

- In computeSeasonUncached, after deriving finalisedThrough, run draft probes over the freshly fetched inputs before storing: probe failure drops the gameweek from the writable set, records or updates the candidate block reason, logs evidence, and leaves the gameweek absent for retry.
- For probe passing gameweeks, apply evaluateCandidate: first sighting records the candidate and holds; agreeing second read past the hold interval confirms and proceeds to storeFinalisedGameweeks; disagreement resets; decider reversal drops.
- Keep storeFinalisedGameweeks and onConflictDoNothing untouched as the final guard, and keep provisional in flight scoring exactly as today with provisional labelling.
- Extend the cron finalise step detail to report finalised, held, blocked with probe names, and dropped counts distinctly, so Monday behaviour is observable without new routes.

**Patterns to follow:**

- `src/utils/gameweek-data.ts` existing comments on why the cron path calls computeSeasonUncached directly and why provisional rows are never stored.
- `src/app/api/cron/revalidate/route.ts` step wrapper convention so a probe or candidate failure reports as step detail, never as an unshaped 500.

**Test scenarios:**

- Happy path: gameweek final on two consecutive reads three hours apart with identical fingerprints is stored; cron detail reports it finalised.
- Edge case: gameweek final on one read only is held, absent from the database, and still rendered provisional.
- Edge case: all zero performances with matching fingerprints still never store (rejectUnfinalisable precedent holds beneath the new gate).
- Error path: drifting payload on the second read (changed totals) resets the candidate instead of confirming; cron detail reports held with the reason.
- Integration: authenticated cron run against sandbox shows held on first tick and finalised on the next tick for a genuinely finished gameweek.

**Verification:**

- Pure suites green, sandbox two tick cron walkthrough observed (held then finalised), `pnpm lint`, `pnpm typecheck`, and `pnpm test` clean.

---

### U5. First class reversible undo

**Goal:** Promote scripts/forget-gameweek.mjs from escape hatch to a guarded, reversible default safe undo that removes only one league plus gameweek slice and re queues the fetch.

**Requirements:** R3.

**Dependencies:** U3 (candidate rows for the same slice must be cleared alongside scores).

**Files:**

- Create: `scripts/forget-gameweek.lib.mjs`, `scripts/forget-gameweek.lib.test.ts`
- Modify: `scripts/forget-gameweek.mjs`

**Approach:**

- Extract pure validation into the lib: gameweek range 1 to 38, league id positive integer from FPL_LEAGUE_ID, target resolution (sandbox default, prod only with explicit flag), and the exact slice descriptor (league_id plus gameweek across gameweek_scores, gameweeks, and candidates).
- Make the script dry run by default: print the slice and row counts first, require an explicit apply flag to delete, keep prod behind its existing explicit flag, and exit non zero on missing configuration or invalid input.
- After deletion, clear the candidate row for the same slice and instruct or trigger one /api/cron/revalidate run with the CRON_SECRET bearer token so the next read refetches the gameweek through the two phase path.

**Patterns to follow:**

- Existing script header comment style that records why the tool exists with the 2026-08-21 incident reference.
- `src/server/data/gameweeks.ts` forgetGameweek for the exact delete predicates the script must mirror.

**Test scenarios:**

- Happy path: valid gameweek with sandbox target resolves the correct slice descriptor and, on apply, deletes only that slice across all three tables.
- Edge case: out of range gameweek (0, 39, non integer) exits non zero with usage text and deletes nothing.
- Edge case: prod target without the explicit prod flag refuses to run; dry run default deletes nothing while printing row counts.
- Edge case: gameweek with no stored rows reports nothing to do and exits zero.
- Integration: forget then revalidate on sandbox restores the gameweek through the candidate path (held first, finalised on agreement).

**Verification:**

- `pnpm test scripts/forget-gameweek.lib.test.ts` passes, sandbox forget plus revalidate walkthrough observed, and the script help text documents the prod procedure.

---

### U6. Evidence logging and runbook

**Goal:** Make every hold, block, and undo legible to the next person on call through logs, cron output, and committed docs.

**Requirements:** R2, R3, R4.

**Dependencies:** U4, U5.

**Files:**

- Create: none (docs edits only).
- Modify: `agents/API.md`, `src/app/api/cron/revalidate/route.ts` (step detail wording only), `scripts/forget-gameweek.mjs` (help text), plus the plan linked runbook notes in `agents/AGENTS.md` only if the finalisation section warrants a pointer.
- Test: none, docs only. Test expectation: none, prose and log wording verified by review.

**Approach:**

- Document each probe, its evidence shape, and the block versus hold distinction in agents/API.md alongside the existing trap entries, in the same change that ships the probes.
- State the R4 cost plainly where the cron schedule is discussed: expected finalisation lags reality by up to about one three hour cycle, and provisional display covers the gap with provisional labelling intact.
- Record the undo procedure (dry run, apply, prod flag, revalidate trigger) in the script help and reference it from the cron step detail on blocked finalisation.

**Patterns to follow:**

- agents/API.md warning block style with observed payloads and the consuming function named.
- British English, sentence case, no em dashes, repo relative paths in all doc edits.

**Test scenarios:**

- Test expectation: none, docs only. Review checks: every probe name in code appears in agents/API.md; every cron detail keyword (finalised, held, blocked, dropped) is defined there; all paths repo relative.

**Verification:**

- Docs review confirms probe to doc parity, `pnpm format:check` clean, and a cold reader can run the undo from the script help alone.

---

## System-wide impact

- **Interaction graph:** computeSeasonUncached gains two pre write stages (probes, candidate agreement) on the path every page render and every cron tick shares. No page, component, or DAL reader changes signature; the season response shape is unchanged.
- **Error propagation:** probe and candidate refusals stay non throwing by design, following rejectUnfinalisable. Genuine upstream outages keep their current loud paths; probes only add named evidence to refusals.
- **State lifecycle risks:** the candidate table is new workflow state with a defined end (confirm writes and deletes it; reversal drops it; disagreement resets it). Stale candidates cannot accumulate silently because last checked timestamps plus block reasons make them visible in cron detail. No provisional or derived data enters gameweek_scores.
- **API surface parity:** no new routes, no changed response contracts. Cron step detail gains keywords (finalised, held, blocked, dropped) which monitors should treat as additive.
- **Integration coverage:** unit tests pin pure agreement and probes; sandbox two tick cron runs plus the forget then revalidate walkthrough prove the cross read behaviour that unit tests cannot.
- **Unchanged invariants:** F1 policy in code, server only upstream access through src/utils/fpl-api.ts, sole DB client in src/server/db/client.ts, league_id scoping on every row and query, stable codes over season minted ids, onConflictDoNothing writes, provisional labelling on every provisional surface, deriveSeasonState as sole decider, hand applied production migrations, pnpm on Node 22.

---

## Risks and dependencies

| Risk                                                              | Mitigation                                                                                                                                                                              |
| ----------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Candidate table reads as scope creep against the persistence line | Name it ephemeral proposal state in schema comments, key it by league_id, store no scores or derived values, and delete rows on confirm or drop                                         |
| Hold interval mis tuned relative to a future cron change          | Export the constant beside the cron schedule reference and restate the R4 bound in agents/API.md so a schedule edit forces a hold review                                                |
| Two instances recording competing candidates                      | Same payload converges on the same fingerprint; inserts use conflict ignore and confirmation rechecks content, so divergence resets rather than writes                                  |
| Probe evidence logging too verbose or too thin                    | Bound snippets at 500 characters with named fields, log at error level only on refusal, and review wording in U6                                                                        |
| Undo script aimed at the wrong target                             | Dry run default, slice printed before delete, prod behind an explicit flag, sandbox default preserved                                                                                   |
| Migration applied to sandbox but not production                   | Change description carries the exact hand run command; readers fall back to current behaviour until the table exists, and the wiring treats a missing table as hold rather than confirm |
| Pulse probe work drifts into building a fallback                  | Explicit non goal: Pulse keeps no fallback by design, probes only annotate the existing loud failure                                                                                    |

---

## Documentation and operational notes

- Update agents/API.md with one entry per probe in the same change that ships it, following the existing warning style with observed payloads and consuming function.
- State the Monday freshness bound wherever the cron interval is discussed: up to about one three hour cycle from genuinely final to stored, with provisional display covering the gap.
- Keep the 2026-08-21 incident reference in code comments at the candidate and probe sites so the why survives contact with future refactors.
- Rollout order: migrate sandbox, land U1 plus U2, land U3, walk the two tick cron path on sandbox, land U4, harden the script in U5, finish docs in U6. Production migration is a deliberate hand step after sandbox proof.
- Operate with pnpm only on Node 22; verify with `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm format:check`.

---

## Sources and references

- agents/AGENTS.md: finalisation law, seven traps, escape hatch, testing split, boundary rules.
- agents/ARCHITECTURE.md: persistence line, league scoping keys, cron sync job, hand migration procedure.
- agents/API.md: observed payloads for event-status, live elements, league details identity fields, Pulse gameWeek and season selection, cron route contract.
- agents/STRATEGY.md: Monday freshness metric and non goals (single league, no native app).
- Related code: `src/utils/season-state.ts`, `src/utils/season-state.test.ts`, `src/utils/gameweek-data.ts`, `src/utils/scoring.ts`, `src/utils/fpl-api.ts`, `src/utils/cache.ts`, `src/server/data/gameweeks.ts`, `src/server/db/schema.ts`, `src/server/db/client.ts`, `src/app/api/cron/revalidate/route.ts`, `scripts/forget-gameweek.mjs`, `vercel.json`, `drizzle/`.

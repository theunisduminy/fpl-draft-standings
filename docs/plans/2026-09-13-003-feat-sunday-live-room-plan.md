---
title: Sunday live room
type: feat
status: active
date: 2026-09-13
---

# Sunday live room

## Summary

Add a matchday-only live board at `/live` that shows the gameweek in flight as a pit-wall tower: eight managers in provisional rank order with gap to safety, riser and faller state, done versus still to play counts from the live feed, and provisional labelling plus a freshness stamp on every figure. The live slice reads through the existing server-only gateway on its own short cache, finished gameweeks keep their current caching and cost, nothing provisional is persisted, and refresh is a client-leaf control that re-renders the server tree.

---

## Problem frame

On the day everyone looks, the site answers with history. The standings page carries one provisional badge and a full season of settled weight around it, so a manager asking "am I safe?" mid Sunday must untangle which numbers can still move. Prior art (DraftFPL.live, F1 timing towers) shows the fix is a single screen shaped like the question: who is where right now, by how much, and who still has players to come.

---

## Assumptions

_This plan was authored without synchronous user confirmation. The items below are agent inferences that fill gaps in the input, un-validated bets that should be reviewed before implementation proceeds._

- The board lives at a new `/live` route inside `(onboarded)`, reached from the existing nav, rather than as a section of `/` or `/results`.
- The live slice cache TTL is 60 seconds against 300 seconds for the season aggregate.
- Safety means staying out of provisional last place: gap to safety is the points cushion above provisional 8th, shown beside the interval to the manager directly above.
- Riser and faller state compares each manager's provisional gameweek rank against their settled season F1 rank entering the gameweek (performing above station reads as a riser).
- Refresh is `router.refresh()` in a client leaf, guarded by the 60 second cache and a disabled while refreshing state. No polling, no interval, no Server Action, no new `/api/*` route.
- The freshness stamp renders server side in UK time (`en-GB`, `Europe/London`), consistent with kickoff labels.
- The cron job registers the new cache tag for invalidation but does not warm the live slice.
- When no gameweek is in flight, or before kickoff, or when the live feed is unreadable, `/live` renders an explanatory empty state rather than throwing or ranking zeros.
- A "Live" entry is added to `SideNav`, `MobileNav`, and `HeaderNav` where each lists links.

---

## Requirements

- R1. During an in-flight gameweek a manager can answer "am I safe?" (provisional rank, gap, players left) without needing to know what provisional means.
- R2. No provisional value is stored anywhere and every provisional figure is labelled as provisional.
- R3. Finished-gameweek surfaces keep current cache behaviour and upstream cost.
- R4. Live refresh cannot hammer upstream (guarded revalidation, request-scoped work only).

---

## Scope boundaries

- No push, websocket, polling, or interval based live updates. Refresh is manual through the refresh control.
- No change to F1 scoring (`F1_POINTS`, `assignRanks`, aggregation rules).
- No change to the Monday settled experience on `/`, `/results`, or `/rumblers`.
- No multi-league support. Every row and query stays scoped by `league_id` through `getLeagueId()`.
- No new `/api/*` routes.
- No persistence of derived values or of provisional gameweeks, and no schema or migration changes.

---

## Context and research

### Relevant code and patterns

- `src/utils/gameweek-data.ts`: the data layer. `computeSeasonUncached()` scores the in-flight gameweek with `finished: false` via `fetchGameweekBatch`, never persists it (`withoutInFlight`, `standingsFallback` guards), and exposes `provisionalGameweek`. `fetchEventStatus()` maps the bare string 404 to `[]`. The season cache is `cachedRead('gameweek-data', 300, ...)`.
- `src/utils/scoring.ts`: pure and tested. `scoreGameweek` (returns `[]` for unscored weeks, XI only, `finished` is required), `hasBeenPlayed()` (real minutes, not key counts), `assignRanks` (shared higher rank, `1, 1, 3`), `aggregatePlayers` (settled F1 ranks from stored facts).
- `src/utils/season-state.ts`: `deriveSeasonState()` is the only place that decides whether a gameweek is over (every `event-status` row plus `current_event_finished`). The live slice must reuse it, never re-decide.
- `src/utils/cache.ts`: `cachedRead` owns the one cache per thing (process map plus Data Cache, request-scoped dedup via `requestToken`). Upstream reads are `no-store` through `upstreamFetch`. Memoise settled values only.
- `src/utils/fpl-api.ts`: sole upstream gateway, server-only, fresh-connection `upstreamFetch` with timeout and one retry. `fplApi.eventLive(gw)`, `fplApi.entryEvent(entryId, gw)`, `fplApi.eventStatus()`, `fplApi.game()`, `getLeagueId()`.
- `src/utils/gameweek-squad.ts`: `fetchEntryPicks` (404 means no picks, `[]`) and per-player live points lookup; the pattern for joining picks to `elements[id].stats`.
- `src/server/data/gameweeks.ts`: `getStoredPerformances()` and `getFinalisedGameweeks()` are league scoped reads the live slice may use; `storeFinalisedGameweeks` with `rejectUnfinalisable` is what the live path must never call.
- `src/server/actions/gameweek.ts`: `readGameweekSquad` is the picks-on-demand precedent (membership check, validated args). The live room does not need an action because the page reads its own data and the leaf only triggers `router.refresh()`.
- `src/app/(app)/(onboarded)/(home)/page.tsx` plus `loading.tsx`: the `PageShell` plus in-page `Suspense` pattern to copy (heading above the boundary, `SkeletonRegion`, mirrored skeleton, `dynamic = 'force-dynamic'`).
- `src/components/LiveGameweekBadge.tsx` and `LiveGameweekNote`: existing provisional labelling primitives to reuse.
- `src/components/TableView/StandingsSkeleton.tsx` and `src/components/shapes.ts`: skeleton conventions (shared shape constants, eight rows is exact for this league).
- `src/components/TableView/StandingsTable.tsx`: client leaf precedent (`useRouter` for navigation only, data arrives as props).
- `src/app/api/cron/revalidate/route.ts`: `TAGS` must gain the new cache key in the same change; warm list stays as is.
- `src/utils/premier-league-data.ts`: precedent for a second `cachedRead` with its own TTL beside a slow moving one (season id versus five minute scores).
- `src/utils/chart-scales.ts` and `src/utils/chart-scales.test.ts`: presentation rules live in pure tested modules; colour and band choices need pinning tests.
- `agents/AGENTS.md`, `agents/ARCHITECTURE.md`, `agents/API.md`, `agents/FRONTEND.md`, `agents/STRATEGY.md`: boundary laws, persistence line, endpoint traps, component placement, and the single league scope.

### Institutional learnings

- No `docs/solutions/` directory exists in this repo, so no institutional entries were carried in. The traps that would live there are documented inline in `agents/AGENTS.md` (promise across requests, pooled sockets, all zero live feed, per-date event status) and each is cited where the plan relies on it.

### External references

- DraftFPL.live 30 second head-to-head refresh: prior art for the single screen habit, not the mechanism (this plan polls nothing).
- F1 timing tower and GRID single-screen overlay: prior art for interval plus gap presentation.

---

## Key technical decisions

- Separate live slice, separate cache: new `cachedRead('live-gameweek', 60, computeLiveGameweek)` in `src/utils/live-gameweek.ts`. The season aggregate keeps key `gameweek-data` and TTL 300. One cache per thing holds on both sides, and finished-gameweek cost is untouched (R3).
- Pure derivations in `src/utils/live-tower.ts`: tower ordering, interval, cushion above last, done versus to play counts, riser and faller state, freshness shaping. Tested beside it, following the `scoring.ts` versus `gameweek-data.ts` split (R1 without untestable rules).
- Scoring reuse, not a second method: provisional points come from `scoreGameweek(gw, live, picks, false)` plus `assignRanks`, so a provisional rank settles into the identical number by construction. The known mid-gameweek divergence between the XI sum and `standings[].event_total` is resolved by always using the XI sum and saying it is provisional (R1, R2).
- Done means registered minutes: an XI starter with live `minutes > 0` is done or underway, the rest are still to come. This reuses the `hasBeenPlayed()` signal at player granularity. The unused substitute edge (0 minutes after full time reads as still to come) is accepted and documented in copy rather than solved with fixture state.
- No persist path: `live-gameweek.ts` imports no write DAL function. Settled ranks for the riser baseline come from `getStoredPerformances()` (read only) joined to league entries. Provisional rows are shaped as `GameweekPerformance` with `finished: false` in memory only.
- Refresh without a route: a `'use client'` leaf calls `router.refresh()`, which re-renders the server tree through the 60 second cache. Upstream cost per recompute is bounded (one league read, two state reads, one live feed, eight picks) and concurrent readers share one computation inside the request via `cachedRead` dedup.
- Matchday-only page: `/live` under `(onboarded)` with its own `loading.tsx` (a static route cannot 404, so the status commit trap does not apply). No in-flight gameweek, pre-kickoff feed, or unreadable feed each render distinct empty states. Zeros are never ranked.

---

## Open questions

### Resolved during planning

- Where does the board live: new `/live` route, since the spec asks for a matchday-only board and the nav plus `PageShell` pattern already support one page per question.
- Which TTL: 60 seconds. Five minutes froze Sunday scores at lunchtime (the documented reason the season TTL dropped to 300); 30 seconds doubles upstream chatter for eight readers with no new information, since the inputs themselves move on FPL processing cycles.
- What safety means: cushion above provisional last, because the league's vivid failure state is the rumbler, and interval to the manager above, because that is the next thing a reader can change.
- What riser and faller compare: provisional gameweek rank versus settled season F1 rank entering the gameweek, computed from stored facts plus the live gameweek in memory.
- How refresh is guarded: cache TTL plus disabled while refreshing control. No debounce constant, no cooldown timer, nothing to tune.
- Whether cron warms the live slice: it does not. Warming a 60 second cache on a three hour schedule buys nothing and spends 12 upstream calls per run.

### Deferred to implementation

- Exact tower row layout and whether interval and cushion share one column on narrow screens: visual judgement, verify by eye (no jsdom in CI, layout is never asserted in tests).
- Whether `HeaderNav` needs the Live link or only `SideNav` plus `MobileNav`: check its link list during implementation; the plan names all three as candidates.
- Whether `fetchEventStatus` and `fetchGameState` are exported from `gameweek-data.ts` for reuse or duplicated privately in `live-gameweek.ts`: small duplication versus widening an export, decide at the keyboard with a bias to export rather than fork the 404 mapping.

---

## Implementation units

### U1. Live tower derivations (pure, tested)

**Goal:** Pin every number the tower shows as a pure function of picks plus the live feed plus settled facts.

**Requirements:** R1, R2

**Dependencies:** None

**Files:**

- Create: `src/utils/live-tower.ts`
- Modify: none
- Test: `src/utils/live-tower.test.ts`

**Approach:**

- Define plain input and output shapes (`LiveTowerInput`, `LiveTowerRow`, `LiveRoomData`) using branded `LeagueEntryId` throughout, never plain `number` for manager identity.
- Reuse `scoreGameweek` with `finished: false`, `assignRanks`, and `hasBeenPlayed` from `src/utils/scoring.ts`. Add no scoring rule of its own.
- Row order is provisional gameweek rank ascending. Per row: provisional points, interval to the manager directly above (0 for first), cushion above provisional last, done count and to play count over the XI (`minutes > 0` counts as done), and riser, faller, or level state against the settled season F1 rank entering the gameweek.
- Carry `gameweek`, `computedAt` epoch millis, and an explicit `provisional: true` marker on the shaped data so every renderer can label without re-deriving.
- Keep colour and band choice out; the module returns facts (ranks, gaps, counts, movement direction) and the component maps them to static classes.

**Patterns to follow:**

- `src/utils/scoring.ts` for pure rules, branded ids, and tie handling.
- `src/utils/chart-scales.ts` for the facts versus presentation split.

**Test scenarios:**

- Happy path: eight managers with varied XI sums order by provisional rank, intervals and cushions match hand computed gaps, ties share the higher rank and consume the next.
- Happy path: done versus to play counts from a stub live feed (six starters with `minutes > 0`, five on zero) yield done 6 and to play 5.
- Happy path: riser when provisional gameweek rank is better than settled F1 rank, faller when worse, level when equal.
- Edge case: pre-kickoff feed (all `minutes: 0`, all `total_points: 0`) reports `started: false` and produces no ranked rows.
- Edge case: single manager missing picks drops out without shifting the other seven (mirrors `scoreGameweek` partial league guard).
- Edge case: last place row shows cushion 0 and first place row shows interval 0.
- Error path: null live feed yields an unavailable result rather than ranked zeros.

**Verification:**

- `pnpm test src/utils/live-tower.test.ts` passes, plus `pnpm lint` and `pnpm typecheck` clean.

---

### U2. Live gameweek slice (server data layer, short cache)

**Goal:** Serve the live room data on its own 60 second cache without touching settled behaviour or persisting anything.

**Requirements:** R2, R3, R4

**Dependencies:** U1

**Files:**

- Create: `src/utils/live-gameweek.ts`
- Modify: `src/app/api/cron/revalidate/route.ts` (register the new tag only, no warm entry)
- Test: none (impure fetch and cache layer, same posture as `gameweek-data.ts` and `squads.ts`)

**Approach:**

- `computeLiveGameweek()` runs request-scoped work only: league details, event status, game state in parallel, then `deriveSeasonState()` to find the in-flight gameweek. No module level promise, no settled value memo beyond what `cachedRead` owns.
- When no gameweek is in flight, return `{ state: 'idle', gameweek: null }` without reading picks or the live feed.
- When in flight, read the live feed plus all eight entries' picks (batched as in `fetchGameweekBatch`), reusing `fetchEntryPicks` so the 404 means no picks semantics stay identical.
- Shape the result through U1's pure builder with settled ranks from `getStoredPerformances()` (read only) and stamp `computedAt` at shape time. Only plain serialisable data crosses `cachedRead`.
- Export `getLiveGameweek = cachedRead('live-gameweek', 60, computeLiveGameweek)`. Upstream reads stay `no-store` via `upstreamFetch`.
- Never import `storeFinalisedGameweeks` or any write DAL function into this module.
- Register `'live-gameweek'` in `TAGS` so the sync job invalidates it; do not add it to the warm list.

**Patterns to follow:**

- `src/utils/gameweek-data.ts` for batching, the in-flight scoring call, and the provisional never stored comments.
- `src/utils/premier-league-data.ts` for running a short TTL slice beside a slow moving one.
- `src/utils/cache.ts` for request-scoped dedup and the development recompute behaviour.

**Test scenarios:**

- Happy path: manual run during an in-flight gameweek returns eight provisional rows with `finished: false` throughout and a recent `computedAt`.
- Edge case: finished gameweek surfaces render byte identical output and identical upstream counts before and after this change (R3 happiness check via code review plus existing tests).
- Error path: live feed 404 or picks failing for all eight yields the unavailable state, and the page renders its empty state rather than throwing.
- Integration: cron `GET` with `CRON_SECRET` reports the new tag in `revalidated` while the warm summary still names only the three existing caches.

**Verification:**

- `pnpm lint`, `pnpm typecheck`, `pnpm test` pass; `TAGS` contains the new key; no import of a write DAL function exists in the new module (review check).

---

### U3. Live page shell, suspense, and empty states

**Goal:** Mount the board at `/live` inside the existing streaming pattern with honest states for every non live condition.

**Requirements:** R1, R2

**Dependencies:** U2

**Files:**

- Create: `src/app/(app)/(onboarded)/live/page.tsx`
- Create: `src/app/(app)/(onboarded)/live/loading.tsx`
- Test: none (layout verified by eye, per house rule; no jsdom in CI)

**Approach:**

- `PageShell` title `Live room`, subtitle naming the in-flight gameweek only once the data is known. Static title text stays above the `Suspense` boundary; the gameweek specific line renders inside the streamed subtree.
- `export const dynamic = 'force-dynamic'` as on `/` and `/results`, since the page reads live upstream data.
- Inside the boundary, an async server child calls `getLiveGameweek()` and branches: idle (no gameweek in flight), pre-kickoff (fixtures exist, nobody played), unavailable (feed or picks unreadable), and live tower.
- Every branch that shows a rank or a figure carries the provisional marker via `LiveGameweekBadge` or `LiveGameweekNote`. Empty states explain what is happening ("No gameweek in progress", "GWx starts soon", "Live feed unavailable") rather than error copy.
- Restate `PageShell` spacing inside the skeleton fallback so handover does not shift.

**Patterns to follow:**

- `src/app/(app)/(onboarded)/(home)/page.tsx` and `loading.tsx` for boundary placement and mirrored skeletons.
- `src/components/LiveGameweekBadge.tsx` for provisional labelling copy and tone.

**Test scenarios:**

- Happy path: Sunday in-flight visit streams the heading immediately, then the tower.
- Edge case: Monday visit (gameweek finalised, none in flight) shows the idle state with no ranks.
- Edge case: Saturday pre-kickoff visit shows the starts soon state with no joint first table of zeros.
- Integration: signed out visit redirects via `src/proxy.ts`; non member visit follows the `(onboarded)` gate like every other page.

**Verification:**

- Manual visit in each state reads correctly; no provisional figure renders without its label (eye check against R2).

---

### U4. Tower presentation and freshness stamp

**Goal:** Render the eight row tower, sweat state, and freshness stamp with static classes and semantic tokens only.

**Requirements:** R1, R2

**Dependencies:** U1, U3

**Files:**

- Create: `src/components/LiveRoom/LiveTower.tsx` (server component, data as props)
- Create: `src/components/LiveRoom/LiveTowerSkeleton.tsx`
- Modify: `src/components/shapes.ts` (shared column shape constants if the tower needs them, mirroring the standings pattern)
- Test: none (layout verified by eye; any band or threshold rule stays in `live-tower.ts` under U1 tests)

**Approach:**

- Server component receiving the shaped room data as props. No fetch, no gateway import, no `server-only` transitive dependency.
- One row per manager in provisional order showing position, manager and team names, provisional points with a provisional tag, interval to above, cushion above last, done versus to play count, and a riser, faller, or level marker.
- Freshness line rendered server side from `computedAt` in UK time plus the sentence that positions are provisional and will change. Reuse `LiveGameweekNote` wording where it fits.
- Static Tailwind class names only, chosen from literal lookup maps where state picks styling (riser versus faller colour). Semantic tokens (`text-muted-foreground`, `border-border`, rank badge helpers from `table-configs.tsx`) rather than hard coded colours.
- Sentence case copy throughout, no em dashes in UI strings.

**Patterns to follow:**

- `src/components/TableView/base-table.tsx` and `table-configs.tsx` (shared table, shared rank badge palette).
- `src/components/TableView/StandingsSkeleton.tsx` for mirrored skeleton construction.
- `agents/FRONTEND.md` for primitives first and the literal class map law.

**Test scenarios:**

- Happy path: eight rows render in provisional order with every figure carrying its provisional label.
- Edge case: tied managers share a position badge and the next position is consumed.
- Edge case: a manager with all eleven still to come reads as maximum sweat, not as zero achievement.
- Integration: skeleton and tower share column shapes so data landing causes no layout shift.

**Verification:**

- Eye check across narrow and wide widths; `pnpm lint` and `pnpm typecheck` clean; no dynamically assembled class names in the new components.

---

### U5. Refresh control leaf and navigation

**Goal:** Let a reader refresh the room without hammering upstream, and let them find the room at all.

**Requirements:** R1, R4

**Dependencies:** U3, U4

**Files:**

- Create: `src/components/LiveRoom/RefreshControl.tsx` (`'use client'` leaf)
- Modify: `src/components/Layout/SideNav.tsx`
- Modify: `src/components/Layout/MobileNav.tsx`
- Modify: `src/components/Layout/HeaderNav.tsx` (only if it lists page links; confirm during implementation)
- Test: none (interaction leaf verified by eye)

**Approach:**

- The leaf owns a button only: pending state via `useTransition`, calls `router.refresh()`, disables while refreshing, and announces politely for assistive tech. It receives no data and fetches nothing.
- Upstream guard is structural: refresh re-renders through the 60 second `cachedRead`, so rapid clicks within the window serve the cached slice and at most one recompute (at most 12 upstream calls) follows each expiry. Document this in the component comment so a future interval is recognised as a cost change.
- Add the Live entry to each nav with an appropriate lucide icon, matching existing item shape. Only matchday relevance is handled by the page states, not by hiding the link.
- Render the control in the streamed subtree (it refreshes the live region) rather than in `PageShell` action, since whether it is meaningful is a fact about the data.

**Patterns to follow:**

- `src/components/TableView/StandingsTable.tsx` for the minimal client leaf (`useRouter`, props in, nothing fetched).
- `src/components/Profile/ProfileForm.tsx` for `useRouter` usage shape in this codebase.

**Test scenarios:**

- Happy path: click refreshes figures after the next feed movement without a full page reload.
- Edge case: five rapid clicks inside the cache window cause at most one upstream recompute (observe via logs or upstream counts in development).
- Edge case: refresh while the feed is unavailable keeps the unavailable empty state rather than throwing.
- Integration: nav entry highlights on `/live` through the existing active path logic on desktop and mobile.

**Verification:**

- Eye and interaction check; `pnpm lint`, `pnpm typecheck`, `pnpm test` pass; no new fetch, action, or route handler introduced (review check against R4).

---

## System-wide impact

- **Interaction graph:** `/live` adds one more concurrent reader of the draft API on cache miss (up to 12 upstream calls per 60 seconds per instance at peak). No existing page changes its reads; `getGameweekData` callers are untouched.
- **Error propagation:** live slice failures resolve to the unavailable empty state inside the page. Nothing throws to `src/app/error.tsx` for feed conditions; genuine bugs still throw as today.
- **State lifecycle risks:** the live slice holds no promise across requests (request-scoped dedup only), persists nothing, and carries `computedAt` as a settled number. The pre-kickoff all zero feed and the empty `elements` feed both resolve to unranked states, never to stored or displayed zeros.
- **API surface parity:** no new routes. Cron gains one tag for invalidation and explicitly no warm entry.
- **Integration coverage:** unit tests pin U1 derivations; U2 through U5 integrate existing pieces (gateway, cache, shell, nav) and are verified by targeted manual passes plus the unchanged CI suite.
- **Unchanged invariants:** F1 scoring policy, settled persistence rules, league scoping, branded identifiers, server-only gateway, and the 300 second season cache all stay exactly as they are.

---

## Risks and dependencies

| Risk                                                                         | Mitigation                                                                                                                         |
| ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| The 60 second live slice multiplies upstream calls on a busy Sunday          | Bounded at about 12 calls per recompute with request-scoped dedup; eight known readers; no polling. Accept and observe.            |
| Riser baseline confuses because it compares a gameweek rank to a season rank | Copy says "performing above station" style wording and the plan records the definition; review the wording by eye before shipping. |
| Unused substitute reads as still to come after full time                     | Accepted limitation, stated in copy ("yet to register minutes"); fixture level state is out of scope.                              |
| Starting XI sum disagrees with upstream `event_total` mid-gameweek           | Always use the XI sum, label provisional; the divergence is documented in `agents/API.md` and behaves identically at settle time.  |
| New cache tag forgotten by cron                                              | U2 registers it in `TAGS` in the same change; verification names the check explicitly.                                             |
| Refresh control becomes an auto poll later                                   | Component comment states the cost explicitly so a future interval is a deliberate decision, not drift.                             |

---

## Documentation and operational notes

- Update `agents/API.md` only if the live slice observes a new endpoint behaviour; no new endpoint is added, so expect no change.
- No migration, no env change, no cron schedule change. Deploy normally; the first `/live` visit warms the slice on demand.
- Confirm after the next in-flight gameweek that provisional ranks settle into identical settled ranks, and that no provisional row reaches `gameweek_scores`.
- Owner review of un-validated assumptions before implementation, in particular the `/live` route, the safety definition, and the riser baseline.

---

## Sources and references

- Related code: `src/utils/gameweek-data.ts`, `src/utils/scoring.ts`, `src/utils/season-state.ts`, `src/utils/cache.ts`, `src/utils/fpl-api.ts`, `src/utils/gameweek-squad.ts`, `src/server/data/gameweeks.ts`, `src/server/actions/gameweek.ts`, `src/app/(app)/(onboarded)/(home)/page.tsx`, `src/components/LiveGameweekBadge.tsx`, `src/app/api/cron/revalidate/route.ts`
- Related docs: `agents/AGENTS.md`, `agents/ARCHITECTURE.md`, `agents/API.md`, `agents/FRONTEND.md`, `agents/STRATEGY.md`
- Related plan: `docs/plans/2026-08-14-001-feat-db-reference-cache-plan.md`
- External: DraftFPL.live head-to-head; F1 timing tower and GRID overlay as presentation prior art

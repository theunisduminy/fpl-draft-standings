---
title: Cold-load contract
type: feat
status: active
date: 2026-09-13
---

# Cold-load contract

## Summary

Restructure the onboarded layout so AppChrome and the page shell stream before `getCurrentUser()` resolves, by moving the membership and profile check into a suspended gate inside the content area, and switch the strategy metrics onto the already mounted Vercel Analytics and Speed Insights packages with a Monday runbook. Enforcement semantics, routes, and dependencies stay unchanged.

---

## Problem Frame

Every gated page awaits `getCurrentUser()` in `(onboarded)/layout.tsx` with no Suspense boundary between that read and AppChrome, so navigation cannot flush until the lookup returns. The layout work in section 3 of the architecture doc is undone at the gate. Separately, the strategy names three metrics (weekly return, cold-load standings time, season completion) and notes both analytics packages are installed but uninstrumented, so the league cannot answer how a settled gameweek performed.

---

## Assumptions

_This plan was authored without synchronous user confirmation. The items below are agent inferences that fill gaps in the input, un-validated bets that should be reviewed before implementation proceeds._

- A Suspense boundary in a layout commits the HTTP status on first flush exactly like `loading.tsx` does, so a uniform streaming gate would turn `/players/unknown` into a 200. The mechanism (flush commits status) is transport level, but only the `loading.tsx` case is verified in repo.
- A `redirect()` thrown from the suspended gate after the shell has flushed resolves as a client-side navigation to `/profile` on hard loads, with a brief chrome plus skeleton flash and no league content leak.
- `<Analytics />` and `<SpeedInsights />` in the root layout collect page views and web vitals on the Vercel deployment with no further configuration or consent banner for this eight person audience.
- Vercel dashboard audience and page filtering is expressive enough for the owner to isolate the eight managers' Monday visits; ad blockers and preview deployments are accepted noise.

---

## Requirements

- R1. Navigation chrome paints before the user lookup resolves, on every route, with enforcement semantics unchanged.
- R2. The Monday after a gameweek settles, the league can answer how many of the eight visited and how slow the cold load was.
- R3. No new dependencies and no new API routes.
- R4. Unauthenticated or non-member users see exactly what they see today, with no league content leaking through earlier streaming.

---

## Scope Boundaries

- No redesign of any page; skeletons and headings are reused as found.
- No change to auth rules: proxy gate, member check, and onboarded group stay intact with identical redirect targets.
- No change to `src/proxy.ts`, including its matcher.
- No multi-league support and no custom analytics backend.
- No new `/api/*` routes and no client side fetching of upstream or membership data.
- No `loading.tsx` added above any route that can 404.

---

## Context & Research

### Relevant code and patterns

- `src/app/(app)/(onboarded)/layout.tsx`: async layout awaiting `getCurrentUser()` above every onboarded route, redirecting to `/profile` when null or incomplete. This is the blocking read to move.
- `src/app/(app)/layout.tsx` plus `src/components/Layout/AppChrome.tsx`: the navigation shell. Fully static (no awaits, no session read), so it can flush the moment a boundary below it allows.
- `src/components/Layout/PageShell.tsx`: heading paints above the in-page Suspense boundary on every data page; the pattern the gate restructure copies one level up.
- `src/app/(app)/profile/page.tsx`: the model for cheap reads above the boundary (session only) with expensive reads (`getGameweekData()`, teams, profile) suspended below it.
- `src/app/(app)/(onboarded)/(home)/loading.tsx`: documents the verified status hazard. A shell flushed above `/players/[playerId]` commits 200 before `notFound()` runs. Any layout Suspense shares the mechanism.
- `src/app/(app)/(onboarded)/players/[playerId]/page.tsx`: the one onboarded route that can 404. It has no `loading.tsx` and no in-page Suspense; `notFound()` runs before any flush today.
- `src/app/(app)/(onboarded)/squads/page.tsx`: already calls `getCurrentUser()` inside its own Suspense child to pick the default squad. Unaffected by the gate move; stays as found.
- `src/app/layout.tsx` lines 67 to 68: `<Analytics />` and `<SpeedInsights />` from `@vercel/analytics` and `@vercel/speed-insights` are already mounted in the root layout, so they fire on every route including the server rendered pages that call `getGameweekData()`.
- `src/server/auth/server.ts`: `getCurrentUser()` runs membership and profile reads concurrently and returns null for non members. Keep the concurrency; call it from one place per render path.
- `src/proxy.ts`: matcher covers page routes and `/api/*`, excludes `/api/cron` and static assets. Read only; plan proposes no change.
- `getGameweekData()` call sites: `(home)`, `results`, `rumblers`, `players/[playerId]` pages and `profile/ProfileBody`. These are the pages whose traffic and vitals answer R2.

### Institutional learnings

- No `docs/solutions/` directory exists yet; nothing to carry forward. Confirmed `docs/` holds only `plans/`, and there is no `docs/brainstorms/` origin doc for this idea.

### External references

- Next.js docs on `loading.tsx`, Suspense streaming, `redirect()` in Server Components, and `notFound()` status behaviour, to confirm the fallback if the 404 verification fails.

---

## Key Technical Decisions

- Move the check, not the rule: `(onboarded)/layout.tsx` becomes a sync shell rendering `<Suspense>` around a new async `MembershipGate` server component that calls `getCurrentUser()` and redirects exactly as today. Proxy, member, and onboarded levels keep their enforcers and targets.
- Split onboarded routes into two URL neutral route groups: `(streamed)` for the five list pages behind the suspended gate, and `(blocking)` for `players/[playerId]` behind a blocking layout that awaits the gate before the page renders. This preserves the 404 status the uniform gate would risk.
- Gate fallback renders a skeleton only, with zero league content: `SkeletonRegion` plus the route neutral shape, no names, scores, or rumbler data. R4 is satisfied by construction, not by timing.
- Part (b) is verification plus a runbook, not code: both analytics components are already mounted, both packages are already in `package.json`, and page views plus web vitals fire automatically on the server rendered pages. Adding `track()` calls or routes would exceed the spec.
- No shared request caching of the gate result: each render path calls `getCurrentUser()` directly, preserving the concurrent reads and never holding a promise across requests.

---

## Open Questions

### Resolved during planning

- Do Analytics and Speed Insights need switching on in code? No. Both are mounted in `src/app/layout.tsx`; the remaining work is confirming data in the Vercel dashboard and writing the Monday runbook.
- Can the gate move without touching the proxy matcher? Yes. The proxy runs before any layout; unauthenticated traffic never reaches the gate, so its behaviour is byte for byte unchanged.
- Does the squads page need its inner `getCurrentUser()` removed after the move? No. It decides the default picker tab, not access, and stays inside its own boundary.
- Where does `/profile` sit in the new structure? Exactly where it is: in `(app)` outside `(onboarded)`, untouched.

### Deferred to implementation

- Exact Speed Insights baseline for `/` (LCP p75 cold): read from the dashboard after deploy; first Monday sets the number to beat.
- Whether Vercel Analytics lets the owner isolate the eight managers from stranger traffic cleanly: owner to confirm in the dashboard during U3; fallback is raw visitor counts with the league's known size as context.
- Visual check of the gate fallback handoff on a throttled connection: layout only, verified by eye per repo law.

---

## Implementation Units

### U1. Suspended membership gate

**Goal:** AppChrome streams before the user lookup resolves, with identical enforcement.

**Requirements:** R1, R4

**Dependencies:** None

**Files:**

- Create: `src/components/Layout/MembershipGate.tsx`
- Modify: `src/app/(app)/(onboarded)/layout.tsx`
- Test expectation: none, layout streaming change verified by eye and by status checks in U4

**Approach:**

- Add an async server component `MembershipGate` that awaits `getCurrentUser()`, calls `redirect('/profile')` when the result is null or `profileComplete` is false, and otherwise renders `children`. No props beyond `children`; no data fetching beyond the gate read; no client directive.
- Convert `(onboarded)/layout.tsx` to a sync component that renders `<Suspense>` with a skeleton only fallback (`SkeletonRegion` wrapping a neutral placeholder, no league content) around `<MembershipGate>{children}</MembershipGate>`. Keep `export const dynamic = 'force-dynamic'`.
- Keep the existing redirect target and the existing comment explaining why the group exists; extend the comment to name the new structure (suspended gate, `(blocking)` exception for the player route).

**Patterns to follow:**

- `src/app/(app)/profile/page.tsx`: session read above the boundary, everything expensive below it.
- `src/components/SkeletonRegion.tsx`: delayed reveal stays off for in-page style fallbacks; the gate fallback appears at once like other in-page fallbacks.

**Test scenarios:**

- Happy path: signed in member with complete profile loads `/`; navigation paints first, then content resolves. Verified by eye with throttled network.
- Edge case: member with incomplete profile lands on `/profile` with the onboarding heading, same as today.
- Error path: non member (valid session, no `league_members` row) lands on `/profile` seeing the not on the league list card; no standings, rumbler, or squad content paints at any point.
- Integration: signed out request still 307s to `/auth/sign-in` via the proxy before any layout renders.

**Verification:**

- `pnpm lint`, `pnpm typecheck`, `pnpm test` pass.
- Throttled hard load of `/` shows header, sidebar or bottom nav, and footer before the standings resolve.

---

### U2. Blocking route group for the player page

**Goal:** Keep `/players/[playerId]` 404 status at 404 while every other onboarded route streams.

**Requirements:** R1, R4

**Dependencies:** U1 (reuses the gate read logic)

**Files:**

- Modify (git moves, no import changes; all imports use the `@/` alias): `src/app/(app)/(onboarded)/(home)` to `src/app/(app)/(onboarded)/(streamed)/(home)`; same `(streamed)` nesting for `results`, `rumblers`, `squads`, `premier-league`; `src/app/(app)/(onboarded)/players` to `src/app/(app)/(onboarded)/(blocking)/players`
- Create: `src/app/(app)/(onboarded)/(blocking)/layout.tsx`
- Modify: `src/app/(app)/(onboarded)/layout.tsx` (shared comment naming both subgroups)
- Test expectation: none, routing structure change verified by status checks in U4

**Approach:**

- Move the six route directories with `git mv` so history follows. URLs are unchanged because route groups are URL neutral. `loading.tsx` files move with their routes.
- `(streamed)` routes inherit the suspended gate from U1 with no per route edits.
- `(blocking)/layout.tsx` is async, awaits `getCurrentUser()`, redirects to `/profile` on null or incomplete profile, and renders children with no Suspense boundary of its own, reproducing today's ordering (gate, then page existence check, then first flush) for the one route that can 404.
- Share the null and incomplete check shape with `MembershipGate`; a tiny shared helper is acceptable but two parallel three line checks are preferable to a new abstraction if the helper would need its own module.

**Patterns to follow:**

- `src/app/(app)/(onboarded)/(home)/loading.tsx` comment: the `(home)` group precedent for scoping a streaming boundary away from `/players/**`.
- `src/app/(app)/(onboarded)/players/[playerId]/page.tsx`: `parseLeagueEntryId` plus `notFound()` ordering stays exactly as found.

**Test scenarios:**

- Happy path: `/players/<known entry>` renders the season view for a signed in member.
- Edge case: `/players/99999` returns HTTP 404 and renders the not found page, checked with curl, not just by eye.
- Error path: `/players/<known entry>` for a non member redirects to `/profile`, same as today.
- Integration: `/`, `/results`, `/rumblers`, `/squads`, `/premier-league` keep working at identical URLs after the moves, including their `loading.tsx` shells on soft navigation.

**Verification:**

- `curl -o /dev/null -s -w '%{http_code}'` on a signed in session returns 404 for an unknown player id and 200 for a known one.
- `pnpm lint`, `pnpm typecheck`, `pnpm test` pass.

---

### U3. Measurement spine runbook

**Goal:** Turn the already firing analytics into Monday answers for weekly return and cold-load time.

**Requirements:** R2, R3

**Dependencies:** None (runs in parallel with U1 and U2)

**Files:**

- Create: `docs/analytics-runbook.md`
- Test expectation: none, documentation plus dashboard verification

**Approach:**

- Verify in the Vercel dashboard that Analytics page views and Speed Insights vitals are collecting for the production deployment (both components ship in the root layout, so a missing stream means a project setting, not a code gap; record the outcome in the runbook).
- Write the runbook mapping each strategy metric to a dashboard read with no new code: weekly return as visitors and page views on `/` in the 48 hours after a gameweek settles; cold-load standings time as Speed Insights LCP p75 on `/`; season completion as monthly visitor retention into May. Note the eight person denominator and the accepted noise (ad blockers, preview deployments).
- Record the first readings as the baseline the strategy currently lacks; leave the owner TODO in `agents/STRATEGY.md` to be cleared in a follow up once baselines exist.

**Patterns to follow:**

- `agents/STRATEGY.md` key metrics section: same three metric names and definitions, no redefinition.

**Test scenarios:**

- Happy path: owner follows the runbook on the first Monday after a settled gameweek and records all three readings in under ten minutes.
- Edge case: a gameweek still in flight on Monday morning; runbook states which settled marker to wait for before counting the 48 hour window.
- Integration: no new dependency, route, or client fetch appears in the diff for this unit.

**Verification:**

- `pnpm format:check` passes for the new doc.
- Dashboard shows live Analytics and Speed Insights streams for production.

---

### U4. Contract verification pass

**Goal:** Prove R1 to R4 hold end to end on the deployed shaped local build.

**Requirements:** R1, R2, R3, R4

**Dependencies:** U1, U2, U3

**Files:**

- Test expectation: none, verification only, no source changes expected

**Approach:**

- Run the full check suite: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm format:check`.
- With `PORT=3100 pnpm start`, curl the status codes: `/` signed out (307 to sign-in), unknown player id signed in (404), known player id signed in (200), non member signed in (`/profile` content, no league data in the streamed bytes).
- Confirm no new dependency or route: `git status` shows only the planned moves, the gate component, the two layouts, and the runbook; `package.json` untouched; no new `api/` directory.
- Eye check one streamed route throttled: chrome first, skeleton second, content third, with no layout shift beyond what the existing skeletons already produce.

**Patterns to follow:**

- Agents law verification commands: lint, typecheck, test, format check, then start on port 3100 (port 3000 may belong to another project).

**Test scenarios:**

- Happy path: all four commands green and all curl statuses as listed above.
- Edge case: soft navigation between streamed routes still shows each route's `loading.tsx` shell without a full page reload.
- Error path: fix forward, never around: any 200 on the unknown player id sends the implementer back to U2 (blocking layout must await before flush); any league content in non member streamed bytes sends them back to U1 (fallback must be skeleton only).
- Integration: `/api/cron/revalidate` still excluded from the proxy gate and still bearer guarded; nothing in this plan touches it.

**Verification:**

- All checks green and the status table recorded in the pull request description.

---

## System-Wide Impact

- **Interaction graph:** `(app)/layout.tsx` (AppChrome) now flushes before `(onboarded)` children resolve on streamed routes. `error.tsx` in `(app)` still catches render throws below the gate; `not-found.tsx` at the root still serves unmatched URLs with chrome.
- **Error propagation:** gate failures (database unreachable) surface through the route error boundary as today; the change is timing, not error shape. Redirects keep flowing through Next.js redirect handling.
- **State lifecycle risks:** none new. No promise is memoised; `getCurrentUser()` runs per request as today with its two concurrent reads. The squads page inner session read is unchanged and harmless.
- **API surface parity:** no API routes added, removed, or altered. Server Actions untouched. Identity still comes from the session only.
- **Integration coverage:** unit tests cannot cover layout streaming (no jsdom per repo law); U4 curl checks plus eye verification are the coverage. The 404 status check is the load bearing assertion.
- **Unchanged invariants:** three auth levels and their enforcers; proxy matcher; `isProfileComplete` as the single completeness decision; PageShell plus in-page Suspense on every data page; `loading.tsx` placement; semantic tokens and sentence case; pnpm and Node 22.

---

## Risks & Dependencies

| Risk                                                                                     | Mitigation                                                                                                                                            |
| ---------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Layout Suspense commits 200 on `/players/unknown`, defeating the 404                     | U2 isolates the player route in `(blocking)` with no boundary above it; U4 curl asserts 404 before merge                                              |
| Non members glimpse chrome before the redirect lands                                     | Accepted and bounded: chrome holds no league data, gate fallback is skeleton only, redirect target unchanged; R4 constrains content, not paint timing |
| Redirect thrown after partial flush behaves differently on hard versus client navigation | Both land on `/profile`; U4 checks the signed out 307 and the non member destination explicitly                                                       |
| Analytics dashboard cannot isolate the eight from stranger traffic                       | Runbook records raw counts against the known denominator of eight; owner confirms filtering during U3                                                 |
| Speed Insights has no cold-load baseline until the first Monday                          | U3 records first readings as baseline; strategy TODO cleared in follow up, not in this plan                                                           |
| Route group moves break a relative import                                                | All cross directory imports use the `@/` alias; U4 typecheck plus route smoke checks confirm                                                          |

---

## Documentation / Operational Notes

- Update the `(onboarded)/layout.tsx` comment to describe the suspended gate and the `(blocking)` exception so the next reader does not reunify them.
- New runbook at `docs/analytics-runbook.md` becomes the Monday procedure; link it from the strategy metrics TODO when baselines land.
- No rollout flag needed: change is structural rendering order with identical enforcement; deploy normally and run U4 against production (status spot checks only, no league data assertions beyond what is public to members).
- Vercel Analytics and Speed Insights data appears only for the deployed host; local `pnpm start` verification covers streaming and statuses, dashboard verification covers measurement.

---

## Sources & References

- No origin requirements doc: confirmed no `docs/brainstorms/` directory exists; this plan proceeds from the idea spec directly.
- Related code: `src/app/(app)/(onboarded)/layout.tsx`, `src/app/(app)/layout.tsx`, `src/components/Layout/AppChrome.tsx`, `src/components/Layout/PageShell.tsx`, `src/app/layout.tsx`, `src/proxy.ts`, `src/server/auth/server.ts`, `src/app/(app)/profile/page.tsx`, `src/app/(app)/(onboarded)/players/[playerId]/page.tsx`, `src/app/(app)/(onboarded)/squads/page.tsx`, `src/components/SkeletonRegion.tsx`
- Related docs: `agents/AGENTS.md`, `agents/ARCHITECTURE.md` (sections 3 and 8), `agents/STRATEGY.md` (key metrics and tracks), `docs/plans/2026-08-14-001-feat-db-reference-cache-plan.md`
- External docs: Next.js App Router docs for streaming, Suspense, `loading.tsx`, `redirect()`, and `notFound()`

---
name: Better Draft — Architecture
last_updated: 2026-08-13
---

# Architecture

This is the system map. It tells you **where things live, how a request flows, and which
file to open first** when you start a new task. It is one of four backbone documents in
[`agents/`](./):

| Doc                                                | Answers                                                   |
| -------------------------------------------------- | --------------------------------------------------------- |
| [`STRATEGY.md`](./STRATEGY.md)                     | _What_ are we building, for whom, and how do we win?      |
| [`AGENTS.md`](./AGENTS.md)                         | _How_ do we work — conventions, language, the rules.      |
| [`ARCHITECTURE.md`](./ARCHITECTURE.md) (this file) | _Where_ does code live and _how_ does a request flow?     |
| [`FRONTEND.md`](./FRONTEND.md)                     | UI-specific patterns (shadcn primitives, charts, tables). |

If `STRATEGY.md` is the destination and `AGENTS.md` is the highway code, this file is the map.

---

## 1. System overview

Better Draft is a **Next.js 16 App Router application** backed by **Neon Postgres**
(accessed with Drizzle) and **Neon Auth**. It is deployed to Vercel at
[draftrank.vercel.app](https://draftrank.vercel.app).

Two audience-bounded zones:

- **Public** — the standings, results, rumbler and player pages. No sign-in, same view for
  everyone.
- **Members** (`/profile`, and the bets work to come) — signed in via Neon Auth and on the
  `league_members` mapping table.

The product surface:

- `/` — the standings table (F1 scoring) and position distribution
- `/results` — per-gameweek results, charts and detail views
- `/rumblers` — the last-place hall of shame
- `/squads` — who owns whom, with the draft round each player went in
- `/players/[playerId]` — one manager's season: performance, positions, form
- `/profile` — claim which manager you are (members only)

**The split of ownership matters.** The league roster, scores and fixtures are upstream's
and are read from the FPL API. What the database holds is exactly two things: **a cache of
immutable facts** (finished gameweek scores, so we don't refetch a season of history on
every cold start) and **data with no upstream source at all** (profiles, and later bets).
The F1 scoring table itself is neither — it is _our policy_, and it lives in code.

---

## 2. The trust boundary

The upstream APIs hold no secrets — they are public and unauthenticated, and that half of
the boundary exists for **cost and cohesion**. The database half is different: the
connection string is a real credential, and it must never reach the browser.

```
┌──────────────────────────── browser ─────────────────────────────┐
│  React client components ('use client')                          │
│     • leaves only: receive data as props, never fetch it         │
│     • @/lib/auth/client  → sign in/out only, never data          │
│     • NEVER imports @/server/** or @/utils/{fpl-api,gameweek-data}│
│       → enforced by `import 'server-only'`                       │
└─────────────────────────────────│─────────────────────────────────┘
                                  │  HTTP (cookies carry the session)
┌─────────────────────────────────▼─────────────────────────────────┐
│  Next.js server (App Router)                                     │
│   src/app/**/page.tsx        ── Server Components read directly   │
│   src/app/api/**/route.ts    ── shapes responses, owns { error }  │
│   src/server/actions/**      ── 'use server'; validates, writes   │
│   src/server/auth/server.ts  ── session + league_members gate     │
│   src/server/data/**         ── the DAL: one module per domain    │
│   src/server/db/client.ts    ── ONLY file that builds a db client │
│   src/utils/gameweek-data.ts ── score · rank · aggregate          │
│   src/utils/fpl-api.ts       ── ONLY file with upstream URLs      │
└──────────────│──────────────────────────────│─────────────────────┘
               ▼                              ▼
   Neon Postgres (+ neon_auth)   draft.premierleague.com · fantasy.…
```

Two rules follow, and neither has exceptions:

- **`src/server/db/client.ts` is the only file that constructs a database client**, and the
  only one that reads `NEON_CONNECTION_STRING_PROD`. Everything else goes through
  `src/server/data/**`. Never import `@/server/db/**` from a route, action or page.
- **Identity is resolved server-side**, in `src/server/auth/server.ts`, from the session —
  never from a form field or a client-supplied id. `getCurrentUser()` returns `null` for a
  session whose email has no row in `league_members`, so callers cannot accidentally treat
  a stranger's valid Google session as a member.

Full rules, and the allowed/forbidden table:
[`AGENTS.md` — the core boundary](./AGENTS.md#the-core-boundary-upstream-api-access-is-server-only-always).

---

## 3. Request lifecycle

Every data-bearing page follows the same path:

1. **The page shell renders immediately** — heading and layout, no data needed. The
   data-dependent subtree sits behind an in-page `<Suspense>`, so the response starts
   streaming at once.
2. **An `async` child Server Component calls `getGameweekData()`** (or the DAL) directly.
   No HTTP hop, no serialisation of a request we are already inside.
3. **`getGameweekData()`** checks the in-memory TTL cache, then the in-flight promise, then
   does the work: league details + event status, then whichever finished gameweeks are not
   already in Postgres, then scoring, ranking and aggregation.
4. **The result is passed down as plain props.** Client components are leaves that own
   interaction only — tab state, the gameweek selector, chart rendering.
5. **Failures land on the boundaries**, not in component state: a throw hits
   `src/app/error.tsx`, and `notFound()` hits `src/app/not-found.tsx` with a real 404.

Two consequences worth stating outright:

- **The HTML contains the content.** View source on `/` and the eight managers are there.
- **One read per page.** `/` previously issued two overlapping browser fetches
  (`/api/standings` and `/api/gameweek-data`); both trees now render from a single object.

> **Where the Suspense boundary goes matters.** It belongs _inside the page_, not in a
> `loading.tsx`. A `loading.tsx` creates a boundary for its segment and everything beneath
> it, and flushing that shell commits the HTTP status before the page has decided whether
> it is a 404 — so `/players/99999` renders the not-found page with a **200**. Verified
> against Next 16.3.0.

---

## 4. Folder map

```
.
├── CLAUDE.md                  → one line: @agents/AGENTS.md
├── agents/                    ← you are here
├── public/                    static assets, favicons
├── FPL Draft/                 Bruno API collection (prem/ = upstream, app/ = localhost)
├── .env.example               committed template — FPL_LEAGUE_ID
├── .env.local                 gitignored, holds the real league ID
├── eslint.config.mjs          flat config; the warning backlog is declared here
├── postcss.config.mjs         @tailwindcss/postcss only (no autoprefixer in v4)
├── components.json            shadcn/ui — config: "", css: src/app/globals.css
├── drizzle.config.ts          migrations; schemaFilter: ['public'] only
├── drizzle/                   generated SQL migrations — never edit an applied one
└── src/
    ├── app/
    │   ├── layout.tsx         root shell: fonts, nav, footer, analytics
    │   ├── globals.css        ★ Tailwind v4 config lives here (@theme inline)
    │   ├── page.tsx           / — standings
    │   ├── results/           /results
    │   ├── rumblers/          /rumblers
    │   ├── players/[playerId]/  /players/:id
    │   ├── error.tsx          route-level error boundary (retry re-renders on the server)
    │   ├── not-found.tsx      404 page — reached via notFound()
    │   └── api/               Neon Auth + 4 consumer-less GET handlers (see API.md)
    ├── components/
    │   ├── ui/                shadcn primitives — chart.tsx is the recharts wrapper
    │   ├── TableView/         standings, draft results, position tables, base-table
    │   ├── PlayerView/        per-player charts, summary, form guide
    │   ├── RumblerView/       rumbler cards, dashboard, frequency chart
    │   ├── SquadView/         squad card (pure server, no client JS)
    │   ├── Layout/            HeaderNav, MobileNav, Footer
    │   └── DetailView/        gameweek summary, score chart, match odds
    ├── server/                ★ server-only. Never imported by a client component.
    │   ├── db/
    │   │   ├── client.ts      ★ the ONLY file that builds a db client
    │   │   └── schema.ts      Drizzle schema for `public` (not `neon_auth`)
    │   ├── data/              the DAL — one module per domain
    │   │   ├── gameweeks.ts   persisted finished-gameweek facts
    │   │   ├── league-members.ts  ★ curated email -> manager mapping
    │   │   └── profiles.ts    display name and bio
    │   ├── actions/           'use server' — validate, write, revalidate
    │   │   └── profile.ts
    │   └── auth/
    │       └── server.ts      ★ session + league_members gate
    ├── interfaces/
    │   ├── fpl.ts             ★ branded IDs + upstream payload shapes
    │   └── players.ts, match.ts, standings.ts
    ├── lib/
    │   ├── utils.ts           cn()
    │   └── auth/client.ts     browser auth client (sign in/out only)
    └── utils/
        ├── fpl-api.ts         ★ server-only. Upstream URLs + FPL_LEAGUE_ID. The gateway.
        ├── gameweek-data.ts   ★ the data layer: fetch, score, rank, aggregate, cache
        ├── league.ts          fetchLeagueDetails — the typed league read
        ├── squads.ts          ownership + draft provenance, joined
        ├── player-profile.ts  one manager's season, derived (pure)
        ├── cache.ts           in-memory TTL Map
        ├── formatMatches.ts   (head-to-head only — currently unused)
        ├── lossBlurb.ts       rumbler banter strings
        └── tailwindVars.ts    colour constants for charts
```

★ = load-bearing. Read these first.

---

## 5. The scoring model

The app's whole reason to exist. In `src/utils/gameweek-data.ts`:

1. For each completed gameweek, each entry's score is the sum of `total_points` for its
   **starting XI only** (`pick.position <= 11`).
2. The 8 entries are ranked within that gameweek by score, ties sharing the better rank
   (`assignRanks`).
3. Rank converts to F1 points: `[20, 15, 12, 10, 8, 6, 4, 2]`.
4. Season `f1_score` is the sum; `f1_ranking` is the ordering of those sums.
5. The **rumbler** for a gameweek is whoever holds the worst rank in it (ties included).

`total_points` on a player is the _official_ league total, taken straight from
`standings[].total` — it is shown alongside the F1 score, not used to compute it.

> **Facts vs. policy.** Ranks and points are facts from upstream. The F1 table is _our
> policy_. Keep the policy in code (`F1_POINTS`) so changing it is a one-line edit — and if
> results are ever persisted, persist the facts, not the derived F1 score.

---

## 6. Caching, and what it costs

Three layers now sit in front of the upstream APIs:

| Layer                  | Where                      | TTL     | Survives a cold start?  |
| ---------------------- | -------------------------- | ------- | ----------------------- |
| Next.js `fetch` cache  | `.next/cache`              | 300 s   | Yes (and across builds) |
| In-memory result cache | `src/utils/cache.ts` Map   | 3 600 s | **No**                  |
| **Finished gameweeks** | **Neon `gameweek_scores`** | forever | **Yes**                 |

Plus promise deduplication in `getGameweekData()`, so concurrent requests on one instance
share a single computation.

**The cost this removes:** recomputing a whole season is `2 + 9 × completedGameweeks`
upstream calls — **344 by May**. Both in-process caches are module scope, so every new
serverless instance on Vercel used to pay that bill in full.

`getGameweekData()` now reads the gameweeks it already holds from Postgres, fetches only
the gap, and stores what it fetched. Steady state is therefore **9 calls a week** (one new
gameweek), not 344 — and a cold start costs one query rather than a full rebuild. The
batching still applies to whatever is genuinely missing, so a first run, or a rebuilt
database, behaves exactly as it always did.

The guard that keeps this safe: a gameweek that produced **no** performances is never
recorded. An unscored gameweek must stay absent so it is retried, rather than being frozen
into the database as a set of zeros — which is the persistent version of the bug where all
eight managers tied on rank 1 and banked a win.

> [!WARNING]
> The Next.js `fetch` cache **persists in `.next/cache` across builds**. A stale
> `event-status` from the previous season survived a rebuild and was served with HTTP 200
> long after upstream started 404ing, fabricating 35 gameweeks of results. `rm -rf .next`
> before trusting any data-shape debugging.

### Where to draw the persistence line

The open question is what to store rather than re-derive. The line that falls out of the
data itself:

| Data                                             | Mutability                       | Verdict                                             |
| ------------------------------------------------ | -------------------------------- | --------------------------------------------------- |
| A **finished** gameweek's scores and ranks       | Immutable once `leagues_updated` | **Persist.** Write once, read forever.              |
| The **in-flight** gameweek                       | Changes every few minutes        | **Read live.** Never cache hard.                    |
| League entries (names, teams)                    | Changes ~never mid-season        | Read live; cheap, one call.                         |
| Clubs, fixtures, element metadata                | Changes rarely                   | Read live behind a long TTL.                        |
| The **F1 points table**                          | Our policy, not a fact           | **Keep in code.** Never in a DB.                    |
| Profiles, weekly bets, email subscriptions       | No upstream source exists        | **Persist.** Nothing else can.                      |
| Who is in the league, and which manager they are | Curated by an admin              | **Persist.** Upstream has no notion of our members. |

The win is concentrated in row one: persisting finished gameweeks turns a 344-call cold
recompute into a single indexed query, and makes the whole season's history available
instantly regardless of instance age. Everything else is already cheap.

The trap to avoid is persisting **derived** values. Store the facts — gameweek, league
entry, points, rank — and compute the F1 score from them at read time. Store `f1_score` and
the day you tune the points table you own a backfill.

**This is implemented**, in `src/server/data/gameweeks.ts`. Rows one, six and seven of the
table above are the tables in `public`; every other row still reads live.

### Everything persisted is scoped by league

A league id **is** a season id. A renewed league gets a new id, and its
`league_entries[].id` and `entry_id` values are minted fresh alongside it — most of ours
were issued in one block the day the league formed, and both previous league ids now
return 404.

Note the ids are not even contiguous _within_ a season: a late joiner has league entry
`40460` against everyone else's `39836`–`39842`. Never infer anything from an id's value —
not order, not membership, not adjacency.

So `league_id` is part of the key on every persisted table:

| Table             | Key                                                         |
| ----------------- | ----------------------------------------------------------- |
| `gameweek_scores` | PK `(league_id, gameweek, league_entry)`                    |
| `gameweeks`       | PK `(league_id, gameweek)`                                  |
| `league_members`  | PK `(league_id, email)`, unique `(league_id, league_entry)` |
| `profiles`        | PK `(user_id)` — deliberately season-independent            |

Without it, next season's gameweek 1 collides with this season's and the cache serves the
wrong year's scores, and a member mapping survives pointing at a number that may by then
belong to somebody else — wrong, while still satisfying every constraint.

Every query in `src/server/data/**` filters on `getLeagueId()`. Last season's rows are
therefore **inert rather than wrong**: they stay put and are never read.

**The email is the stable identity across seasons; the entry id is not.** That is why
`profiles` is keyed on the Neon Auth user id and holds no league entry — display names and
bios survive the August rollover untouched, while the manager mapping is re-seeded. See
[`league-members.README.md`](../league-members.README.md) for the annual procedure.

### Migrations

Schema changes are Drizzle migrations under `drizzle/`:

```bash
pnpm db:generate   # write a migration from the schema
pnpm db:migrate    # apply it
pnpm db:studio     # browse the data
```

Two rules:

- **Never edit an applied migration** — add a new one.
- **`drizzle.config.ts` sets `schemaFilter: ['public']`.** The `neon_auth` schema is owned
  and migrated by Neon Auth. Pointing drizzle-kit at it would make it try to "correct"
  tables it does not own. We read from `neon_auth`; we never define it.

For the same reason `profiles.user_id` has **no foreign key** to `neon_auth.user`, even
though it holds that id. Neon Auth is beta and manages its own migrations; a hard
cross-schema constraint would make its rebuilds our problem. With eight known members the
integrity cost of leaving it off is nil.

---

## 7. Where to start — entry points by task

| Task                                    | Start here                                | Then                                                          |
| --------------------------------------- | ----------------------------------------- | ------------------------------------------------------------- |
| Add a new upstream call                 | `src/utils/fpl-api.ts`                    | Document the shape in [`API.md`](./API.md)                    |
| Change how scoring or ranking works     | `src/utils/gameweek-data.ts`              | `F1_POINTS`, `assignRanks`, §5 above                          |
| Add an API route                        | `src/app/api/<name>/route.ts`             | Copy the `{ error, message }` contract                        |
| Add a page                              | `src/app/<route>/page.tsx`                | [`FRONTEND.md`](./FRONTEND.md)                                |
| Add a table                             | `src/components/TableView/base-table.tsx` | `table-configs.tsx`                                           |
| Add a chart                             | `src/components/ui/chart.tsx`             | An existing chart in `PlayerView/`                            |
| Change theme colours or radii           | `src/app/globals.css` (`@theme inline`)   | [`FRONTEND.md`](./FRONTEND.md) — tokens, not hex              |
| Add a shadcn primitive                  | `pnpm dlx shadcn@latest add <component>`  | `components.json` is already v4-shaped                        |
| Debug "the data looks like last season" | `rm -rf .next`                            | §6 above, then [`API.md`](./API.md)                           |
| Point the app at a different league     | `.env.local` → `FPL_LEAGUE_ID`            | [`API.md`](./API.md#the-league-id-is-an-environment-variable) |
| Add a table or change the schema        | `src/server/db/schema.ts`                 | `pnpm db:generate` then `pnpm db:migrate`                     |
| Add a database read                     | `src/server/data/<domain>.ts`             | Never `@/server/db/**` from a page or route                   |
| Add a write                             | `src/server/actions/<domain>.ts`          | Validate, call the DAL, `revalidatePath`                      |
| Gate something behind sign-in           | `src/server/auth/server.ts`               | `getCurrentUser()` is `null` if not allowlisted               |
| Add someone to the league               | `league-members.json`                     | `pnpm db:seed:members`                                        |

---

## 8. What's not here yet

Tracked in [`STRATEGY.md`](./STRATEGY.md#tracks).

- ~~**Server Components for the public pages.**~~ Done — every page reads its own data.
- ~~**Typed upstream payloads.**~~ Done — `src/interfaces/fpl.ts`.
- ~~**Squads.**~~ Done — `/squads`, from `element-status` joined to the draft choices.
- **Weekly bets.** The reason profiles exist. Needs a `bets` table (proposer, opponent,
  gameweek, stake/wager text, outcome) and a resolution flow. Profiles and the
  server-action write path are the foundation; the UX is still loosely specified.
- **Weekly results email.** A scheduled job reading the finished gameweek and sending a
  summary. WhatsApp delivery is unresolved — the Business API needs a template and a
  number, so a shareable web summary may be the pragmatic first step.
- **Production auth config.** `trusted_origins` on the Neon Auth project is currently empty
  and `allow_localhost` is on. The Vercel origin must be added before sign-in works in
  production.
- **Tests and CI.** See [`AGENTS.md` — Testing](./AGENTS.md#testing). The DAL and the
  scoring logic are both pure enough to test cheaply.

When you add any of these, update the folder map and the entry-point table in the same
change.

---

## Related documents

- [`STRATEGY.md`](./STRATEGY.md) — product direction
- [`AGENTS.md`](./AGENTS.md) — conventions (the law)
- [`FRONTEND.md`](./FRONTEND.md) — UI-specific patterns
- [`API.md`](./API.md) — endpoint and payload reference
- [`TECH-STACK.md`](./TECH-STACK.md) — locked stack decisions

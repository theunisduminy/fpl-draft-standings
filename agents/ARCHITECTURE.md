---
name: Better Draft — Architecture
last_updated: 2026-08-12
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

Better Draft is a **Next.js 16 App Router application** with **no database and no
authentication**. Every fact it displays is derived, at request time, from two public
Fantasy Premier League APIs. It is deployed to Vercel at
[draftrank.vercel.app](https://draftrank.vercel.app).

There is one audience-bounded zone: **the whole app is public and read-only.** Anyone with
the URL sees the same league.

The product surface is four routes:

- `/` — the standings table (F1 scoring) and position distribution
- `/results` — per-gameweek results, charts and detail views
- `/rumblers` — the last-place hall of shame
- `/players/[playerId]` — one manager's season: performance, positions, form

Everything authoritative lives **upstream**. This app owns no data — it owns a _scoring
opinion_ (rank each gameweek, award F1 points) and the presentation of it.

---

## 2. The trust boundary

There are no secrets here — both upstream APIs are public and unauthenticated. The boundary
exists for **cost and cohesion**, not confidentiality, and it is still the law.

```
┌──────────────────────────── browser ─────────────────────────────┐
│  React client components ('use client')                          │
│     • useTableData() → fetchWithDelay() → apiHelper()            │
│     • fetch('/api/...')            → for all data                │
│     • NEVER imports @/utils/fpl-api or @/utils/gameweek-data     │
│       → enforced by `import 'server-only'`                       │
└─────────────────────────────────│─────────────────────────────────┘
                                  │  HTTP
┌─────────────────────────────────▼─────────────────────────────────┐
│  Next.js server (App Router)                                     │
│   src/app/api/**/route.ts   ── shapes responses, owns { error }   │
│   src/utils/gameweek-data.ts ── fetch · score · rank · aggregate  │
│                                 TTL cache + promise dedup         │
│   src/utils/fpl-api.ts       ── ONLY file with upstream URLs and  │
│                                 FPL_LEAGUE_ID (`server-only`)     │
└─────────────────────────────────│─────────────────────────────────┘
                                  ▼
        draft.premierleague.com   ·   fantasy.premierleague.com
```

Full rules, and the allowed/forbidden table:
[`AGENTS.md` — the core boundary](./AGENTS.md#the-core-boundary-upstream-api-access-is-server-only-always).

---

## 3. Request lifecycle

Every data-bearing page follows the same path today:

1. **A page renders** as a client component and mounts a table or chart.
2. **`useTableData({ endpoints })`** (`src/hooks/use-table-data.ts`) fires in a `useEffect`,
   calling `fetchWithDelay()` → `apiHelper()` → `fetch('/api/<endpoint>')`.
3. **The route handler** (`src/app/api/<name>/route.ts`) calls `getGameweekData()` and
   returns a slice of it. On failure it returns `{ error, message }` with a 500.
4. **`getGameweekData()`** checks the in-memory TTL cache, then the in-flight promise, then
   does the work: league details + event status, then per-gameweek live data and picks,
   then scoring, ranking and aggregation.
5. **`apiHelper()`** inspects the parsed body for an `error` key and throws, so upstream
   failures surface as an error state rather than an empty table.

> **This is the shape we are moving away from.** Every read is a client fetch in an effect,
> which means a spinner on every page load and no server rendering of real content. The
> Server Components refactor in [`STRATEGY.md`](./STRATEGY.md#tracks) replaces steps 1–3
> with an `async` page calling `getGameweekData()` directly.

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
└── src/
    ├── app/
    │   ├── layout.tsx         root shell: fonts, nav, footer, analytics
    │   ├── globals.css        ★ Tailwind v4 config lives here (@theme inline)
    │   ├── page.tsx           / — standings
    │   ├── results/           /results
    │   ├── rumblers/          /rumblers
    │   ├── players/[playerId]/  /players/:id
    │   └── api/               8 GET route handlers (see API.md)
    ├── components/
    │   ├── ui/                shadcn primitives — chart.tsx is the recharts wrapper
    │   ├── TableView/         standings, draft results, position tables, base-table
    │   ├── PlayerView/        per-player charts, summary, form guide
    │   ├── RumblerView/       rumbler cards, dashboard, frequency chart
    │   ├── Layout/            HeaderNav, MobileNav, Footer
    │   └── DetailView/        gameweek summary, score chart, match odds
    ├── hooks/
    │   └── use-table-data.ts  ★ the client-fetch hook every view uses
    ├── interfaces/            players.ts, match.ts, standings.ts
    ├── lib/utils.ts           cn()
    └── utils/
        ├── fpl-api.ts         ★ server-only. Upstream URLs + FPL_LEAGUE_ID. The gateway.
        ├── gameweek-data.ts   ★ the data layer: fetch, score, rank, aggregate, cache
        ├── cache.ts           in-memory TTL Map
        ├── apiHelper.ts       client-side fetch wrapper + error detection
        ├── fetchWithDelay.ts  parallel multi-endpoint fetch
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

Two layers sit in front of the upstream APIs:

| Layer                  | Where                    | TTL     | Survives a cold start?  |
| ---------------------- | ------------------------ | ------- | ----------------------- |
| Next.js `fetch` cache  | `.next/cache`            | 300 s   | Yes (and across builds) |
| In-memory result cache | `src/utils/cache.ts` Map | 3 600 s | **No**                  |

Plus promise deduplication in `getGameweekData()`, so concurrent requests on one instance
share a single computation.

**The cost that matters:** a full recompute is `2 + 9 × completedGameweeks` upstream calls —
**344 by the end of a season**. Because the `Map` is module scope, every new serverless
instance on Vercel pays that bill in full. Batching (5 gameweeks at a time) bounds the
concurrency, not the total.

> [!WARNING]
> The Next.js `fetch` cache **persists in `.next/cache` across builds**. A stale
> `event-status` from the previous season survived a rebuild and was served with HTTP 200
> long after upstream started 404ing, fabricating 35 gameweeks of results. `rm -rf .next`
> before trusting any data-shape debugging.

### Where to draw the persistence line

The open question is what to store rather than re-derive. The line that falls out of the
data itself:

| Data                                       | Mutability                       | Verdict                                |
| ------------------------------------------ | -------------------------------- | -------------------------------------- |
| A **finished** gameweek's scores and ranks | Immutable once `leagues_updated` | **Persist.** Write once, read forever. |
| The **in-flight** gameweek                 | Changes every few minutes        | **Read live.** Never cache hard.       |
| League entries (names, teams)              | Changes ~never mid-season        | Read live; cheap, one call.            |
| Clubs, fixtures, element metadata          | Changes rarely                   | Read live behind a long TTL.           |
| The **F1 points table**                    | Our policy, not a fact           | **Keep in code.** Never in a DB.       |
| Profiles, weekly bets, email subscriptions | No upstream source exists        | **Persist.** Nothing else can.         |

The win is concentrated in row one: persisting finished gameweeks turns a 344-call cold
recompute into a single indexed query, and makes the whole season's history available
instantly regardless of instance age. Everything else is already cheap.

The trap to avoid is persisting **derived** values. Store the facts — gameweek, league
entry, points, rank — and compute the F1 score from them at read time. Store `f1_score` and
the day you tune the points table you own a backfill.

Because profiles, bets and weekly emails have no upstream source at all, a database is
arriving regardless. The sequencing question is only whether the gameweek cache lands with
it or after it.

> _TODO (owner)_ — decide the store (Supabase is the house default; see the Vertiqal
> `agents-setup` convention) and add `MIGRATIONS.md` when it lands.

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

---

## 8. What's not here yet

Tracked in [`STRATEGY.md`](./STRATEGY.md#tracks); none of it exists in the tree today.

- **Server Components for reads.** Pages become `async` and call `getGameweekData()`
  directly; `use-table-data.ts` and `apiHelper.ts` shrink or disappear. This is also what
  retires the `react-hooks/set-state-in-effect` warnings.
- **Typed upstream payloads.** `src/interfaces/` grows real types for league details,
  event status, live elements and picks, retiring ~27 `any`s.
- **Persistence.** A database for finished gameweeks (§6), plus the tables that profiles
  and bets require. When it lands, the server-only DAL pattern from the house
  `agents-setup` convention applies, and `MIGRATIONS.md` joins this folder.
- **Member profiles and weekly bets.** The first feature needing identity — and therefore
  the first needing auth. Note that `league_entries` gives us stable per-manager IDs to
  hang a profile off without inventing our own.
- **Weekly results email.** A scheduled job reading the finished gameweek and sending a
  summary. WhatsApp delivery is unresolved — the Business API needs a template and a
  number, so a shareable web summary may be the pragmatic first step.
- **Tests and CI.** See [`AGENTS.md` — Testing](./AGENTS.md#testing).

When you add any of these, update the folder map and the entry-point table in the same
change.

---

## Related documents

- [`STRATEGY.md`](./STRATEGY.md) — product direction
- [`AGENTS.md`](./AGENTS.md) — conventions (the law)
- [`FRONTEND.md`](./FRONTEND.md) — UI-specific patterns
- [`API.md`](./API.md) — endpoint and payload reference
- [`TECH-STACK.md`](./TECH-STACK.md) — locked stack decisions

# AGENTS.md — How We Work (The Law)

This file defines the rules and patterns that **all** contributors — human and AI — must
follow in this codebase. These are not suggestions. They are the law. Read this before you
write or change anything non-trivial.

---

## Backbone documents

Four documents are peers. Each answers a different question. Read the one that matches your
task; when in doubt, start here.

| Document                             | Answers                                                      |
| ------------------------------------ | ------------------------------------------------------------ |
| [STRATEGY.md](./STRATEGY.md)         | **What** we're building, who for, and how we measure success |
| **AGENTS.md** (this file)            | **How** we work: conventions, language, the rules (the law)  |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | **Where** code lives and **how** a request flows             |
| [FRONTEND.md](./FRONTEND.md)         | Frontend-specific UI patterns that extend this file          |

Supporting reference docs, read on demand:

- [API.md](./API.md) — every upstream and internal endpoint, the shapes they return, and the
  season-lifecycle traps. **Read this before writing any `fetch()`.**
- [TECH-STACK.md](./TECH-STACK.md) — locked stack decisions, versions, and rationale

### Precedence

If guidance conflicts, **AGENTS.md wins** over the implementation docs (ARCHITECTURE.md,
FRONTEND.md, API.md, TECH-STACK.md). FRONTEND.md defers to this file wherever they overlap.
If this file conflicts with [STRATEGY.md](./STRATEGY.md), that's a strategy/execution
mismatch — stop and raise it with a human rather than guessing which one is right.

---

## Package manager

Always use **`pnpm`** — never `npm` or `yarn`. The version is pinned in `package.json`
(`"packageManager": "pnpm@10.28.2"`) and the lockfile is `pnpm-lock.yaml`. Commit the
lockfile with any dependency change, and never hand-edit it.

If your shell's `pnpm` is a different major version you will hit
`ERR_PNPM_UNEXPECTED_STORE`. Use `corepack pnpm <cmd>` — the pin makes corepack fetch the
right version.

## Runtime

**Node.js 22** (developed against v22.18.0; Next 16 requires `>=20.9.0`).

> _TODO (owner)_ — there is no `.nvmrc` and no CI. Add both so local, CI, and Vercel agree.

---

## The core boundary: upstream API access is server-only, always

**Rule: the browser never calls `draft.premierleague.com` or `fantasy.premierleague.com`
directly.** All upstream access flows through server-only modules, and the browser talks
only to our own `/api/*` routes.

```
  browser (client components)
     │  fetch('/api/standings')  ← via apiHelper() / useTableData()
     ▼
  src/app/api/**/route.ts        ── shapes the response, owns error contract
     │
     ▼
  src/utils/gameweek-data.ts     ── the data layer: fetch, score, rank, aggregate
     │                              (in-memory TTL cache + promise dedup)
     ▼
  src/utils/fpl-api.ts           ── `import 'server-only'`
     │                              the ONLY place upstream URLs and FPL_LEAGUE_ID live
     ▼
  draft.premierleague.com  /  fantasy.premierleague.com
```

- **`src/utils/fpl-api.ts` is the single gateway.** It is the only file allowed to contain
  an upstream URL, and the only file that reads `FPL_LEAGUE_ID`. It starts with
  `import 'server-only'`, so it fails the build if pulled into a client bundle.
- **`FPL_LEAGUE_ID` is never `NEXT_PUBLIC_`.** Read it through `getLeagueId()`, lazily, so a
  missing value fails the request rather than `next build`.
- **API routes never build URLs themselves.** They call `fplApi.*` or `getGameweekData()`.

### Allowed vs forbidden

| Allowed                                                   | Forbidden                                                                 |
| --------------------------------------------------------- | ------------------------------------------------------------------------- |
| A route handler importing `getGameweekData()` or `fplApi` | A client component fetching `draft.premierleague.com` directly            |
| A client component calling `apiHelper('standings')`       | A client component importing `@/utils/fpl-api` or `@/utils/gameweek-data` |
| Adding a new endpoint builder to `fplApi`                 | Writing an upstream URL anywhere other than `fpl-api.ts`                  |
| Reading `process.env.FPL_LEAGUE_ID` inside `fpl-api.ts`   | `NEXT_PUBLIC_FPL_LEAGUE_ID`, or reading the env var anywhere else         |

### The database half of the boundary

The same rule, with a real credential behind it:

- **`src/server/db/client.ts` is the only file that builds a database client**, and the only
  one that reads `NEON_CONNECTION_STRING_PROD`. Never import `@/server/db/**` from a page,
  route or action — go through `@/server/data/**`.
- **Reads** live in `src/server/data/<domain>.ts`. **Writes** are Server Actions in
  `src/server/actions/<domain>.ts` (`'use server'`), which validate their input, call the
  DAL, and `revalidatePath`. A Server Action is a public POST endpoint: never trust its
  caller.
- **Identity comes from the session, never from the caller.** `getCurrentUser()` in
  `src/server/auth/server.ts` returns `null` for any session whose email is not in
  `league_members`, so there is one answer to "who is this?" and it already accounts for
  both authentication and membership. Never accept a user id — or a league entry — as an
  action argument.
- **`neon_auth` is Neon's schema, not ours.** We read from it; we never define it.
  `drizzle.config.ts` sets `schemaFilter: ['public']` to keep drizzle-kit out of it, and
  `profiles.user_id` deliberately carries no foreign key into it.
- Every file under `src/server/**` starts with `import 'server-only'`.

### Why

Two reasons, and neither is secrecy — the upstream APIs are public. First, **one place to
change**: league IDs rotate every season and the classic API's trailing-slash behaviour is
easy to get wrong; centralising the URLs means one edit, not fifteen. Second, **the browser
must not hammer the FPL API** — a full standings computation is up to 344 upstream calls
(see [API.md](./API.md#how-getgameweekdata-works-and-what-it-costs)), which is only
tolerable because it happens once per server, behind a cache, not once per visitor.

---

## Read API.md before you fetch

The FPL APIs are undocumented, unversioned, and change shape between seasons. Three
specific behaviours have already caused real bugs in this repo:

- `/api/pl/event-status` **404s with the bare string `"Game not started"`** out of season —
  not an object. Destructuring it throws.
- `/api/event/{gw}/live` returns `elements: {}` for unscored gameweeks, and **`{}` is
  truthy**. A naive guard lets every player score 0, tie on rank 1, and bank a win.
- **`league_entries[].id` and `league_entries[].entry_id` are different numbers.** `id` is
  the league entry (what we use as the player ID everywhere); `entry_id` goes in
  `/api/entry/...` URLs.

All of it, with observed payloads, is in [API.md](./API.md). When you add an endpoint,
document it there in the same change.

### Never trust a truthy check on an upstream collection

Upstream returns `{}` and `[]` for "nothing yet" and 404s for "not applicable", often in the
same season. Check `Object.keys(x).length` / `x.length`, never `if (x)`. A gameweek with no
data must be **absent** from the results, never scored as zeros — zeros rank, and ranking
awards points.

---

## File conventions

- **Everything lives under `src/`.** `src/app` (routes), `src/components`, `src/hooks`,
  `src/interfaces`, `src/lib`, `src/utils`. `public/` and config files stay at the repo root.
- **The `@/` alias points at `src/`** (`tsconfig.json` → `"@/*": ["./src/*"]`). Use it for
  every cross-directory import; relative imports are for siblings only.
- **API routes** live at `src/app/api/<name>/route.ts`, export `GET`, and return
  `{ error, message }` with a 500 on failure — `apiHelper()` detects the `error` key.
- **Shared types** live in `src/interfaces/`. **Pure helpers and the FPL scoring layer** live
  in `src/utils/`. **`cn`** lives in `src/lib/utils.ts`.
- **Server-only code lives under `src/server/`** — `db/` (client + Drizzle schema), `data/`
  (the DAL, one module per domain), `actions/` (Server Actions), `auth/` (session and the
  allowlist). Every file there starts with `import 'server-only'`.
- **New pages should read their own data** as `async` Server Components calling the DAL or
  `getGameweekData()` directly. `src/app/profile/page.tsx` is the pattern; the older pages
  still client-fetch and are being converted.
- **UI primitives** from shadcn/ui live in `src/components/ui/` — use these before building
  anything custom (see [FRONTEND.md](./FRONTEND.md)).
- **Feature components** are grouped by view: `TableView/`, `PlayerView/`, `RumblerView/`,
  `DetailView/`, `Layout/`.

### Never

- Never write an upstream URL outside `src/utils/fpl-api.ts`.
- Never import `@/utils/fpl-api` or `@/utils/gameweek-data` from a client component.
- Never hard-code the league ID, or any season-scoped identifier, in source.
- Never treat `{}` or `[]` from upstream as "has data" — see above.
- Never add `NEXT_PUBLIC_` to a variable that only the server needs.
- Never commit `.env.local`. `.env.example` is the committed template.
- Never import `@/server/db/**` from a page, route handler or Server Action.
- Never import anything under `@/server/**` from a client component.
- Never accept a user id from a form or query string — read it from the session.
- Never edit an applied migration in `drizzle/` — add a new one.
- Never point drizzle-kit at the `neon_auth` schema.
- Never persist a derived value (an F1 score, a ranking) — store the facts and compute it.
- Never store a gameweek that produced no performances; it must stay absent and be retried.

---

## Styling

- **Tailwind CSS v4 only** — no inline styles, no CSS modules. Utility classes are merged
  with `cn` from `@/lib/utils`.
- **There is no `tailwind.config.js`.** v4 is configured in CSS: the theme lives in
  `@theme inline { … }` in [`src/app/globals.css`](../src/app/globals.css). A
  `--color-*` entry there generates the matching utility.
- **Theme with semantic tokens, never hard-coded colours.** Use `text-foreground`,
  `text-muted-foreground`, `bg-background`, `border-border`. The app ships a single dark
  purple treatment; the tokens are what make a redesign a one-file change.
- **shadcn/ui components** (new-york style) from `src/components/ui/`. Add them with
  `pnpm dlx shadcn@latest add <component>` — `components.json` is already pointed at
  `src/app/globals.css` with no config file, which is the v4 layout.

---

## Language and voice

- **British English everywhere** in prose, UI copy, comments, and identifiers we author:
  _colour_, _organise_, _summarise_, _behaviour_, _recognise_, _centre_.
- **Framework/API exception:** keep framework and third-party identifiers in their canonical
  spelling even when American — `color` tokens in CSS, `normalize`, `revalidatePath`. Don't
  rename an API to make it British.
- **Brand and framework names** stay canonical: _Next.js_, _Tailwind CSS_, _shadcn/ui_,
  _TypeScript_, _React_, _Fantasy Premier League_.
- **Domain vocabulary** is fixed: a **rumbler** is the player who finishes last in a
  gameweek. **F1 score** is the season total from per-gameweek ranks. An **entry** is one
  manager's team. Use these words; don't invent synonyms.

## UI display rules

- **Sentence case everywhere.** Card titles, headings, tab labels, button labels, column
  headers: capitalise only the first word. "Position distribution", not "Position
  Distribution". Proper nouns and team names excepted.
- **No em dashes in UI copy.** End the sentence and start another, or use a colon. En dashes
  in ranges (`GW1–GW38`) are notation and are fine. The rule is about copy, not code —
  comments and these docs may use them.

---

## Testing

**There is no test framework in this repo yet.** That is a gap, not a policy.

> _TODO (owner)_ — add Vitest with colocated `*.test.ts`, and a CI workflow running
> `pnpm lint`, `pnpm typecheck` and `pnpm test`. The scoring logic in
> `src/utils/gameweek-data.ts` (`assignRanks`, the F1 award, the empty-gameweek guards) is
> pure, high-risk, and the obvious first target — the 700-point bug described in
> [API.md](./API.md) would have been caught by one test.

Until then, verify changes with `pnpm lint && pnpm typecheck && pnpm build`, then run the
app and hit the affected routes.

---

## Verifying a change

```bash
pnpm lint          # eslint, flat config
pnpm typecheck     # tsc --noEmit
pnpm format:check  # prettier
pnpm build         # next build (Turbopack)
PORT=3100 pnpm start
```

Port 3000 is frequently taken by another project on this machine — a `307 → /login` from
`localhost:3000` means you are talking to someone else's app, not this one.

**`rm -rf .next` before trusting any data-shape debugging.** Next persists its fetch cache
across builds and will happily serve you last season's payload.

`pnpm lint` currently reports **0 errors and ~29 warnings**. The warnings are a known,
pre-existing backlog — see below. Do not add to them.

---

## Do not

- Do not add `console.log` to production code (`console.error` in a catch is fine).
- Do not use `any` without a comment explaining why. The existing ones are a backlog, not a
  licence.
- Do not commit after every small change — build a feature end-to-end, then commit once.
- Do not silently widen scope during a dependency upgrade. Upgrade, verify, and report
  pre-existing bugs separately rather than folding behaviour changes into the bump.
- Do not "fix" a lint warning by deleting a symbol without checking it is genuinely unused.

---

## Known issues (the warning backlog)

`pnpm lint` reports these as warnings rather than errors because every violation predates
the Next 16 / React 19 upgrade that surfaced them. They are a backlog to work off. Fix the
violations, then promote the rule back to `error` in `eslint.config.mjs`.

| Rule                                 | Count | What it means here                                                                                |
| ------------------------------------ | ----- | ------------------------------------------------------------------------------------------------- |
| `@typescript-eslint/no-explicit-any` | ~26   | Untyped upstream payloads. Fix by typing the shapes in [API.md](./API.md) into `src/interfaces/`. |
| `react-hooks/set-state-in-effect`    | 2     | Client-side data fetching in `useEffect`. Dissolves with the Server Components refactor.          |
| `react-hooks/exhaustive-deps`        | 1     | The deliberate dependency escape hatch in `use-table-data.ts`.                                    |

Two further known defects, both pre-existing and neither yet fixed:

- **`font-inter` is a dead class.** `src/app/layout.tsx` loads Inter and sets `--font-inter`
  on `<html>`, but no theme entry maps `font-inter` to it, so the app renders in the default
  sans stack. Deliberately left alone during the Tailwind 4 migration to avoid changing
  typography; fold it into the design refresh.
- **Four routes are unused** by any component: `/api/current-event`, `/api/pl-teams`,
  `/api/pl-fixtures`, `/api/matches`. Keep or delete deliberately.

And one piece of production configuration still outstanding:

- **Neon Auth `trusted_origins` is empty.** `allow_localhost` is on, so development works,
  but the Vercel origin must be added on the Neon project before sign-in works in
  production.

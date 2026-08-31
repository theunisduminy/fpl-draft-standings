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

`.nvmrc` pins the patch version and CI reads it with `node-version-file`, so local, CI and
Vercel agree on the runtime. Change one and change the other.

---

## The core boundary: upstream API access is server-only, always

**Rule: the browser never calls `draft.premierleague.com`, `fantasy.premierleague.com` or
`footballapi.pulselive.com` directly.** All upstream access flows through server-only
modules.

```
  app/**/page.tsx                ── async Server Component: reads its own data
     │                              renders to HTML, passes plain props down
     │                              client components are leaves, for interaction only
     ▼
  src/utils/gameweek-data.ts     ── the data layer: fetch, score, rank, aggregate
  src/utils/premier-league-data.ts  the Pulse table + fixtures
     │                              (in-memory TTL cache + promise dedup)
     ▼
  src/utils/fpl-api.ts           ── `import 'server-only'`
     │                              the ONLY place upstream URLs and FPL_LEAGUE_ID live
     │                              `fplApi` for the two FPL games, `pulseApi` for Pulse
     ▼
  draft.premierleague.com · fantasy.premierleague.com · footballapi.pulselive.com
```

**Pages read their own data.** There is no client-fetch layer any more: no `apiHelper`, no
`useTableData`, and no `/api/*` route that exists only to feed a component. A page that
needs the season calls `getGameweekData()` directly and hands the result down as props. An
`/api/*` route is now only justified by an _external_ consumer.

- **`src/utils/fpl-api.ts` is the single gateway.** It is the only file allowed to contain
  an upstream URL, and the only file that reads `FPL_LEAGUE_ID`. It starts with
  `import 'server-only'`, so it fails the build if pulled into a client bundle.
- **`FPL_LEAGUE_ID` is never `NEXT_PUBLIC_`.** Read it through `getLeagueId()`, lazily, so a
  missing value fails the request rather than `next build`.
- **API routes never build URLs themselves.** They call `fplApi.*` or `getGameweekData()`.

### Allowed vs forbidden

| Allowed                                                    | Forbidden                                                                 |
| ---------------------------------------------------------- | ------------------------------------------------------------------------- |
| A route handler importing `getGameweekData()` or `fplApi`  | A client component fetching `draft.premierleague.com` directly            |
| A Server Component page calling `getGameweekData()`        | A client component importing `@/utils/fpl-api` or `@/utils/gameweek-data` |
| Passing server-fetched data to a client component as props | Adding an `/api/*` route so a client component can fetch its own data     |
| Adding a new endpoint builder to `fplApi`                  | Writing an upstream URL anywhere other than `fpl-api.ts`                  |
| Reading `process.env.FPL_LEAGUE_ID` inside `fpl-api.ts`    | `NEXT_PUBLIC_FPL_LEAGUE_ID`, or reading the env var anywhere else         |

### The auth gate: `src/proxy.ts`, and why deleting it breaks sign-in silently

**The whole app is behind sign-in.** `src/proxy.ts` — Next 16's name for what used to be
`middleware.ts` — redirects every signed-out request to `/auth/sign-in`. There is no public
view.

That file is not just route protection, and this is the part that bites:

- **It is the only thing that completes the OAuth handshake.** Neon returns the browser to
  the callback URL carrying `?neon_auth_session_verifier=…`, and the library code that
  trades that param for the `__Secure-neon-auth.session_token` cookie
  (`exchangeOAuthToken`) is reachable from the proxy and nowhere else. The
  `/api/auth/[...path]` mount never sees that navigation — it arrives at a page route.
- **Without it, sign-in half-succeeds and looks like a database problem.** Neon creates real
  `user`, `account` and `session` rows, no cookie is ever set, every page renders signed
  out, and the person signs in again. The only symptom is duplicate session rows seconds
  apart. This cost a debugging session; do not re-learn it.

**`callbackURL` must be a path the matcher covers**, or the verifier lands somewhere the
proxy never runs and you are back to the silent failure above.

### Three levels of access, and where each is enforced

The proxy is only the first of them. Do not confuse the three:

| Level         | Means                                     | Enforced by                    |
| ------------- | ----------------------------------------- | ------------------------------ |
| **Signed in** | a valid Neon session — any Google account | `src/proxy.ts`                 |
| **A member**  | that email is in `league_members`         | `getCurrentUser()` → `null`    |
| **Onboarded** | a name **and** a club are on record       | `(app)/(onboarded)/layout.tsx` |

The last two are enforced together, in one layout: `(onboarded)` redirects to `/profile`
unless `getCurrentUser()` returns a user whose `profileComplete` is true. So a stranger with
a valid Google session gets the "not on the league list" page rather than the standings, and
a member with a blank profile gets the form.

**Onboarding is a route group, not an `if` in each page.** A layout cannot see the pathname,
and a gate that redirects to `/profile` must not run on `/profile` — that is an infinite
redirect. Grouping solves it structurally: `/profile` sits in `(app)` but outside
`(onboarded)`, so it keeps the navigation chrome while staying reachable with an empty
profile. A new page belongs in `(onboarded)` unless it is itself a step someone must pass
through before they are onboarded.

Two things follow. **The gate reads the database on every page**, so `getCurrentUser()` runs
its membership and profile reads concurrently — keep it that way. And **completeness is
decided in one place**, `isProfileComplete` in `src/server/auth/server.ts`; the `required`
attributes on the form are a courtesy, and `updateProfile` re-checks, because a Server
Action is a public POST endpoint.

The matcher excludes Next's static output and `public/` assets, so the sign-in page keeps
its logo. It deliberately does **not** exclude `/api/auth/**` — the library skips those
itself, and the sign-in POST has to reach them while the caller is signed out.

**The navigation lives below the gate, not above it.** Every real page sits in the `(app)`
route group, whose layout wraps them in `AppChrome` (header, sidebar, bottom nav, footer,
and the one `max-w-7xl` container). `/auth/sign-in` sits outside that group, so it renders
against the root layout — fonts and background only. A signed-out visitor must never see a
nav bar; every link in it would bounce straight back to the sign-in page. New pages go in
`(app)`; the only reason to add anything beside it is another pre-auth screen.

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
  action argument **to say who is acting**. A league entry naming _whose public data to
  display_ is a subject, not an identity, and is fine: `readGameweekSquad` takes one. The
  test is whether the argument could grant the caller someone else's authority. If it
  could, it comes from the session.
- **An action may serve a read, but only one a page genuinely cannot do.** The default
  stands: pages read their own data. The exception is data chosen by an interaction long
  after the render, where pre-fetching every possible answer is absurd —
  `readGameweekSquad` in `src/server/actions/gameweek.ts` is the only one, and it exists
  because eight managers × 38 gameweeks of picks is hundreds of upstream calls to answer a
  question the reader may never ask. An `/api/*` route is not the alternative: the proxy
  307s it, and past that it has no membership check. Such an action re-checks
  `getCurrentUser()` itself and validates every argument.
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

The FPL APIs are undocumented, unversioned, and change shape between seasons. Every one of
these behaviours has already caused a real bug in this repo:

- `/api/pl/event-status` **404s with the bare string `"Game not started"`** out of season —
  not an object. Destructuring it throws.
- `/api/pl/event-status` returns **one row per date, not per gameweek**. `leagues_updated`
  goes true on a gameweek's opening Friday night with three days still to play, so
  `some(leagues_updated)` declares it complete. Ask `deriveSeasonState()`.
- `/api/event/{gw}/live` returns `elements: {}` for unscored gameweeks, and **`{}` is
  truthy**. A naive guard lets every player score 0, tie on rank 1, and bank a win.
- `/api/event/{gw}/live` then returns **all ~609 elements on zero** from the moment the
  gameweek's fixtures exist, hours before kick-off. Counting keys does not catch that one.
  Ask `hasBeenPlayed()`.
- **`league_entries[].id` and `league_entries[].entry_id` are different numbers.** `id` is
  the league entry (what we use as the player ID everywhere); `entry_id` goes in
  `/api/entry/...` URLs.
- **Pre-season Pulse returns all 20 clubs on zero, not an empty array.** `entries.length` is
  `20` in August, so a length check answers "we have a table" about a page of noughts. Read
  `tables[0].gameWeek` instead.
- **Pulse's season list must be picked by highest `id`, never by parsing the label.** Its
  labels are not one format: `"English Premier League Season 2026/2027"` sits directly above
  `"2025/26"` in the same response.

All of it, with observed payloads, is in [API.md](./API.md). When you add an endpoint,
document it there in the same change.

### Never type an FPL identifier as `number`

Three different integers flow through this app, and two of them are in the same range:

| Type            | Upstream field              | Addresses                                                  |
| --------------- | --------------------------- | ---------------------------------------------------------- |
| `LeagueEntryId` | `league_entries[].id`       | a manager in this league — **our player ID**               |
| `EntryId`       | `league_entries[].entry_id` | a team — `/api/entry/{id}/…`, and `element_status[].owner` |
| `ElementId`     | `elements[].id`             | a footballer                                               |

They are branded types in [`src/interfaces/fpl.ts`](../src/interfaces/fpl.ts), erased at
runtime. **Use them; never widen one back to `number`.** Every way of confusing these fails
_silently_ — the wrong ID finds no match and renders "Unknown", or 404s and makes a whole
gameweek vanish from the season. The brands turn all of that into a compile error.

Numbers entering from outside the type system get branded exactly once, at the boundary:
`asLeagueEntryId()` for a database column or an upstream payload, `parseLeagueEntryId()` for
anything a user supplied (a route param, a query string) — it rejects `"39837-nonsense"`,
which `parseInt` reads as `39837`.

**`ElementId` is only valid against the API it came from.** The draft and classic bootstraps
disagree on about 21 of their 581 elements.

### Never trust a truthy check on an upstream collection

Upstream returns `{}` and `[]` for "nothing yet" and 404s for "not applicable", often in the
same season. Check `Object.keys(x).length` / `x.length`, never `if (x)`. A gameweek with no
data must be **absent** from the results, never scored as zeros — zeros rank, and ranking
awards points.

**And `0` is a real value, not "not yet".** Test `typeof score === 'number'`, never
truthiness, or a completed goalless draw renders as a fixture still to kick off. Any field
where "none" and "not known yet" are both plausible needs the same care.

**Nor is a full collection proof of data.** Both traps above are the same mistake at two
scales: `{}` is the empty shape, and 609 elements on `minutes: 0` is the _populated_ shape
of the same nothing. Counting the container answers a question about the container. Ask
whether anything inside it actually happened.

### A gameweek is over when two sources agree, and never before

This is the most expensive rule in the codebase, because getting it wrong is
**unrecoverable without a manual delete**. `gameweek_scores` is written
`onConflictDoNothing` and a finalised gameweek is never refetched, so a gameweek stored
early stays wrong for the season.

It cost a real one. On 2026-08-21, before a ball was kicked in GW1, `event-status` said
`leagues_updated` for that day and the live feed had 609 elements in it. The app wrote all
eight managers on 0 points, tied on rank 1 — a win and 20 F1 points each — and served that
for three days.

- **`deriveSeasonState()` in `src/utils/season-state.ts` is the only place that decides.**
  A gameweek below `current_event` is over; `current_event` itself is over only when
  `/api/game` says `current_event_finished` **and** every `event-status` row for it says
  `leagues_updated`.
- **The gameweek in flight is shown, never stored.** It is scored by the same rule, marked
  `finished: false`, named in `provisionalGameweek`, and recomputed on every cache miss.
  Hiding it would make the site wrong on the one day everybody looks at it; showing it as
  settled would be worse. Every surface that renders a rank drawn from it says so.
- **`storeFinalisedGameweeks` refuses what it must not freeze** — anything provisional,
  and any gameweek where every manager scored 0. It filters and logs rather than throwing,
  because every page render goes through its caller and refusing the write is the whole
  job.
- **The escape hatch is `scripts/forget-gameweek.mjs`.** If a bad row is already stored,
  no amount of correct code removes it.

---

### Never memoise a promise across requests

A serverless instance is **frozen the moment its request ends**. Work still in flight does
not carry on in the background and it is not cancelled either: the sockets go away and the
promise simply never settles. So a module-level `let x = somethingAsync()` written to share
one computation between callers is only safe while those callers are inside the same
request. Between requests it is a trap.

This shipped, and it cost a real bug, twice. `getCompSeasonId()` in
`premier-league-data.ts` held the _promise_ and kept it forever on success, and
`cachedRead`'s dedup slot did the same for the life of a computation. Every link in the nav
is prefetched in one burst the moment somebody signs in — the access log shows six routes
invoked in a single second — and a prefetch the browser then discards ends its request
mid-computation. Every later render of `/premier-league` on that instance adopted what that
prefetch had started, which was already dead.

**Both symptoms look like a browser problem and neither is.** First it was a page pinned on
its loading skeleton with no error, no log line and a 200 in the access log. Then, once
every upstream read carried `upstreamSignal()`, the same page failed with "the feed could
not be reached" exactly ten seconds after the click. A reload "fixes" both, which is the
tell: a reload is a fresh request that does not adopt anything.

**The second fix was the wrong instrument, and that is the lesson.** A deadline on the
adopted promise only bounded how long the reader waited to discover it was waiting on a
corpse — it converted a hang into an error, which is more honest and no more correct. The
fix is not to wait more carefully. It is not to share across requests at all: `cachedRead`
now stamps its slot with a per-request token from React's `cache`, and adopts only its own
request's work. Outside a request scope React's `cache` calls straight through, so a caller
with no scope gets a token nobody matches and always does its own work — the safe default
falls out rather than being special-cased.

**A hang is only one of its symptoms.** The same slot in
`/api/cron/revalidate` holds the single-flight guard, and nothing awaits it — a
second caller returns `skipped` at once. Wedge that one and the instance stops
syncing altogether while answering `ok: true` forever: stale reference tables, and
a finished gameweek written by whichever visitor arrives first rather than by the
robot. It is guarded by a timestamp instead of a deadline, because the question
there is "is anyone still working on this?" rather than "how long will I wait?".
Ask which question a slot is answering before choosing the guard.

**The socket pool is the same trap one layer below JavaScript.** With the promise
sharing fixed and the fetch caching gone, `/premier-league` still hung ten seconds on
the first click of every session — and the tell was the same: a reload beside it loaded
instantly. The sign-in prefetch burst opens a connection to Pulse, the instance is
paused with that socket idle in undici's keep-alive pool, and the far end gives up on
it during the pause. The FIN arrives while nothing is listening, so on resume undici
still believes the socket is alive, writes the click's request into the void, and waits
out the full timeout — which, by aborting, destroys the corpse and hands the reload the
fresh connection the click should have had. A TCP connection is request-scoped state
exactly like a promise, so upstream reads no longer keep any: `upstreamFetch` in
`src/utils/fpl-api.ts` dispatches every one through an undici agent with
`pipelining: 0`, one fresh connection per read, closed when the response lands. A TLS
handshake per read is nothing against caches measured in minutes.

The rules that come out of it apply to any cache, memo, dedup slot — or pool:

- **Memoise the settled value, never the promise.** A number, a row, a payload is safe to
  keep for the life of the process. A promise is only ever safe inside the request that
  created it.
- **Scope any sharing of in-flight work to one request.** `requestToken` in
  [`src/utils/cache.ts`](../src/utils/cache.ts) is how, and `cachedRead` is the only thing
  that needs it. A deadline is not a substitute: it bounds the wait, not the mistake.
- **Every upstream read goes through `upstreamFetch`** (or `fetchUpstream`/`fetchPulse`
  over it), which applies both `upstreamSignal()` and the fresh-connection dispatcher so
  no call site can forget either. `fetch` has no timeout of its own, so a connection that
  never answers is the same never-settling promise one layer down; the timeout is what
  turns a silent hang into a loud failure — worth having, and not a fix. The dispatcher
  is what stops the hang happening at all.
- **One cache per thing, and here that cache is `cachedRead`.** Upstream reads are
  `cache: 'no-store'`. A fetch with a positive `revalidate` takes Next's cached path, which
  opens with `await incrementalCache.lock(cacheKey)` _before_ the network; a request aborted
  mid-fetch can leave that per-URL lock held, and the next render waits on it. That is what
  finally explained `/premier-league`: ten seconds of skeleton, then "the feed could not be
  reached", while a reload loaded instantly — the timeout expiring on a queue rather than on
  anything the network did. Pulse answers in under 300ms, cold, every time. Caching the same
  payload at three layers is what made a slow lock look like a slow API.

The general shape to distrust: state that outlives a request, holding something that only
makes sense inside one.

---

## File conventions

- **Everything lives under `src/`.** `src/app` (routes), `src/components`,
  `src/interfaces`, `src/lib`, `src/utils`, `src/hooks` (client hooks only, and only for
  what CSS cannot do). `public/` and config files stay at the repo root.
- **The `@/` alias points at `src/`** (`tsconfig.json` → `"@/*": ["./src/*"]`). Use it for
  every cross-directory import; relative imports are for siblings only.
- **API routes** live at `src/app/api/<name>/route.ts`, export `GET`, and return
  `{ error, message }` with a 500 on failure. Add one only for an _external_ consumer — a
  page must never fetch its own data over HTTP.
- **Shared types** live in `src/interfaces/`. **Pure helpers and the FPL scoring layer** live
  in `src/utils/`. **`cn`** lives in `src/lib/utils.ts`.
- **Reference tables are an accelerator, never a source of truth.** `draft_elements` and
  `pl_teams` hold the handful of fields anyone reads out of the 850 KB draft bootstrap.
  Every reader that consults them falls back to the API when the table is empty, stale,
  incomplete or unreachable, and logs why through `reportUnusableReference` — so a failed
  sync makes a page slower, never wrong. The staleness budget is one constant,
  `REFERENCE_STALE_AFTER_SECONDS` in `src/utils/reference-mapping.ts`, and the cron
  interval is half of it.

  **Locally the tables are stale by construction**, and that is not a bug to fix. Dev
  reads the sandbox branch (`NEON_CONNECTION_STRING_SANDBOX` wins in
  `src/server/db/client.ts`) and no cron runs against a laptop, so the sandbox goes stale
  overnight every night. `reportUnusableReference` therefore warns once per table per
  process in development and errors on every occurrence in production. Refresh the
  sandbox by calling `/api/cron/revalidate` on your own dev server with the `CRON_SECRET`
  bearer token — that process reads the sandbox, so the job writes it.

- **Server-only code lives under `src/server/`** — `db/` (client + Drizzle schema), `data/`
  (the DAL, one module per domain), `actions/` (Server Actions), `auth/` (session and the
  allowlist). Every file there starts with `import 'server-only'`.
- **The auth gate is `src/proxy.ts`**, beside `src/app/`. Next 16 deprecated the
  `middleware.ts` name; do not reintroduce it, and do not add a second one — Next supports
  only one such file.
- **Pages read their own data** as `async` Server Components calling the DAL or
  `getGameweekData()` directly. Every page now follows this; `src/app/(app)/(onboarded)/(home)/page.tsx` is the
  pattern, including where to put the Suspense boundary.
- **Never put a `loading.tsx` above a route that can 404.** A `loading.tsx` creates a
  boundary for its segment _and every route beneath it_; flushing that shell commits the
  HTTP status before the page has decided whether it is a 404, so `notFound()` renders the
  right page with a **200**. Awaiting the existence check before returning any JSX does
  **not** save you — verified against Next 16.3.0.

  So `/players/[playerId]` has no `loading.tsx` and never gets one. The four routes that
  cannot 404 each have their own; `/` needs the `(home)` route group (now nested inside
  `(app)`) to get one, because at the group root it would cover `/players/**` too.

  `/profile` is the one route that cannot 404 and still has none, deliberately: its title is
  the only one on the site that is not a static string (`Finish your profile` when
  onboarding, `Your profile` otherwise). A route shell cannot know which, and a guess means
  a visible flip a moment after paint.

- **Every page carries an in-page `<Suspense>` as well**, around the data-dependent subtree
  only. Pair it with `PageShell`, which paints the heading above the boundary — the title is
  a static string, so nobody should wait on the FPL API to see it. `/profile` awaits only
  the session above its boundary, which is two database reads; the season, the club list and
  the stored profile are all read inside the streamed subtree.

  A page that puts its whole body behind one boundary must restate `PageShell`'s `space-y-6`
  inside both the body **and** the skeleton — behind a boundary the body is a single child,
  so it no longer inherits that rhythm, and a skeleton that forgets it shifts on handover.

- **UI primitives** from shadcn/ui live in `src/components/ui/` — use these before building
  anything custom (see [FRONTEND.md](./FRONTEND.md)).
- **Feature components** are grouped by view: `TableView/`, `PlayerView/`, `RumblerView/`,
  `DetailView/`, `Layout/`.

### Never

- Never write an upstream **API** URL outside `src/utils/fpl-api.ts`. The one exception is
  the asset host `resources.premierleague.com` (crests and headshots), whose builders live
  in `src/utils/pl-assets.ts` — the browser loads those images directly, and `fpl-api.ts`
  is `server-only`, so they cannot live there. That file builds URLs and nothing else: no
  `fetch`, no league ID, no payload shapes.
- Never import `@/utils/fpl-api` or `@/utils/gameweek-data` from a client component.
- Never hard-code the league ID, or any season-scoped identifier, in source.
- Never treat `{}` or `[]` from upstream as "has data" — see above.
- Never add `NEXT_PUBLIC_` to a variable that only the server needs.
- Never commit `.env.local`. `.env.example` is the committed template.
- Never delete `src/proxy.ts`, and never narrow its matcher without checking the OAuth
  callback path still matches — see the auth gate section above.
- Never call a page "members only" on the strength of the proxy alone; that is what
  `(onboarded)` and `getCurrentUser()` are for.
- Never add a page beside `profile/` in `(app)` unless it is genuinely a pre-onboarding
  step — outside `(onboarded)` means outside the membership check too.
- Never import `@/server/db/**` from a page, route handler or Server Action.
- Never import anything under `@/server/**` from a client component.
- Never accept a user id from a form or query string — read it from the session.
- Never edit an applied migration in `drizzle/` — add a new one.
- Never point drizzle-kit at the `neon_auth` schema.
- Never persist a derived value (an F1 score, a ranking) — store the facts and compute it.
- Never persist a row without `league_id`, or query one without filtering on it. A league id
  is a season id; both FPL identifiers are minted fresh each August.
- Never store a gameweek that produced no performances; it must stay absent and be retried.
- Never store a gameweek that is still being played, and never decide that anywhere other
  than `deriveSeasonState()`.
- Never render a provisional rank, F1 score or position without saying it is provisional.
- Never hold a promise in a module-level variable past the request that created it, and
  never `await` one another request started — scope the sharing instead. See above.
- Never call an upstream API with the global `fetch` — go through `upstreamFetch`, which
  applies the timeout and the fresh-connection dispatcher together. A pooled keep-alive
  socket is a promise across requests in TCP form.

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

### Never assemble a Tailwind class name at runtime

**Tailwind scans source text.** A class built from a variable is a string it has never seen,
so it generates no rule for it — and nothing fails. Not the build, not the typecheck, not
lint.

```ts
// ✗ compiles, typechecks, and silently produces no CSS
return `hidden ${hideBelow}:table-cell`;

// ✓ every class spelled out where the scanner can read it
const HIDDEN_BELOW = {
  sm: 'hidden sm:table-cell',
  md: 'hidden md:table-cell',
  lg: 'hidden lg:table-cell',
} as const;
```

This shipped. `hiddenClasses` in `base-table.tsx` built its class that way, so the
stylesheet held `.md\:table-cell` and nothing else — `md` survived only because
`table-skeleton.tsx` happens to spell that string out literally. Every column marked `sm` or
`lg` kept its `hidden` and never got `table-cell` back: **invisible at every width** rather
than hidden below one. On the league table that meant Form and W/D/L never appeared at all.

The failure mode is what makes this a law. A missing column reads as a design decision, not
a bug, so it survives review — it took someone asking where the form column had gone. Any
variable that picks a class picks a **whole class** from a literal lookup;
`HIDDEN_BELOW` in `base-table.tsx` and `COLUMNS` in `SectionTabs` are both that shape. The
same applies to a colour ramp, a grid width, or a breakpoint chosen by data.

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

**Vitest, colocated `*.test.ts`, run with `pnpm test`.** Config is `vitest.config.mts` — the
`@/` alias has to be repeated there, because Vitest does not read `tsconfig.json` paths.

**Test the rules, not the fetching.** The split is always the same pair: a pure module holds
every rule, and an `async` sibling holds the fetch, the database and the cache and calls
into it.

| Pure (tested)          | Impure sibling           | What the rules decide                      |
| ---------------------- | ------------------------ | ------------------------------------------ |
| `scoring.ts`           | `gameweek-data.ts`       | ranks, F1 points, rumblers, aggregation    |
| `premier-league.ts`    | `premier-league-data.ts` | Pulse payload → table, fixtures, matchdays |
| `chart-scales.ts`      | the chart components     | which band, which colour, which tick       |
| `reference-mapping.ts` | the reference readers    | payload → row, row → domain, staleness     |
| `season-state.ts`      | `gameweek-data.ts`       | which gameweek is in play, which are over  |

**Keep that split.** A rule that only exists inside an `async` function wrapped around 344
upstream calls cannot be tested, and every rule in `scoring.ts` has already been broken once
in production:

- an unscored gameweek must be **absent**, not zeros — `{}` is truthy, and zeros rank
- ties share the higher rank and consume the lower ones (`1, 1, 3`)
- `standings` with `total: 0` is post-draft, not a season — the derived sum stands

**A rule that decides a colour or a scale is a rule.** `chart-scales.ts` exists because five
defects shipped while those rules lived as untested helpers inside chart components: an
all-drawn head-to-head record painted as the heaviest defeat, contradicting the
tie-is-a-draw rule that `scoring.ts` tests two files away; a grid that saturated to solid
green and red one gameweek into a season, because every pair had met once so every ratio was
1 or 0; a manager with no recent result sorting to the top of the form guide, because
dividing by `played.length || 1` gave them an average of 0, which beats first place; a box
plot rendering with no axis labels when scores cluster; and a bump chart rendering with no
lines at all, after its series were keyed by league entry on one side and display name on
the other. Typecheck, lint, tests and the build passed on every one of them. **Presentation
logic fails silently — it renders something**, so it needs pinning more than logic that
throws, not less.

Adding a rule to any of those modules means adding the test that pins it. Component tests
are a separate decision; there is no jsdom environment configured, so **layout is verified
by eye, never by CI** — say so when a change is layout-only.

CI is `.github/workflows/ci.yml`: `pnpm lint`, `typecheck`, `test` and `format:check` on
every pull request and every push to `main`. Each step carries `if: '!cancelled()'` so one
push reports every failure rather than one per round trip.

**`pnpm build` is deliberately not in CI.** It needs `FPL_LEAGUE_ID` and the database
credentials, and Vercel already builds every branch with them. Adding it here would mean
putting production secrets in GitHub to learn something Vercel tells us for free.

---

## Verifying a change

```bash
pnpm lint          # eslint, flat config
pnpm typecheck     # tsc --noEmit
pnpm test          # vitest run
pnpm format:check  # prettier
pnpm build         # next build (Turbopack)
PORT=3100 pnpm start
```

Port 3000 is frequently taken by another project on this machine — a `307 → /login` from
`localhost:3000` means you are talking to someone else's app, not this one.

**`rm -rf .next` before trusting any data-shape debugging.** Next persists its fetch cache
across builds and will happily serve you last season's payload.

`pnpm lint` currently reports **0 errors and 2 warnings**. The warnings are a known,
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

| Rule                                 | Count | What it means here                                     |
| ------------------------------------ | ----- | ------------------------------------------------------ |
| `@typescript-eslint/no-explicit-any` | 1     | The generic row type in `base-table.tsx`.              |
| `import/no-anonymous-default-export` | 1     | `eslint.config.mjs` exporting its config array inline. |

The `react-hooks` warnings are gone: `set-state-in-effect` and `exhaustive-deps` both came
from client-side data fetching, which the Server Components refactor removed outright. The
`no-explicit-any` count fell from ~26 to 3 when the upstream payloads were typed into
[`src/interfaces/fpl.ts`](../src/interfaces/fpl.ts), and to 1 when the recharts tooltip and
label payloads were typed.

Both of the defects that used to be listed here are fixed. Inter is now mapped into the
theme as `--font-sans`, so it is the sans face everywhere and no element needs a font
class — the `font-inter` class it replaced never generated anything. And the four
never-imported components (`MatchOddsCard`, `GameweekScoreChart`, `GameweekSummaryCard`,
`StreaksTracker`) are deleted; git remembers them if they are ever wanted back.

**There are two route handlers.** `/api/auth/[...path]` is Neon Auth's, and
`/api/cron/revalidate` is the sync job: every three hours it refreshes the two reference
tables from the draft bootstrap, calls `getGameweekData()` so a newly finalised gameweek
is written by the robot rather than by whichever visitor arrives first, then revalidates
the cache tags, clears the in-memory map and re-warms. **The clear is not optional** —
`cachedRead` checks its process-local `Map` before the Data Cache and `revalidateTag`
does not touch that map, so warming without `clearCache()` returns the entry the process
already held and silently runs nothing. Everything else has been
deleted: `/api/standings`, `/api/gameweek-data`, `/api/rumbler` and `/api/player/[id]` went
with the Server Components refactor, and `/api/current-event`, `/api/pl-teams`,
`/api/pl-fixtures` and `/api/matches` followed once nothing imported them.

The deciding argument is worth keeping, because it applies to the next one somebody wants to
add: **`src/proxy.ts` matches `/api/*` too**, so an unauthenticated caller gets a 307 to the
sign-in page. Adding an `/api/*` route means designing its authentication first, not
afterwards. The cron route is what that looks like in practice: its caller has no session,
so the matcher excludes `/api/cron`, and the route itself checks a bearer `CRON_SECRET` in
constant time. The exclusion buys authentication written by hand — it does not make the
path public, and nothing else may be excluded without the same work.

Production auth configuration is now done: `trusted_origins` on the Neon project contains
`https://draftrank.vercel.app`, and `allow_localhost` is on for development.

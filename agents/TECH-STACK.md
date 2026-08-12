# Tech stack — locked decisions

Day-one reading for anyone joining the project. Captures what is in the tree right now, why
each choice was made, and where to look when it matters.

The short version: **Next.js 16 App Router on Vercel, reading two public Fantasy Premier
League APIs through a server-only gateway, with Neon Postgres (Drizzle) for what upstream
cannot provide and Neon Auth for the eight league members. No tests — yet.**

> **Naming convention.** Component, library and framework names are kept canonical
> (_Next.js_, not _Next.JS_). British English applies to prose only; brand names are not
> translated.

---

## Application layer

| Component       | Choice                          | Version                                | Why                                                                                                                                                                               |
| --------------- | ------------------------------- | -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Framework       | Next.js (App Router, Turbopack) | `16.3.0`                               | Route handlers + Server Components on one runtime. Turbopack is the default builder in 16.                                                                                        |
| Runtime         | Node                            | `22.18.0`                              | Next 16 requires `>=20.9.0`. **Not pinned** — see the gap below.                                                                                                                  |
| Language        | TypeScript                      | `5.9.3`                                | Type safety across the server/client boundary. Held at 5.x deliberately: TypeScript 7 (the native port) is out, but `eslint-plugin-react` and the Next plugin have not caught up. |
| Package manager | pnpm                            | `10.28.2` (pinned in `packageManager`) | Deterministic via `pnpm-lock.yaml`. **Never** npm or yarn. Use `corepack pnpm` if your shell's pnpm is a different major.                                                         |
| React           | React                           | `19.2.8`                               | Server Components; ref-as-prop removes most `forwardRef` boilerplate.                                                                                                             |

## UI layer

| Component         | Choice                               | Version           | Why                                                                                                                   |
| ----------------- | ------------------------------------ | ----------------- | --------------------------------------------------------------------------------------------------------------------- |
| CSS               | Tailwind CSS                         | `4.3.3`           | **CSS-first config — there is no `tailwind.config.js`.** The theme lives in `@theme inline` in `src/app/globals.css`. |
| PostCSS plugin    | `@tailwindcss/postcss`               | `4.3.3`           | The v4 entry point. **autoprefixer was removed** — v4 handles vendor prefixing itself.                                |
| Primitives        | shadcn/ui (new-york)                 | vendored          | Owned in `src/components/ui/`, not a dependency we chase. Add with `pnpm dlx shadcn@latest add <component>`.          |
| Animation         | `tw-animate-css`                     | `1.4.0`           | Replaces `tailwindcss-animate`, which is v3-only.                                                                     |
| Icons             | `lucide-react`                       | `1.31.0`          | Tree-shakeable, consistent with shadcn defaults.                                                                      |
| Charts            | `recharts`                           | `3.10.1`          | Wrapped by `src/components/ui/chart.tsx`.                                                                             |
| Class composition | `clsx` + `tailwind-merge` via `cn()` | `2.1.1` / `3.6.0` | `tailwind-merge` v3 is the v4-aware major.                                                                            |
| Variants          | `class-variance-authority`           | `0.7.1`           | shadcn's variant mechanism.                                                                                           |
| Icon set (legacy) | Font Awesome                         | `7.3.1`           | Used in the footer/nav. `@fortawesome/react-fontawesome` v3 is the FA7-compatible major.                              |

UI conventions live in [`FRONTEND.md`](./FRONTEND.md). Read that before touching any UI.

## Data layer

| Component               | Choice                                                  | Version                            | Why                                                                                                       |
| ----------------------- | ------------------------------------------------------- | ---------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Source of truth         | `draft.premierleague.com` + `fantasy.premierleague.com` | —                                  | Public, unauthenticated, undocumented, unversioned, **season-scoped**. Traps: [`API.md`](./API.md).       |
| Gateway                 | `src/utils/fpl-api.ts`                                  | —                                  | The only file with upstream URLs or `FPL_LEAGUE_ID`.                                                      |
| Scoring layer           | `src/utils/gameweek-data.ts`                            | —                                  | Fetch the gap, score, rank, aggregate.                                                                    |
| Database                | Neon Postgres                                           | 18.4, `eu-central-1`               | Serverless Postgres with branching. Holds only immutable gameweek facts and data with no upstream source. |
| Driver                  | `@neondatabase/serverless`                              | `1.1.0`                            | HTTP driver — no connection pool to manage on serverless.                                                 |
| ORM                     | Drizzle                                                 | `0.45.2` (`drizzle-kit` `0.31.10`) | Schema as typed code, SQL-shaped queries, migrations included.                                            |
| Auth                    | Neon Auth (managed Better Auth)                         | `@neondatabase/auth` `0.5.0-beta`  | Identity in our own database, and it branches with it. Beta — see below.                                  |
| Cache                   | Postgres + in-memory `Map` + Next `fetch` cache         | forever / 1 h / 300 s              | Finished gameweeks persist; the two in-process layers die with the instance.                              |
| Server-only enforcement | `server-only`                                           | `0.0.1`                            | Build fails if a `src/server/**` module reaches a client bundle.                                          |

**The boundary is the law.** The browser never calls the FPL APIs or the database
directly; `src/server/db/client.ts` is the only file that builds a db client. Full rules:
[`AGENTS.md`](./AGENTS.md#the-core-boundary-upstream-api-access-is-server-only-always).

## Configuration

| Variable                      | Scope       | Notes                                                                                                                           |
| ----------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `FPL_LEAGUE_ID`               | server-only | The draft league to report on. Currently `8337`. **Season-scoped — expect to change it every August.** Never `NEXT_PUBLIC_`.    |
| `NEON_CONNECTION_STRING_PROD` | server-only | Neon pooled connection string. A real credential — read only by `src/server/db/client.ts`.                                      |
| `NEON_AUTH_BASE_URL`          | server-only | From the Neon project's Auth tab. **Includes the cluster segment** (e.g. `.c-6.`); the URL without it resolves but answers 500. |
| `NEON_AUTH_COOKIE_SECRET`     | server-only | Signs session cookies. Min 32 chars — `openssl rand -base64 32`.                                                                |
| `ALLOWED_EMAILS`              | server-only | Who may sign in. The league is eight known people, so membership is an allowlist, not open sign-up.                             |

`.env.example` is the committed template; `.env.local` is gitignored.

## Infrastructure

| Component   | Choice                                                         | Why                                                                                                              |
| ----------- | -------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Hosting     | Vercel ([draftrank.vercel.app](https://draftrank.vercel.app))  | First-party Next.js hosting; push-to-deploy.                                                                     |
| Analytics   | `@vercel/analytics` `2.0.1` + `@vercel/speed-insights` `2.0.0` | Already wired in `layout.tsx`. Not yet used to answer anything — see [`STRATEGY.md`](./STRATEGY.md#key-metrics). |
| CI          | **None**                                                       | See the gap below.                                                                                               |
| API testing | Bruno collection in `FPL Draft/`                               | `prem/` = upstream, `app/` = localhost. Its env file still holds a dead league ID.                               |

## Quality

| Component    | Choice               | Version                                         | Why                                                                                    |
| ------------ | -------------------- | ----------------------------------------------- | -------------------------------------------------------------------------------------- |
| Linter       | ESLint (flat config) | `9.39.5`                                        | `eslint.config.mjs`. **Held at 9 deliberately** — see below.                           |
| Lint config  | `eslint-config-next` | `16.3.0`                                        | Ships native flat configs (`/core-web-vitals`, `/typescript`); no `FlatCompat` needed. |
| Formatter    | Prettier             | `3.9.6` + `prettier-plugin-tailwindcss` `0.8.1` | `tailwindStylesheet` points at `src/app/globals.css` so v4 class sorting works.        |
| Type checker | `tsc --noEmit`       | bundled                                         | `pnpm typecheck`.                                                                      |
| Tests        | **None**             | The biggest gap in the repo.                    |

---

## Notable "why X" decisions

**ESLint is held at 9, not 10.** `eslint-config-next@16` depends transitively on
`eslint-plugin-react@7.37.5`, whose peer range tops out at `eslint ^9.7` and which calls
`context.getFilename()` — removed in ESLint 10. Installing ESLint 10 makes every lint run
crash with `contextOrFilename.getFilename is not a function`. This is an ecosystem block,
not a preference; revisit when `eslint-plugin-react` ships ESLint 10 support.

**TypeScript is held at 5.9, not 7.** The native Go compiler is released, but the surrounding
tooling (typescript-eslint, the Next TS plugin) is still settling. 5.0.4 → 5.9.3 was already
the material win.

**autoprefixer was removed, not upgraded.** Tailwind v4 does its own vendor prefixing via
Lightning CSS. Keeping autoprefixer would be redundant work on every build.

**`tailwindcss-animate` → `tw-animate-css`.** The former targets v3's plugin API and does not
work under v4. The latter is the shadcn-recommended replacement and is a plain CSS import.

**`chart.tsx` was rewritten, not regenerated.** recharts v3 moved `active` / `payload` /
`label` out of `Tooltip`'s own props (they are read from chart context) into
`TooltipContentProps`, and `dataKey` may now be an accessor function — so it can no longer be
used as a React key. The wrapper uses recharts' public `TooltipContentProps` and
`LegendPayload` types and React 19 ref-as-prop instead of `forwardRef`.

**Neon, and why the database holds so little.** It is deliberately not a mirror of the FPL
API. It stores immutable finished-gameweek facts (so a cold start costs one query instead of
344 upstream calls) and data with no upstream source at all (profiles, later bets). The F1
points table stays in code — it is policy, not fact, and persisting derived scores would
mean a backfill every time it is tuned. Full reasoning:
[`ARCHITECTURE.md`](./ARCHITECTURE.md#where-to-draw-the-persistence-line).

**Neon Auth is beta, and that was a considered choice.** The package ships as `0.5.0-beta`
and GA is "this quarter" with no firm date. Taken anyway because the requirements sit
entirely inside the GA feature set (Next.js, Google OAuth, email OTP — no MFA, no real org
model), and because **the escape hatch is cheap**: Neon Auth _is_ managed Better Auth, so if
the managed layer disappoints we run Better Auth ourselves against the same Postgres, with
the same tables. That is a very different risk profile from a proprietary auth service.
Known gaps at adoption: no MFA, the organization plugin is "partial", and split
frontend/backend deployments are unsupported.

**Drizzle over Prisma.** Prisma's client is heavier on serverless cold starts, and Drizzle's
schema-as-code maps cleanly onto the `schemaFilter: ['public']` boundary that keeps
drizzle-kit away from the Neon-owned `neon_auth` schema.

---

## Known gaps

> _TODO (owner)_ — none of these are decisions, they are absences:
>
> - **No `.nvmrc` / `.tool-versions`.** Node is unpinned; local and Vercel can drift.
> - **No CI.** `pnpm lint`, `pnpm typecheck` and `pnpm build` are run by hand.
> - **No test framework.** Vitest is the house default. The scoring logic in
>   `gameweek-data.ts` is pure and is the obvious first target.
> - **No email provider** — needed for the weekly results track.

---

## Cross-references

- [`STRATEGY.md`](./STRATEGY.md) — product direction and what the stack has to support
- [`ARCHITECTURE.md`](./ARCHITECTURE.md) — how a request flows through the stack
- [`AGENTS.md`](./AGENTS.md) — conventions, including the server-only boundary
- [`API.md`](./API.md) — endpoint and payload reference

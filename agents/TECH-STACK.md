# Tech stack — locked decisions

Day-one reading for anyone joining the project. Captures what is in the tree right now, why
each choice was made, and where to look when it matters.

The short version: **Next.js 16 App Router on Vercel, reading two public Fantasy Premier
League APIs through a server-only gateway. No database, no auth, no tests — yet.**

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

| Component               | Choice                                                  | Why                                                                                                                                       |
| ----------------------- | ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Source of truth         | `draft.premierleague.com` + `fantasy.premierleague.com` | Public, unauthenticated, undocumented, unversioned, **season-scoped**. Shapes and lifecycle traps: [`API.md`](./API.md).                  |
| Gateway                 | `src/utils/fpl-api.ts`                                  | The only file with upstream URLs or `FPL_LEAGUE_ID`.                                                                                      |
| Data layer              | `src/utils/gameweek-data.ts`                            | Fetch, score, rank, aggregate.                                                                                                            |
| Cache                   | In-memory `Map` TTL + Next `fetch` cache                | 1 h / 300 s. The `Map` is module scope, so it dies with every serverless instance.                                                        |
| Server-only enforcement | `server-only` `0.0.1`                                   | Build fails if `fpl-api.ts` is pulled into a client bundle.                                                                               |
| Database                | **None**                                                | Nothing needs persisting _yet_. The line to draw when it does: [`ARCHITECTURE.md`](./ARCHITECTURE.md#where-to-draw-the-persistence-line). |
| Auth                    | **None**                                                | Public read-only app. Arrives with profiles and bets.                                                                                     |

**The boundary is the law.** browser → `/api/*` → `gameweek-data.ts` → `fpl-api.ts` →
upstream. The browser never calls the FPL APIs directly. Full rules:
[`AGENTS.md`](./AGENTS.md#the-core-boundary-upstream-api-access-is-server-only-always).

## Configuration

| Variable        | Scope       | Notes                                                                                                                        |
| --------------- | ----------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `FPL_LEAGUE_ID` | server-only | The draft league to report on. Currently `8337`. **Season-scoped — expect to change it every August.** Never `NEXT_PUBLIC_`. |

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

**No database, for now.** Nothing the app currently shows is app-owned; it is all derived
from upstream. That stops being true the moment profiles and bets land. The reasoning about
what to persist — and what to deliberately never persist — is in
[`ARCHITECTURE.md`](./ARCHITECTURE.md#where-to-draw-the-persistence-line).

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

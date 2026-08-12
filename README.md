# Better Draft

A fairer league table for a Fantasy Premier League draft league. Every gameweek is ranked
1–8 and awarded Formula One points (20, 15, 12, 10, 8, 6, 4, 2), so the season rewards
consistency rather than one enormous week — plus a permanent record of whoever finished last.

Live at **[draftrank.vercel.app](https://draftrank.vercel.app)**.

## Getting started

Requires **Node 22** and **pnpm 10** (pinned via `packageManager`; use `corepack pnpm` if
your shell's pnpm is a different major).

```bash
pnpm install
cp .env.example .env.local   # then set FPL_LEAGUE_ID
pnpm dev
```

Open <http://localhost:3000>.

### Configuration

See [`.env.example`](./.env.example) for the full template.

| Variable                      | Required    | Notes                                                                                                       |
| ----------------------------- | ----------- | ----------------------------------------------------------------------------------------------------------- |
| `FPL_LEAGUE_ID`               | yes         | Your draft league ID, from the URL on draft.premierleague.com. **Season-scoped — it changes every August.** |
| `NEON_CONNECTION_STRING_PROD` | yes         | Neon pooled connection string.                                                                              |
| `NEON_AUTH_BASE_URL`          | for sign-in | From the Neon project's Auth tab. Includes the cluster segment (e.g. `.c-6.`).                              |
| `NEON_AUTH_COOKIE_SECRET`     | for sign-in | `openssl rand -base64 32`                                                                                   |
| `ALLOWED_EMAILS`              | for sign-in | Who may sign in, comma-separated.                                                                           |

The public pages read live from the Fantasy Premier League APIs. Postgres holds only
finished-gameweek scores (so a cold start doesn't refetch a whole season) and member
profiles. Sign-in is Neon Auth with Google, restricted to `ALLOWED_EMAILS`.

## Scripts

| Command             | Does                         |
| ------------------- | ---------------------------- |
| `pnpm dev`          | Development server           |
| `pnpm build`        | Production build (Turbopack) |
| `pnpm start`        | Serve the production build   |
| `pnpm lint`         | ESLint (flat config)         |
| `pnpm typecheck`    | `tsc --noEmit`               |
| `pnpm format`       | Prettier, write              |
| `pnpm format:check` | Prettier, check only         |

There is no test suite yet. Verify a change with `pnpm lint && pnpm typecheck && pnpm build`,
then run it.

> Port 3000 is often taken by another project. `PORT=3100 pnpm start` is a safe fallback —
> a `307 → /login` from `localhost:3000` means you are talking to a different app.

> Debugging something that looks like last season's data? `rm -rf .next` first. Next.js
> persists its `fetch` cache across builds.

## Documentation

The `agents/` directory is the project's documentation, written for both humans and AI
agents. [`CLAUDE.md`](./CLAUDE.md) points Claude Code at it.

| Doc                                                  | Read it for                                                |
| ---------------------------------------------------- | ---------------------------------------------------------- |
| [`agents/AGENTS.md`](./agents/AGENTS.md)             | **Start here.** Conventions and rules — the law.           |
| [`agents/STRATEGY.md`](./agents/STRATEGY.md)         | What we're building and why                                |
| [`agents/ARCHITECTURE.md`](./agents/ARCHITECTURE.md) | Where code lives and how a request flows                   |
| [`agents/FRONTEND.md`](./agents/FRONTEND.md)         | UI patterns                                                |
| [`agents/API.md`](./agents/API.md)                   | Every endpoint and payload. **Read before any `fetch()`.** |
| [`agents/TECH-STACK.md`](./agents/TECH-STACK.md)     | Locked stack decisions and versions                        |

## API testing

A [Bruno](https://usebruno.com) collection lives in `FPL Draft/` — `prem/` hits the upstream
FPL APIs, `app/` hits `localhost:3000`.

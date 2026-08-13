---
name: Better Draft — API reference
last_updated: 2026-08-13
---

# API.md — Every API We Call, and What Comes Back

Supporting reference doc, read on demand. This is the contract sheet for the two
Premier League APIs this app reads and the few routes it still exposes. If you are about
to `fetch()` anything, read the relevant section first — several of these endpoints
behave in ways the field names do not suggest.

| Doc                                  | Answers                                   |
| ------------------------------------ | ----------------------------------------- |
| [AGENTS.md](./AGENTS.md)             | How we work — conventions, the law        |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Where code lives and how a request flows  |
| **API.md** (this file)               | What we call upstream and what it returns |

---

## The two upstream APIs

Both are public, unauthenticated, undocumented, and season-scoped. Neither is versioned,
so treat every shape here as observed rather than guaranteed.

| API                       | Base URL                                | What it gives us                                   |
| ------------------------- | --------------------------------------- | -------------------------------------------------- |
| **Draft** (`draft.*`)     | `https://draft.premierleague.com/api`   | The league, its entries, standings, picks, scoring |
| **Classic** (`fantasy.*`) | `https://fantasy.premierleague.com/api` | Clubs, gameweek metadata, the 380 fixtures         |

Every URL is built by `fplApi` in [`src/utils/fpl-api.ts`](../src/utils/fpl-api.ts).
That module is the only place upstream URLs are allowed to be written. It is
`server-only`, so none of this reaches the browser.

### The league ID is an environment variable

`FPL_LEAGUE_ID` (see [`.env.example`](../.env.example)), read through `getLeagueId()`.
**Draft league IDs are season-scoped** — a renewed league is issued a fresh ID every
August. The two IDs this app previously used (`75224` in source, `389464` in the Bruno
collection) both return `404 No League matches the given query` today. The current
value is `8337`.

Read it lazily via `getLeagueId()`, never at module scope: a missing value should fail
the request that needs it, not `next build`.

---

## Season lifecycle — the thing that breaks everything

Most of the surprises below come from one fact: **these APIs change shape between
seasons, and several of them 404 rather than returning an empty result.** At the time
of writing (2026-08-13) the draft is done but the 2026/27 season has not kicked off —
GW1 deadline is `2026-08-21T17:30:00Z`.

**The draft completing does not change any of this.** Squads exist, but `event-status`
still 404s, `entry/{id}/event/1` still 404s, and `standings` is still `[]`. The only thing
that flipped is ownership, which lives on a different endpoint (`element-status`).

| Endpoint                     | In season | Pre-season                                            |
| ---------------------------- | --------- | ----------------------------------------------------- |
| `/api/game`                  | 200       | 200 — the reliable "has it started?" call             |
| `/api/pl/event-status`       | 200       | **404**, body is the bare string `"Game not started"` |
| `/api/event/{gw}/live`       | 200       | 200, but `elements` is `{}`                           |
| `/api/entry/{id}/event/{gw}` | 200       | **404**, body `"No pick history"`                     |
| `/api/league/{id}/details`   | 200       | 200, `standings` is `[]`                              |

Two traps follow from this, both of which have already bitten this codebase:

> [!WARNING]
> **`event-status` 404s with a bare string, not an object.** Code that does
> `const { status } = await res.json()` gets `undefined` and then throws on
> `.map`. Always go through `fetchEventStatus()` in
> [`src/utils/gameweek-data.ts`](../src/utils/gameweek-data.ts), which maps 404 → `[]`.

> [!WARNING]
> **`elements: {}` is truthy.** A guard like `if (!liveData?.elements) return;` does
> **not** skip an unscored gameweek. Combined with picks that 404 (caught and
> defaulted to `[]`), every entry scores 0, `assignRanks` ties them all on rank 1, and
> each banks a win plus 20 F1 points — for every gameweek in the season. This produced
> a standings table where all eight players had 700 points and 35 wins. The guard must
> count keys: `Object.keys(liveData.elements).length === 0`.

A third trap is not season-related but caused the same symptom:

> [!WARNING]
> **Next.js persists its fetch cache in `.next/cache` across builds.** A stale
> `event-status` from the previous season survived a rebuild and was served with
> HTTP 200 long after upstream had started 404ing, reintroducing the bug above. When
> debugging anything that looks like last season's data, `rm -rf .next` before
> concluding anything.

---

## Draft API

### `GET /api/game`

Game-wide state. **Available year-round**, which makes it the dependable way to ask
whether the season has started. Not currently called by the app; prefer it over
`event-status` for any new "is the season live?" logic.

```json
{
  "current_event": null,
  "current_event_finished": false,
  "next_event": 1,
  "processing_status": "n",
  "trades_time_for_approval": true,
  "waivers_processed": false
}
```

### `GET /api/pl/event-status`

Per-gameweek processing status. Drives which gameweeks are considered complete.

```json
{
  "status": [
    {
      "bonus_added": true,
      "date": "2026-05-01",
      "event": 35,
      "leagues_updated": true,
      "points": "r"
    }
  ],
  "leagues": "Updated"
}
```

- `leagues_updated: true` means that gameweek's league scoring is final. This is the
  field `getGameweekData()` uses to decide `maxCompletedGameweek`.
- **404s pre-season** with the bare string `"Game not started"` — see the warning above.

Consumed by: `fetchEventStatus()` in `gameweek-data.ts`, and `/api/current-event`.

### `GET /api/league/{leagueId}/details`

The league, its members, and the standings table. The single most important upstream call.

Top-level keys: `league`, `league_entries`, `standings`, and — **only for head-to-head
leagues** — `matches`.

> [!IMPORTANT]
> **`matches` is absent entirely for classic-scoring leagues.** League 8337 has
> `scoring: "c"`, so the response has three keys, not four. Code that destructures
> `matches` gets `undefined`, not `[]`. The app does not currently read it, but
> `src/interfaces/match.ts` still defines a `Match` type against it.

**`league`** — metadata:

```json
{
  "admin_entry": 39780,
  "closed": true,
  "draft_dt": "2026-08-12T19:00:00Z",
  "draft_pick_time_limit": 90,
  "draft_status": "post",
  "draft_tz_show": "Europe/Berlin",
  "id": 8337,
  "ko_rounds": 0,
  "make_code_public": false,
  "max_entries": 8,
  "min_entries": 8,
  "name": "Draft Cup",
  "scoring": "c",
  "start_event": 1,
  "stop_event": 38,
  "trades": "y",
  "transaction_mode": "waivers",
  "variety": "x",
  "drafts": [
    {
      "id": 8911,
      "draft_started": true,
      "draft_completed": "2026-08-12T19:56:25.910800Z",
      "draft_dt": "2026-08-12T19:00:00Z",
      "event": 1,
      "league": 8337,
      "order_method": "random"
    },
    {
      "id": 32922,
      "draft_started": false,
      "draft_completed": null,
      "draft_dt": "2027-02-03T20:00:00Z",
      "event": 24,
      "league": 8337,
      "order_method": "random"
    }
  ],
  "is_renewed": true
}
```

- `scoring`: `"c"` classic (total points) or `"h"` head-to-head. Ours is classic.
- `draft_status`: `"pre"` → `"post"` once the draft completes. **An empty `standings` is
  still normal afterwards** — that tracks the season, not the draft.
- `transaction_mode` flips `"not-drafted"` → `"waivers"` at the same moment.
- **`drafts` is a list.** There is a mid-season draft too (GW24, 2027-02-03). Do not assume
  one element, and do not assume `drafts[0]` is the one you want.

**`league_entries`** — one row per manager. **This is the identity table for the app.**

```json
{
  "entry_id": 39781,
  "entry_name": "DeZerbi To Win",
  "id": 39837,
  "joined_time": "2026-08-05T10:23:19.708629Z",
  "player_first_name": "Theunis",
  "player_last_name": "Duminy",
  "short_name": "TD",
  "waiver_pick": 7
}
```

> [!IMPORTANT]
> **`id` and `entry_id` are different numbers and are not interchangeable.**
>
> - `id` is the **league entry** ID (39837). It is what `standings[].league_entry`
>   references and what this app uses as its player ID throughout — the
>   `/players/[playerId]` URL, every `PlayerDetails.id`, the `league_entry` column.
> - `entry_id` is the **team** ID (39781). It is what you put in `/api/entry/{...}/...`
>   URLs, and what `element_status[].owner` gives you back.
>
> Passing one where the other belongs returns a 404 or, worse, another league's data.
>
> In code they are the branded types `LeagueEntryId` and `EntryId`
> ([`src/interfaces/fpl.ts`](../src/interfaces/fpl.ts)), so the compiler rejects the swap.
> Never widen them back to `number`.

**`standings`** — the league table. `[]` before the season starts.

Fields the app reads: `league_entry` (matches `league_entries[].id`), `total`,
`event_total`. `src/interfaces/standings.ts` also declares `rank`, `rank_sort`,
`points_for`, `points_against`, `last_rank`.

> _Unverified pre-season_ — `standings` is empty right now, so the field list above
> comes from the existing interfaces and last season's usage rather than an observed
> payload. Confirm after GW1 and update this section.

### `GET /api/event/{gameweek}/live`

Live per-player stats for one gameweek. Two keys: `elements` and `fixtures`.

`elements` is an **object keyed by element ID string**, not an array:

```jsonc
{
  "elements": {
    "233": { "stats": { "total_points": 8, "minutes": 90, "goals_scored": 1 } },
  },
  "fixtures": [/* same shape as the classic fixtures endpoint */],
}
```

The app reads exactly one field: `elements[id].stats.total_points`.

> _Unverified pre-season_ — `elements` is `{}` today, so the inner `stats` shape above
> is from the code's usage, not an observed payload. Confirm after GW1.

### `GET /api/entry/{entryId}/event/{gameweek}`

One team's picks for one gameweek. Note this takes **`entry_id`**, not the league entry `id`.

The app reads `picks[]`, using `pick.position` (1–11 are starters, 12–15 bench) and
`pick.element` (the element ID to look up in the live response).

- **404s with `"No pick history"`** until that entry has actually played a gameweek.
  `fetchGameweekBatch` catches this and substitutes `{ picks: [] }` — which is why the
  empty-`elements` guard matters so much.

> _Still 404 as of 2026-08-13_, the day after the draft — the endpoint stays unavailable
> until GW1 is actually played, not merely until squads exist. **To read a squad before the
> season starts, use `element-status` instead.** Confirm the full pick shape after GW1.

### `GET /api/league/{leagueId}/element-status`

**Current ownership** — the reliable way to ask "whose squad is this player in?", both
before GW1 and all season, because it reflects trades and waivers rather than just the
draft.

Verified 2026-08-13: 581 elements, 120 owned (15 each across 8 entries), 461 free agents.

```json
{ "element": 414, "owner": null, "status": "a", "in_accepted_trade": false }
```

- `status` is `"a"` (available) or `"o"` (owned).
- **`owner` is an `entry_id`** (39781), **not** a `league_entries[].id` (39837). This is the
  third place in the API where the two collide, and the one most likely to be got wrong,
  because `owner` reads like a person. It is typed `EntryId`.

### `GET /api/draft/{leagueId}/choices`

The draft itself: 120 rows over 15 rounds, in pick order. Each carries `element`, `entry`
(an **`entry_id`**), `round`, `pick`, `index`, `seconds_to_pick` and `was_auto`.

A historical record — it does **not** track later trades or waivers, so it is the wrong
source for "who owns X now". Good for a draft-recap view.

### `GET /api/bootstrap-static` (draft)

The draft game's own static dataset: `elements`, `teams`, `element_types`, `events`,
`fixtures`, `settings`, `element_stats`.

> [!IMPORTANT]
> **No trailing slash** — `/api/bootstrap-static/` 404s here. This is the exact inverse of
> the classic API, which 301s without one.

> [!WARNING]
> **Element IDs are not portable between the two APIs.** Both return 581 elements over the
> same ID range and 560 agree — but the rest do not. Element 554 is Tzolis on the draft API
> and Van Oevelen on the classic one; 555, 556, 557 and 558 likewise disagree. The
> divergence is in the tail, where late additions were numbered independently.
>
> Anything holding a draft element (`picks[].element`, `element_status[].element`,
> `choices[].element`, the keys of `event/{gw}/live`) **must** be resolved against this
> endpoint, never against `fantasy.premierleague.com/api/bootstrap-static/`. Getting it
> wrong mislabels roughly 4% of players and nothing errors.
>
> `ElementId` is branded, but a brand cannot tell you which API a number came from — this
> one is on you.

### Endpoints we do not currently call

Probed and working, listed here so nobody has to rediscover them:

| Endpoint                              | Returns                                                                 |
| ------------------------------------- | ----------------------------------------------------------------------- |
| `/api/entry/{entryId}/public`         | `{ entry: { name, player_first_name, favourite_team, league_set, … } }` |
| `/api/entry/{entryId}/history`        | `{ history: [], entry: {…} }` — per-gameweek history                    |
| `/api/draft/league/{leagueId}/trades` | `{ trades: [] }`                                                        |
| `/api/watchlist/{leagueId}`           | **403** — needs authentication, unusable                                |

---

## Classic API

> [!IMPORTANT]
> **Both classic endpoints require a trailing slash.** Without it they answer
> `301` with `location: /api/<path>/`. `fetch()` follows redirects so it works
> anyway, but it costs an extra round trip on every call. The builders in
> `fpl-api.ts` include the slash.

### `GET /api/bootstrap-static/`

The full static dataset — ~1.3 MB. Top-level keys: `chips`, `events`, `game_settings`,
`game_config`, `phases`, `teams`, `total_players`, `element_stats`, `element_types`,
`elements`.

**`teams`** (20) — read through `getPremierLeagueTeams()` in `src/utils/pl-teams.ts`, which
also backs `/api/pl-teams`:

`code`, `draw`, `form`, `id`, `loss`, `name`, `played`, `points`, `position`,
`short_name`, `strength`, `team_division`, `unavailable`, `win`, `link_url`,
`strength_overall_home`, `strength_overall_away`, `strength_attack_home`,
`strength_attack_away`, `strength_defence_home`, `strength_defence_away`, `pulse_id`.

> **`code` is stable across seasons. `id` is not — never persist `id`.**
> `id` is 1–20 assigned in alphabetical order and re-minted every August, so a promoted club
> that sorts early shifts every id after it. `code` is the club's permanent number: Arsenal
> is `code` 3 and `id` 1 this season, Aston Villa `code` 7 / `id` 2, Bournemouth `code` 91 /
> `id` 3 — the codes are visibly not sequential because they were issued once, historically.
>
> This is the same season-scoping trap as `league_entries[].id`, with one difference: it
> would not fail at read time. A stored `id` keeps resolving, to the wrong club, a year
> later. `profiles.favourite_team` therefore stores the **code**, typed as `TeamCode` in
> [`src/interfaces/fpl.ts`](../src/interfaces/fpl.ts).
>
> `teams[].id` is still the right key for fixtures — `team_h` / `team_a` below are ids — but
> only within one season's payload, never in the database.

**`events`** (38) — gameweek metadata. `is_current` / `is_next` / `is_previous` and
`deadline_time` are the useful ones, and unlike `event-status` they are available
pre-season.

**`elements`** (577) — every player: `id`, `web_name`, `first_name`, `second_name`,
`team`, `element_type`, `now_cost`, `total_points`, `form`, `status`, `news`, …

**`element_types`** (4) — `1` GKP, `2` DEF, `3` MID, `4` FWD.

### `GET /api/fixtures/`

All 380 fixtures. Served by `/api/pl-fixtures`.

```json
{
  "code": 2645195,
  "event": 1,
  "finished": false,
  "finished_provisional": false,
  "id": 1,
  "kickoff_time": "2026-08-21T19:00:00Z",
  "minutes": 0,
  "provisional_start_time": false,
  "started": false,
  "team_a": 7,
  "team_a_score": null,
  "team_h": 1,
  "team_h_score": null,
  "stats": [],
  "team_h_difficulty": 2,
  "team_a_difficulty": 5,
  "pulse_id": 0
}
```

`team_h` / `team_a` are `teams[].id` from bootstrap-static.

---

## Our own routes (`src/app/api/**`)

**Pages do not use these.** Every page is an `async` Server Component calling
`getGameweekData()` or the DAL directly, so an `/api/*` route now exists only for an
external consumer. `/api/standings`, `/api/gameweek-data`, `/api/rumbler` and
`/api/player/[id]` were deleted when the pages stopped needing them.

| Route                 | Returns                  | Backed by                  |
| --------------------- | ------------------------ | -------------------------- |
| `/api/auth/[...path]` | Neon Auth's own handler  | `auth.handler()`           |
| `/api/matches`        | `GameweekPerformance[]`  | `.gameweekPerformances`    |
| `/api/current-event`  | `GameWeekStatus \| null` | Draft `event-status`       |
| `/api/pl-teams`       | The 20 `teams`           | Classic `bootstrap-static` |
| `/api/pl-fixtures`    | All 380 fixtures         | Classic `fixtures`         |

Errors are uniform — `{ error, message }` with a 500.

> **No consumer:** `/api/matches`, `/api/current-event`, `/api/pl-teams`,
> `/api/pl-fixtures`. They are exercised only by the Bruno collection, and all four now sit
> behind the auth gate, so they answer `307 → /auth/sign-in` without a session. Keep or
> delete deliberately — do not assume they are load-bearing. Note `/api/pl-teams` is now a
> thin wrapper over `getPremierLeagueTeams()`, which the profile page uses directly; the
> route itself is still consumer-less.

### Pre-season responses

With no gameweeks played, the pipeline returns a valid empty season rather than
failing: all 8 entries present with `f1_score: 0`, `total_points: 0` and zeroed
`position_placed`; `gameweekPerformances: []`; `rumblerData: []`;
`completedGameweeks: []`; `currentGameweek: 0`; and `/api/current-event` → `null`.

The pages render that state as content, not as an error: standings list all eight managers
on zero, and results and rumblers show their empty-state copy.

---

## How `getGameweekData()` works, and what it costs

[`src/utils/gameweek-data.ts`](../src/utils/gameweek-data.ts) is the whole data layer.
One call:

1. Reads `FPL_LEAGUE_ID`, then fetches league details and event status in parallel.
2. Derives `maxCompletedGameweek` from `status[].leagues_updated`.
3. For every completed gameweek, fetches the live data **and all 8 entries' picks**,
   in batches of 5 gameweeks.
4. Sums `total_points` over each entry's starting XI (`position <= 11`).
5. Ranks the 8 entries within the gameweek and awards F1 points —
   `[20, 15, 12, 10, 8, 6, 4, 2]`.
6. Aggregates into `players`, `rumblerData`, `completedGameweeks`.

**The cost is the problem.** Each gameweek costs `1 + 8 = 9` upstream calls, and the
whole history is recomputed from scratch:

| Completed gameweeks | Upstream calls |
| ------------------- | -------------- |
| 1                   | 9              |
| 10                  | 90             |
| 20                  | 180            |
| 38                  | 342            |

Plus two fixed calls. Two caches sit in front of this — a 1-hour TTL `Map` in
`src/utils/cache.ts` with promise deduplication, and Next's own `fetch` cache
(`revalidate: 300`) — but **the `Map` is module scope, so it dies with every
serverless instance.** On Vercel, a cold request late in the season pays the full
344-call bill.

That cost, not upstream latency, is the argument for persisting finished gameweeks.
See [ARCHITECTURE.md → Where to draw the persistence line](./ARCHITECTURE.md#where-to-draw-the-persistence-line).

---

## Testing these endpoints

A [Bruno](https://usebruno.com) collection lives in [`FPL Draft/`](../FPL%20Draft/) —
`prem/` hits upstream, `app/` hits `localhost:3000`. Its environment file still holds
the dead league ID `389464`; update it to match `FPL_LEAGUE_ID`.

From the shell:

```bash
curl -s "https://draft.premierleague.com/api/league/$FPL_LEAGUE_ID/details" | jq '.league.name, (.league_entries | length)'
curl -s "https://draft.premierleague.com/api/game" | jq
curl -sL "https://fantasy.premierleague.com/api/bootstrap-static/" | jq '.teams | length'
```

Note `-L` on the classic API for the trailing-slash redirect, and that port 3000 is
often taken by another project — `PORT=3100 pnpm start` is a safe default here.

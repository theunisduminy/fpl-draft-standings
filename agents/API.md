---
name: Better Draft — API reference
last_updated: 2026-08-24
---

# API.md — Every API We Call, and What Comes Back

Supporting reference doc, read on demand. This is the contract sheet for the three
Premier League APIs this app reads and the few routes it still exposes. If you are about
to `fetch()` anything, read the relevant section first — several of these endpoints
behave in ways the field names do not suggest.

| Doc                                  | Answers                                   |
| ------------------------------------ | ----------------------------------------- |
| [AGENTS.md](./AGENTS.md)             | How we work — conventions, the law        |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Where code lives and how a request flows  |
| **API.md** (this file)               | What we call upstream and what it returns |

---

## The three upstream APIs

All three are public, unauthenticated, undocumented, and season-scoped. None is versioned,
so treat every shape here as observed rather than guaranteed.

| API                       | Base URL                                     | What it gives us                                   |
| ------------------------- | -------------------------------------------- | -------------------------------------------------- |
| **Draft** (`draft.*`)     | `https://draft.premierleague.com/api`        | The league, its entries, standings, picks, scoring |
| **Classic** (`fantasy.*`) | `https://fantasy.premierleague.com/api`      | Clubs, gameweek metadata, the 380 fixtures         |
| **Pulse**                 | `https://footballapi.pulselive.com/football` | The **real** league table, fixtures and results    |

Every URL is built in [`src/utils/fpl-api.ts`](../src/utils/fpl-api.ts) — `fplApi` for the
two FPL games, `pulseApi` for Pulse. That module is the only place upstream URLs are
allowed to be written. It is `server-only`, so none of this reaches the browser.

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
whether the season has started — and the senior half of the "is this gameweek over?"
decision, because `event-status` cannot answer it alone (see the warning below it).

`current_event` is `null` pre-season. `current_event_finished` flips when the last
whistle of the gameweek blows, which is _earlier_ than `leagues_updated` — that one waits
for the draft league to be scored, bonus points included. The app requires both.

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

Processing status. Read the warning before using it — the name and the field names both
describe a gameweek, and the payload is a gameweek's **match days**.

Observed 2026-08-24, mid-GW1:

```json
{
  "status": [
    {
      "bonus_added": false,
      "date": "2026-08-21",
      "event": 1,
      "leagues_updated": true,
      "points": "p"
    },
    {
      "bonus_added": false,
      "date": "2026-08-22",
      "event": 1,
      "leagues_updated": true,
      "points": "p"
    },
    {
      "bonus_added": false,
      "date": "2026-08-23",
      "event": 1,
      "leagues_updated": true,
      "points": "p"
    },
    {
      "bonus_added": false,
      "date": "2026-08-24",
      "event": 1,
      "leagues_updated": false,
      "points": ""
    }
  ],
  "leagues": ""
}
```

> [!WARNING]
> **One row per date, not per gameweek.** `leagues_updated` means "the league table was
> brought up to date after _that day's_ matches", so it goes true on the opening Friday
> night with three days of football still to play. `status.some((s) => s.leagues_updated)`
> — or `Math.max` over the filtered rows — therefore reports the gameweek complete while
> it is still being played. That is exactly what happened to GW1 of 2026/27: combined
> with the all-zero live feed below, the app wrote eight managers on 0 points and joint
> first into `gameweek_scores` as final, paying every one of them a win and 20 F1 points.
> A finalised gameweek is never refetched, so it stayed wrong until the rows were
> deleted by hand.
>
> A gameweek is finished only when **every** row for that event says `leagues_updated`
> **and** `/api/game` says `current_event_finished`. That rule lives in one place:
> `deriveSeasonState()` in [`src/utils/season-state.ts`](../src/utils/season-state.ts).

- Rows only cover the current gameweek's dates, so nothing in this payload can speak for
  earlier gameweeks. `current_event` moving on is the evidence that those are done.
- **404s pre-season** with the bare string `"Game not started"` — see the warning above.

Consumed by: `fetchEventStatus()` in `gameweek-data.ts`, and only ever through
`deriveSeasonState()`.

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

The app reads two fields: `elements[id].stats.total_points` to score, and
`elements[id].stats.minutes` to decide whether the gameweek has started at all.

Verified 2026-08-24, mid-GW1: 609 elements, 279 of them with `minutes > 0`.

> [!WARNING]
> **A full `elements` map is not the same as a scored gameweek.** There are two "nothing
> yet" shapes and they arrive in sequence: `{}` before the gameweek's fixtures exist, then
> **every element in the game on `minutes: 0` and `total_points: 0`** from the moment they
> do — hours before kick-off. `Object.keys(elements).length === 0` catches the first and
> not the second, which is how eight managers summed to 0, tied on rank 1, and were
> written to the database as final. Go through `hasBeenPlayed()` in
> [`src/utils/scoring.ts`](../src/utils/scoring.ts), which asks whether anyone has
> actually taken the field.

### `GET /api/entry/{entryId}/event/{gameweek}`

One team's picks for one gameweek. Note this takes **`entry_id`**, not the league entry `id`.

The app reads `picks[]`, using `pick.position` (1–11 are starters, 12–15 bench) and
`pick.element` (the element ID to look up in the live response).

- **404s with `"No pick history"`** until that entry has actually played a gameweek.
  `fetchGameweekBatch` catches this and substitutes `{ picks: [] }` — which is why the
  empty-`elements` guard matters so much.

Two callers, for opposite purposes. `fetchGameweekBatch` reads all eight entries for a
gameweek to score it. `getGameweekSquad` (`src/utils/gameweek-squad.ts`) reads one entry
for one gameweek, joined against the live feed and the draft bootstrap, to show a team
sheet in the results drawer — a historical question, which is why it uses picks rather
than `element-status` the way the squads page does. It treats the 404 as "no team sheet",
which is an empty state, not an error.

Verified 2026-08-24: `picks[]` carries `element`, `position`, `is_captain`,
`is_vice_captain` and `multiplier`. The draft game has no captaincy, so `multiplier` is
`1` on all fifteen and the app ignores it.

> _404 as of 2026-08-13_, the day after the draft — the endpoint stays unavailable until
> the gameweek's deadline passes, not merely until squads exist. **To read a squad before
> the season starts, use `element-status` instead.**

> [!NOTE]
> **The starting-XI sum can differ from `standings[].event_total` by a point or two
> mid-gameweek**, because the standings table refreshes on its own schedule while the live
> feed is immediate. Observed on 2026-08-24: one manager on 26 by our sum, 24 upstream.
> The app prefers its own sum — it is fresher, and it is the same rule used for every
> finalised gameweek, so a provisional rank does not change method when it settles.

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

**This is the payload the reference tables exist to stop re-downloading.** It is ~850 KB
and carries `code` on every element and every club, both season-stable — 584 of 584 and 20
of 20, verified against the live payload. That is why one fetch populates both
`draft_elements` and `pl_teams`: the draft bootstrap's `teams` already carry the `code`,
`name` and `short_name` that `/profile` otherwise reads from the classic bootstrap, and
`code` is the one club identifier the two APIs agree on.

`/api/cron/revalidate` fetches it with `cache: 'no-store'`. Going through the ordinary
six-hour fetch cache would re-upsert a payload up to six hours old while stamping
`synced_at` as now — a table that looks fresh and is stale, and a cron frequency that buys
nothing.

> [!WARNING]
> **`elements[].total_points` is last season's until just before GW1.** Upstream carries
> the previous season's totals through the whole pre-season and resets them shortly before
> the first deadline. Observed on 2026-08-14, with `current_event: null` and GW1's deadline
> a week away: 400 of 587 elements had non-zero `total_points` **and** non-zero `minutes` —
> Haaland on 239 points from 2953 minutes and 34 starts — while `event_points` was 0 for
> every player.
>
> So a squad rendered in pre-season shows last year's points against players who have not
> kicked a ball this season. That is upstream's number, not a stale sync, and it corrects
> itself on kick-off. `events.current === null` (or `/api/game`'s `current_event`) is how
> to tell the two apart if you ever need to.

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

**`teams`** (20) — read through `getPremierLeagueTeams()` in `src/utils/pl-teams.ts`:

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

All 380 fixtures. No consumer in the app; `fplApi.fixtures()` builds the URL.

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

## Pulse API (`footballapi.pulselive.com/football`)

The API behind premierleague.com itself. It answers the one question neither FPL game can:
**what is the actual league table?**

The classic bootstrap's `teams` objects carry `played`, `win`, `draw`, `loss`, `points` and
`position` — and leave every one of them at `0`. Deriving a table from finished fixtures
instead was considered and rejected: it cannot see a points deduction, so it would disagree
with the official table by a few points in exactly the season where that matters, and it
would do it silently. **There is deliberately no fallback.** If Pulse is unreachable,
`/premier-league` says so.

URLs are built by `pulseApi` in [`src/utils/fpl-api.ts`](../src/utils/fpl-api.ts), and read
through `fetchPulse` — not `fetchUpstream`.

### Every request needs an `Origin` header

```
Origin: https://www.premierleague.com
```

No key, no cookie, nothing else. Without it the response is a `403`, which reads as "the
Premier League page is down" rather than as a missing header — hence `fetchPulse` existing
at all, so no call site can forget.

> **Unverified from a laptop:** whether Pulse serves Vercel's egress IPs. It works from a
> development machine and from CI. Check the deployed page after the first production
> release; if it 403s there and not locally, that is the cause, not the header.

### `compSeasons` is season-scoped — never hard-code it

Exactly like `FPL_LEAGUE_ID`. A new ID is minted every summer.

### `GET /competitions/1/compseasons?pageSize=50`

Competition `1` is the Premier League. Returns `{ pageInfo, content: [{ id, label }] }`.

```json
{ "id": 841, "label": "English Premier League Season 2026/2027" },
{ "id": 777, "label": "2025/26" },
{ "id": 719, "label": "2024/25" }
```

> **Pick the highest `id`; never parse the label.** Those three lines are one real response.
> The labels are not one format, and `"2025/26"` sorts above `"English Premier League…"`
> alphabetically. `newestCompSeasonId()` takes the max, and a test pins it.

### `GET /standings?compSeasons={id}&altIds=true&detail=2`

The league table. `detail=2` is what adds `form`, `annotations` and the home/away splits;
without it you get positions and totals only.

```json
{
  "compSeason": { "id": 841, "label": "…" },
  "tables": [
    {
      "gameWeek": 0,
      "entries": [
        {
          "team": {
            "name": "Arsenal",
            "id": 1,
            "club": { "name": "Arsenal", "abbr": "ARS", "id": 1 },
            "altIds": { "opta": "t3" }
          },
          "position": 1,
          "startingPosition": 1,
          "overall": {
            "played": 0,
            "won": 0,
            "drawn": 0,
            "lost": 0,
            "goalsFor": 0,
            "goalsAgainst": 0,
            "goalsDifference": 0,
            "points": 0
          },
          "home": { "…": "same shape" },
          "away": { "…": "same shape" },
          "form": [],
          "annotations": [{ "type": "Q", "destination": "EU_CL" }]
        }
      ]
    }
  ]
}
```

> **Out of season this returns all 20 clubs on zero, not an empty array.** `entries.length`
> is `20` in August, so a length or truthy check answers "we have a table" about a page of
> noughts — the same trap as `elements: {}` on the draft live endpoint. The tell is
> `tables[0].gameWeek`, which is `0` until the first match. Go through `hasSeasonStarted()`.

- **`form`** is an array of past _fixtures_, not letters. Whether `outcome: "H"` is a win
  depends on which side of `teams` the club was on — `formFrom()` derives it, and a test
  pins the away case.
- **`startingPosition`** is absent pre-season, which is why `movement` is `number | null`
  rather than defaulting to `0`.
- **`annotations[].destination`** — the four observed values are not the ones the branding
  suggests. Verified against two seasons:

  | Code    | Means             | Seen in          |
  | ------- | ----------------- | ---------------- |
  | `EU_CL` | Champions League  | 2024/25, 2026/27 |
  | `EU_EL` | Europa League     | 2026/27          |
  | `EU_UC` | Conference League | 2024/25          |
  | `EN_CH` | Relegation        | 2026/27          |

  **Relegation is `EN_CH`** — Pulse names the _destination competition_, the English
  Championship, not a status. There is no `RELEGATED`, and the Conference League is `EU_UC`
  rather than `EU_UECL`. `LeagueTable` looks each code up and renders no stripe for one it
  does not know, so a fifth code appearing is a missing marker, never a wrong one.

### `GET /fixtures?comps=1&compSeasons={id}&pageSize=400&page=0&sort=asc&statuses=U,L,C&altIds=true`

All 380 fixtures in **one** response — at `pageSize=400` the reply is `numPages: 1`, so this
never needs paging. `statuses=U,L,C` is upcoming, live and complete, which is everything.

```json
{
  "gameweek": { "gameweek": 1, "compSeason": { "id": 841 } },
  "kickoff": { "millis": 1787338800000, "label": "Fri 21 Aug 2026, 20:00 BST" },
  "teams": [
    { "team": { "name": "Arsenal", "altIds": { "opta": "t3" } }, "score": 2 },
    {
      "team": { "name": "Coventry City", "altIds": { "opta": "t9" } },
      "score": 0
    }
  ],
  "ground": { "name": "Emirates Stadium", "city": "London" },
  "status": "C",
  "outcome": "H",
  "clock": { "secs": 5700, "label": "90+5'00" },
  "goals": [
    { "personId": 25474, "assistId": 67546, "clock": { "label": "74'00" } }
  ],
  "id": 128923,
  "altIds": { "opta": "g2645195" }
}
```

- **`teams` is `[home, away]` by position.** Pulse encodes the venue by index, not by a
  field, so nothing may sort or filter that array in place.
- **`status`** is `U` upcoming, `L` live, `C` complete — a real state machine, where the
  classic API spreads the same information over `started`, `finished` and
  `finished_provisional`.
- **`score` is absent until kick-off, and `0` is a real score.** Test
  `typeof score === 'number'`, never truthiness, or a completed goalless draw renders as a
  fixture yet to be played.
- **`clock` survives full time** (`90+5'00` on a finished match), so it is only shown while
  `status` is `L`.
- **`goals[]` carries `personId`, not a name.** Rendering scorers would need a further
  lookup; the app does not currently do it.
- **Use `kickoff.label`, never `kickoff.millis`, for anything rendered.** The label is
  already localised to UK time, which is the right zone for a Premier League kick-off, and
  it is a string, so it renders identically on the server and in the browser. Formatting the
  millis instead paints the server's timezone first and the reader's after hydration — a
  visible flip and a hydration warning. `groupByDay` takes the matchday heading from
  `"Sat 22 Aug 2026, 12:30 BST"` by one split on the comma, so the heading and the times
  printed under it come from one string and cannot disagree.
- **`kickoff` can be absent.** A fixture moved for television loses its slot for weeks;
  those collect under `DATE_TBC` rather than being dropped or dated.
- **`altIds.opta`** is `"g" + the classic API's fixture `code``, if a Premier League result
  ever needs joining to an FPL gameweek.

### The crest join is free

`team.altIds.opta` is `"t"` followed by **exactly** the `teams[].code` the classic bootstrap
uses — verified across all 20 clubs of the 2026/27 season (`ARS → t3`, `BOU → t91`,
`BRE → t94`). Since [`clubCrestUrl`](../src/utils/pl-assets.ts) builds
`…/badges/t{code}.svg`, Pulse hands over the crest key directly.

That is why `/premier-league` makes **no FPL call at all** and needs no club mapping table.
`optaTeamCode()` recovers the number, and a club whose alt-ID does not parse is dropped
rather than rendered with a guessed code — the asset host answers a wrong code with `403`,
which is a broken image and nothing in the log.

---

## Images (`resources.premierleague.com`)

Not an API — an asset host, and the only upstream URLs deliberately **not** in
`fpl-api.ts`. These images are loaded by the browser, so the builders have to be
importable from a client component, and `fpl-api.ts` is `server-only`. They live
in [`src/utils/pl-assets.ts`](../src/utils/pl-assets.ts) instead; that file is
still the single place the URLs are written.

```
https://resources.premierleague.com/premierleague/badges/t{teamCode}.svg
https://resources.premierleague.com/premierleague/photos/players/{size}/p{elementCode}.png
```

**Both take a `code`, never an `id`.** Codes are stable across seasons; the
sibling `id` fields are re-minted every August, so a URL built from one silently
returns a different club or a different footballer.

- **Crests.** `{teamCode}` is `teams[].code` — from either bootstrap, they
  agree (Arsenal is `code` 3, `id` 1 in both). All 20 current clubs return
  `200 image/svg+xml`. `badges/50/t{code}.png` is the raster equivalent.
- **Photos.** `{elementCode}` is `elements[].code` — six digits, not the 1–581
  of `ElementId`. `{size}` is one of `40x40` (16 KB), `110x140` (108 KB) or
  `250x250` (331 KB); only the first is sane in a list of fifteen.
- **A bad code answers `403`, not `404`** — and never a placeholder. Nothing
  reaches a log, so anything rendering a photo needs an `onError` fallback;
  `PlayerPhoto` draws initials. Squad entries appear days before photos do.
- **The season-scoped prefixes `403`.** `premierleague25/badges/…` fails; only
  the unversioned `premierleague/…` prefix works.

---

## Our own routes (`src/app/api/**`)

**There are two route handlers, and only one of them is ours.**

| Route                  | Returns                          | Backed by                                     |
| ---------------------- | -------------------------------- | --------------------------------------------- |
| `/api/auth/[...path]`  | Neon Auth's own handler          | `auth.handler()`                              |
| `/api/cron/revalidate` | Per-step sync outcomes, and `ok` | the reference DAL + `computeSeasonUncached()` |

`/api/cron/revalidate` is the sync job: every three hours it refreshes
`draft_elements` and `pl_teams` from the draft bootstrap, writes any newly
finalised gameweek, then expires the cache tags, clears the in-memory map and
re-warms. Its caller is Vercel Cron rather than a person, so it authenticates
with a constant-time bearer `CRON_SECRET` comparison and `src/proxy.ts` excludes
`/api/cron` from the sign-in redirect. That exclusion buys authentication
written by hand; it does not make the path public, and nothing else may be
excluded without the same work.

Every page is an `async` Server Component calling `getGameweekData()` or the DAL directly,
so an `/api/*` route only ever existed to feed a component. `/api/standings`,
`/api/gameweek-data`, `/api/rumbler` and `/api/player/[id]` went when the pages stopped
needing them; `/api/matches`, `/api/current-event`, `/api/pl-teams` and `/api/pl-fixtures`
followed once nothing in the repo imported them either. Each was a few lines wrapping a
call the server can make directly — `/api/pl-teams`, for instance, wrapped
`getPremierLeagueTeams()`, which the profile page already calls itself.

**Before adding one back, note that `src/proxy.ts` matches `/api/*`.** An unauthenticated
caller gets `307 → /auth/sign-in`, so "an external consumer needs it" is not yet a reason
that works — there is no way for an external consumer to authenticate. Design that first.

If you do add one: `src/app/api/<name>/route.ts`, export `GET`, and fail with
`{ error, message }` and a 500.

### Pre-season responses

With no gameweeks played, the pipeline returns a valid empty season rather than
failing: all 8 entries present with `f1_score: 0`, `total_points: 0` and zeroed
`position_placed`; `gameweekPerformances: []`; `rumblerData: []`;
`completedGameweeks: []`; and `currentGameweek: 0`.

The pages render that state as content, not as an error: standings list all eight managers
on zero, and results and rumblers show their empty-state copy.

---

## How `getGameweekData()` works, and what it costs

[`src/utils/gameweek-data.ts`](../src/utils/gameweek-data.ts) is the whole data layer.
One call:

1. Reads `FPL_LEAGUE_ID`, then fetches league details, event status, `/api/game` and the
   two database reads in parallel.
2. Derives `{ currentGameweek, finalisedThrough }` through `deriveSeasonState()` — the
   only place "is this gameweek over?" is decided.
3. For every **finalised** gameweek not already stored, fetches the live data **and all 8
   entries' picks**, in batches of 5, and writes the result to `gameweek_scores`.
4. Sums `total_points` over each entry's starting XI (`position <= 11`).
5. Ranks the 8 entries within the gameweek and awards F1 points —
   `[20, 15, 12, 10, 8, 6, 4, 2]`.
6. **Scores the gameweek in flight the same way and never stores it**, marking it
   `finished: false` and naming it in `provisionalGameweek`. A league table that ignores
   the weekend being played is wrong on the one day everybody looks at it; a provisional
   rank shown as settled is worse. Both are needed, which is what the flag is for.
7. Aggregates into `players`, `rumblerData`, `scoredGameweeks`.

**The cost is the problem.** Each gameweek costs `1 + 8 = 9` upstream calls, and the
whole history is recomputed from scratch:

| Completed gameweeks | Upstream calls |
| ------------------- | -------------- |
| 1                   | 9              |
| 10                  | 90             |
| 20                  | 180            |
| 38                  | 342            |

Plus three fixed calls, and nine more for the gameweek in flight, which is recomputed on
every cache miss rather than stored. Two caches sit in front of this — a 5-minute TTL
`Map` in `src/utils/cache.ts` with promise deduplication, and Next's own `fetch` cache
(`revalidate: 300`) — but **the `Map` is module scope, so it dies with every
serverless instance.** On Vercel, a cold request late in the season pays the full
344-call bill.

The TTL matches the `revalidate` on the calls beneath it. It was an hour, on the
reasoning that FPL data changes once per gameweek; that stopped being true when the
season started including the gameweek in progress, and caching an aggregate for longer
than its own inputs froze a live score at whatever it was an hour ago.

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

---
name: Better Draft
last_updated: 2026-08-13
---

# Better Draft Strategy

> One of four backbone documents in [`agents/`](./). Peers: [`AGENTS.md`](./AGENTS.md) for
> conventions, [`ARCHITECTURE.md`](./ARCHITECTURE.md) for the system map,
> [`FRONTEND.md`](./FRONTEND.md) for UI patterns. This file is the _why_; those are the
> _how_ and _where_.

## Target problem

An eight-man Fantasy Premier League draft league runs for nine months, and the official
standings do a poor job of two things at once.

**It scores the wrong thing.** Classic draft scoring ranks on cumulative points, so one
enormous gameweek can carry a manager who is otherwise mediocre; head-to-head scoring is
worse, handing out wins and losses on fixture luck. Neither answers the question the league
actually argues about — who has been consistently good, week after week.

**It gives you nothing to talk about.** The official site is a table. A private league is a
nine-month group chat, and the table is only interesting as raw material for the argument.
Who has finished last most often? Who is in form? Who is quietly climbing? None of that is
one click away.

## Our approach

Two bets, weighted roughly equally.

**Bet one: F1 scoring is a fairer league table.** Each gameweek, rank the eight managers 1–8
on that week's starting-XI points and award Formula One points — 20, 15, 12, 10, 8, 6, 4, 2.
A blowout week is worth 20, not 140, so the season rewards turning up every week rather than
spiking once. The official total is still shown alongside; we are offering a second opinion,
not hiding the first.

**Bet two: the stats and the banter are the product.** The Rumbler (last place each week) is
a hall of shame with its own page. Form guides, position distributions and trajectory charts
exist because they settle arguments. The table is the commodity; the reasons to open the app
on a Monday morning are everything around it.

These reinforce each other: F1 scoring creates a weekly ranking, and a weekly ranking is
what makes rumblers, streaks and form guides expressible at all.

## Who it's for

**Primary:** the eight managers in the Draft Cup league (`FPL_LEAGUE_ID=8337`). They are the
entire user base and they all know each other. Their job-to-be-done is settling arguments
and generating new ones.

**Secondary:** nobody, deliberately. This is not a product looking for other leagues — see
_Not working on_.

## Key metrics

Given an eight-person audience, conventional product metrics would be noise. These are the
signals that actually indicate the app is working.

- **Weekly return rate** — how many of the eight open the app in the 48 hours after a
  gameweek settles. _Leading._ The single honest measure of whether it earns its place in
  the group's routine.
- **Arguments per gameweek** — how often the app gets screenshotted or cited in the group
  chat. _Leading, deliberately informal._ It measures bet two directly, and no dashboard
  will capture it.
- **Cold-load time on the standings page** — time to real content, not to spinner.
  _Leading._ Currently gated by a client fetch over a recompute that reaches 344 upstream
  calls by season's end. If the app is slow on a Monday it does not get opened on a Tuesday.
- **Season completion** — whether the league is still using it in May. _Lagging._ The only
  verdict that counts.

> _TODO (owner)_ — none of these are instrumented. Vercel Analytics is already installed and
> would cover the first and third.

## Tracks

### Server Components refactor — **done**

Every page now reads its own data in an `async` Server Component calling
`getGameweekData()` directly. `use-table-data.ts`, `apiHelper.ts`, `fetchWithDelay.ts` and
four `/api/*` routes are gone; the HTML ships with the content in it, `/` makes one read
instead of two overlapping browser fetches, and the `react-hooks` warnings cleared with it.

### Type the FPL API properly — **done**

League details, event status, live elements and picks now have real interfaces in
`src/interfaces/fpl.ts`, built from the shapes captured in [`API.md`](./API.md). The `any`
count fell from ~26 to 3.

The part worth keeping in mind: the three FPL identifiers (`LeagueEntryId`, `EntryId`,
`ElementId`) are **branded**, so the compiler rejects mixing them.

_Why it served the approach:_ the two worst bugs this codebase has had — a fabricated
700-point standings table and a crash on a bare-string 404 — were both shape bugs at the
upstream boundary. Types are the cheapest insurance available.

### New stats and visualisations

More of what bet two is made of: head-to-head records, waiver and trade analysis, streaks,
projections.

_Why it serves the approach:_ this is bet two, stated directly. Each new view is another
reason to open the app mid-week.

### Design refresh

Rework the visual language, typography and layout beyond the current dark purple treatment.
Note that `font-inter` is currently a dead class — Inter is loaded but never applied — which
makes typography the natural first move.

_Why it serves the approach:_ if the app is going to beat the official site as the place the
league looks, it has to feel better than the official site.

### Member profiles and weekly bets

Give each of the eight a profile, then let them post weekly side bets against each other —
"I bet I finish above you", "I bet you're older than me" — and record the outcome.

_Why it serves the approach:_ this is the strongest possible version of bet two. It stops
the app merely reporting the banter and makes it the place the banter happens. It is also
the first feature that needs identity and persistence, so it sets the architecture agenda —
see [`ARCHITECTURE.md`](./ARCHITECTURE.md#where-to-draw-the-persistence-line).

### Weekly results email

Send a results summary after each gameweek settles: final ranks, F1 points awarded, the
rumbler, notable swings.

_Why it serves the approach:_ it inverts the weekly return metric — instead of hoping people
remember to visit, the results arrive. Sharing into the league's WhatsApp group is the
preferred delivery and is **unresolved**: the WhatsApp Business API needs an approved
template and a registered number, which is heavy for eight people. A shareable web summary
page, pasted into the group by hand, is the pragmatic first version.

> _TODO (owner)_ — pick an email provider, and decide whether WhatsApp is worth the setup.

## Milestones

- **2026-08-12** — Pre-season foundation: league ID moved to `FPL_LEAGUE_ID`, pre-season API
  breakage fixed, dependencies upgraded to Next 16 / React 19 / Tailwind 4, `src/`
  restructure, `agents/` docs established.
- **2026-08-21** — GW1 deadline. First live data; the unverified payload shapes in
  [`API.md`](./API.md) can finally be confirmed.
- **2026-Q3** — Server Components refactor and typed API payloads.
- **2026-Q4** — Profiles and weekly bets; persistence lands.
- **2027-Q1** — Weekly results email.

> _TODO (owner)_ — the Q-dated items are sequencing, not commitments. Tighten them once GW1
> data is in.

## Not working on

- **Multi-league support.** One league at a time via `FPL_LEAGUE_ID`. Not a general-purpose
  tool other leagues can sign up for, and not a SaaS. This keeps the data model at eight
  known people and lets the app assume a lot.
- **A native or mobile app.** Responsive web only.
- **Beating the official app at its own game.** No live match tracking, no transfer
  suggestions, no price-change alerts. Better Draft is a second opinion on the standings
  plus the argument layer, not a replacement FPL client.

## Marketing

**One-liner:** A fairer league table for your FPL draft — every gameweek ranked, F1 points
awarded, and a permanent record of whoever finished last.

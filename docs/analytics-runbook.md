# Analytics runbook

Monday procedure for answering how a settled gameweek performed, using the
Vercel Analytics and Speed Insights streams that already fire on the
production deployment. No new code, no new routes, no new dependencies.

Metric names and definitions live in `agents/STRATEGY.md`. This file maps each
one to a dashboard read. Read the strategy section first when the wording here
and there differ. The strategy wins.

## Instrumentation already in place

Both components are mounted in `src/app/layout.tsx` and fire on every route,
including the server rendered pages that call `getGameweekData()`:

- `Analytics` from `@vercel/analytics` collects page views and visitors.
- `SpeedInsights` from `@vercel/speed-insights` collects web vitals.

Both packages are listed in `package.json`. Page views and vitals start
flowing once the production deployment serves traffic. There are no `track()`
calls and none are planned. A missing stream means a Vercel project setting,
not a code gap. See the section on a missing stream below.

Read the dashboards at the Vercel project for this app, on the Analytics tab
and the Speed Insights tab. Scope every read to the production deployment and
to the path named in each section. Preview deployments are noise, not signal.

## Settled marker and the 48 hour window

The 48 hour window starts when the gameweek is final under the rule in
`src/utils/season-state.ts`, not when the last whistle blows.

A gameweek is final when both upstream sources agree:

- any gameweek below `current_event` is over because the game has moved on,
- `current_event` itself is over only when `/api/game` reports
  `current_event_finished` as true and every `event-status` row for that event
  reports `leagues_updated`.

In practice this is the point where `deriveSeasonState()` advances
`finalisedThrough` past the gameweek and the sync job in
`src/app/api/cron/revalidate/route.ts` stores it. Start the 48 hour clock
there. If the gameweek is still in flight on Monday morning, wait for the
marker before counting. A gameweek counted early understates return and mixes
provisional traffic into the baseline.

Full context on why both sources must agree is in `agents/AGENTS.md` and
`agents/API.md`.

## Weekly return rate

Strategy metric: weekly return rate. Dashboard read: visitors and page views
on `/` in the 48 hours after the settled marker.

Steps:

1. Confirm the settled marker above has flipped for the gameweek.
2. In Analytics, scope to the production deployment and filter to path `/`.
3. Read unique visitors and page views for the 48 hour window starting at the
   marker.
4. Record both numbers against the denominator of eight. A full house is eight
   of eight visiting at least once.

This is the single honest measure of whether the app earns its place in the
group routine. Page views show depth of interest. Visitors show breadth.

## Cold-load time on the standings page

Strategy metric: cold-load time on the standings page. Dashboard read: Speed
Insights LCP p75 on `/`.

Steps:

1. In Speed Insights, scope to the production deployment and filter to path
   `/`.
2. Read LCP p75 for the same 48 hour window used for weekly return rate.
3. Record the value with the date and the gameweek number.

This answers how slow the cold load was on the morning the league looks. Time
to real content is what matters, not time to spinner. Finished gameweeks
persist in Postgres so a cold start costs one query rather than a full
recompute, which is why this number should stay flat across the season.

## Season completion

Strategy metric: season completion. Dashboard read: monthly visitor retention
into May.

Steps:

1. Once a month, read unique visitors on `/` in Analytics for the production
   deployment.
2. Track how many of the eight still open the app at least once per settled
   gameweek as the season runs into May.
3. Record the monthly count in the same log as the weekly readings so the
   trend is visible.

This is the lagging verdict that counts: whether the league is still using
the app in May.

## Arguments per gameweek

Strategy metric: arguments per gameweek. This one has no dashboard read, by
design. It is deliberately informal: how often the app gets screenshotted or
cited in the group chat. Note it alongside the dashboard numbers when it
happens. Do not try to instrument it.

## Denominator and accepted noise

The denominator is eight. The league is eight known managers and every count
is read against that number.

Accepted noise:

- Ad blockers suppress a share of page views and vitals. Expect undercounting
  and treat the numbers as a lower bound.
- Preview deployments generate traffic that must be filtered out by scoping
  to production.
- Stranger traffic is possible but rare for a sign in gated app. Where the
  dashboard allows audience or page filtering, isolate the eight managers.
  Where it does not, record raw visitor counts with the denominator of eight
  as context.

None of this noise needs fixing. Consistency of method matters more than
precision of count.

## First readings as baseline

The strategy currently lacks baselines. The first full Monday after a settled
gameweek sets them:

1. Follow the weekly return rate and cold-load time reads above on the first
   Monday where the settled marker has flipped.
2. Log visitors, page views and LCP p75 with the date and gameweek number.
3. Treat those three numbers as the baseline to beat.

Leave the owner TODO in `agents/STRATEGY.md` in place until baselines exist.
Clearing it is a follow up once the first readings are logged, and is out of
scope for the plan in
`docs/plans/2026-09-13-004-feat-cold-load-contract-plan.md`.

## Monday checklist

Under ten minutes when the gameweek has settled:

1. Check the settled marker has flipped. If not, stop and retry after it does.
2. Scope Analytics and Speed Insights to the production deployment.
3. Log visitors and page views on `/` for the 48 hour window.
4. Log LCP p75 on `/` for the same window.
5. Note any screenshots or citations in the group chat.
6. Append the row to the baseline log with date and gameweek number.

## If a stream is missing

A missing Analytics or Speed Insights stream means a Vercel project setting,
not a code gap. Both components ship in `src/app/layout.tsx` and both
packages ship in `package.json`, so there is nothing to add in source.

Check in order:

1. The dashboard is scoped to the production deployment, not a preview.
2. The Vercel project has Analytics and Speed Insights enabled for that
   project.
3. The production deployment serving traffic includes the mounted components.

Record the outcome here or in the pull request when verifying. Do not add
tracking calls or routes to fix a dashboard setting.

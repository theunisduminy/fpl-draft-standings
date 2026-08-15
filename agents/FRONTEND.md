# Frontend patterns

The rules in this file are conventions we don't deviate from without a strong reason.
They're meant to prevent the slow drift toward inconsistent UI.

[`AGENTS.md`](./AGENTS.md) is the canonical source for project conventions (the server-only
boundary, British English, sentence case, pnpm). This file extends it with frontend-specific
patterns. Where the two conflict, `AGENTS.md` wins.

---

## The one boundary rule for frontend

**A client component never imports `@/utils/fpl-api` or `@/utils/gameweek-data`.**
`fpl-api.ts` is marked `server-only`, so violating this fails the build rather than leaking
into the bundle.

**Reads happen in the page.** An `async` Server Component calls `getGameweekData()` or the
DAL and passes plain, serialisable data down. Client components are **leaves**: they own
interaction — tab state, the gameweek selector, chart rendering — and nothing else. If you
find yourself wanting a fetch inside a component, the data belongs one level up, as a prop.

`'use client'` is a cost, so push it down. `StandingsTabs` is client (tab state) while
`PositionPlacedTable` beneath it is not; the marker goes on the smallest subtree that
genuinely needs the browser.

---

## Component library — primitives first

- **shadcn primitives only.** Use `src/components/ui/`. Never raw `<table>`, `<select>`,
  `<button>` for UI controls — use `Table`, `Select`, `Button`.
- **Add via the CLI.** `pnpm dlx shadcn@latest add <component>`. `components.json` is
  already v4-shaped (`config: ""`, `css: src/app/globals.css`); don't hand-roll a component
  the registry has.
- **`chart.tsx` is a local fork, not stock shadcn.** It was rewritten for recharts v3 and
  React 19 (see [`TECH-STACK.md`](./TECH-STACK.md#notable-why-x-decisions)). **Do not
  overwrite it by re-running the shadcn CLI for `chart`** — you will reintroduce v2 types
  and break the typecheck.

## Component placement

Components are grouped by the view they serve, not by type:

| Folder                              | Holds                                                                                                                                            |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/components/ui/`                | shadcn primitives. Nothing app-specific.                                                                                                         |
| `src/components/TableView/`         | Standings, draft results, position tables, and the table base                                                                                    |
| `src/components/PlayerView/`        | Per-player charts, summary cards, form guide                                                                                                     |
| `src/components/RumblerView/`       | Rumbler cards, dashboard, frequency chart                                                                                                        |
| `src/components/SquadView/`         | Squad card and the picker that chooses one squad or two                                                                                          |
| `src/components/PremierLeagueView/` | The real league table, fixtures and results                                                                                                      |
| `src/components/Profile/`           | The onboarding form and its pieces                                                                                                               |
| `src/components/Layout/`            | `AppChrome`, `HeaderNav`, `SideNav`, `MobileNav`, `Footer`                                                                                       |
| `src/components/*.tsx` (root)       | Genuinely cross-view pieces only — `ErrorDisplay`, `SkeletonTable`, `GameweekSelector`, `PlayerLink`, `SectionTabs`, `ChartCard`, and a few more |

A component used by exactly one view belongs in that view's folder. Promote to the root only
when a second view imports it.

---

## Data tables — one base

**`BaseTable<T>` (`src/components/TableView/base-table.tsx`) is the canonical data table.**
Do not hand-roll a second one.

It already owns loading, error, and empty states — `SkeletonCard` while `loading`,
`ErrorDisplay` when `error && onRetry`, and an `emptyMessage` row when `data` is empty. Do
not re-implement any of those around it.

Columns are data, not JSX, and live in `table-configs.tsx`:

```ts
export const standingsTableConfig: TableColumn<PlayerDetails>[] = [
  { header: 'Player', key: (player) => <PlayerCell player={player} />, width: 'w-[50%]' },
  { header: 'F1 score', key: 'f1_score', align: 'right', width: 'w-[25%]' },
];
```

`key` is either a field name or a render function. Use `align`, `width`, `hideBelow`,
`className`, `cellClassName` and `rowClassName` rather than wrapping cells in extra divs.

**`width` is Tailwind classes, not a CSS length** — `'w-[45%] md:w-[34%]'`. A column that
changes width at a breakpoint cannot be expressed as an inline style, and an inline width
beats any class, so the two mechanisms could not be mixed on one table. **`hideBelow`**
(`'sm' | 'md' | 'lg'`) hides a column's header and its cells together; never write
`hidden md:table-cell` into `className` and `cellClassName` by hand, because the two halves
have to agree.

`hideBelow` resolves through the `HIDDEN_BELOW` literal map, and it must stay a literal map.
Building `` `hidden ${hideBelow}:table-cell` `` at runtime is a class Tailwind's scanner
never sees, so it generated no rule and every `sm` and `lg` column was invisible at **every**
width for as long as the code existed. See
[`AGENTS.md`](./AGENTS.md#never-assemble-a-tailwind-class-name-at-runtime) — the same trap
applies to any class a variable picks.

**A column config may be a function** when a cell needs something the component owns —
`draftResultsColumns(onViewTeam)`. Columns stay data and stay in `table-configs.tsx`
either way; do not assemble them inline in a component.

**Rank badges are shared.** Use `renderRankBadge(rank)` / `getRankBadgeClasses(rank)` from
`table-configs.tsx` — they encode the league's colour language (gold 1st, silver 2nd, bronze
3rd, red 8th). Never re-derive those colours inline; a change to the rank palette must be a
one-file change.

## Loading and error states

These are **route-level** concerns now, not component state. A component that receives its
data as a prop has no loading state and no error state to render.

- **Loading → an in-page `<Suspense>`**, plus a `loading.tsx` on routes that cannot 404.
  Never a bare spinner, never a layout-shifting `null`. See
  [`AGENTS.md`](./AGENTS.md#file-conventions) for why a `loading.tsx` above a route that
  _can_ 404 turns it into a 200.

  Three rules make the fallback worth having:

  1. **Wrap it in `SkeletonRegion`.** It carries the one `role='status'` + `aria-busy` and
     the single sr-only "Loading"; the bars themselves are `aria-hidden`. Without it a
     screen reader meets a grid of unlabelled empty cells.
  2. **`delayed` on the `loading.tsx` only, never the in-page fallback.** A soft-nav paints
     the route shell first, then the in-page one; if both delay, the second restarts the
     animation and flickers at the handoff.
  3. **Mirror the real layout.** Build the skeleton from the real wrappers — `TableSkeleton`
     renders the actual `<Table>` inside the actual `Card` — so nothing is a measured guess
     and the data landing causes no layout shift. Static text (headings, card titles, the
     selector label) renders for real; only what the data fills is a placeholder.

- **Error → `src/app/error.tsx`**, which renders `ErrorDisplay` and wires `onRetry` to
  Next's `reset()`, re-rendering the segment on the server. A page throws; it does not
  catch.
- **Missing → `notFound()`**, which renders `src/app/not-found.tsx` with a real 404.
- **Empty is not an error.** Pre-season the API legitimately returns zero gameweeks. Empty
  states say what is happening ("No gameweeks played yet"), not "Something went wrong".

## Charts

- **Always wrap in `ChartContainer`** with a `ChartConfig`, so series colours resolve from
  the config rather than being scattered through the chart.
- **`ChartTooltipContent` is the tooltip.** Don't build a custom one.
- **Chart colours come from `ChartConfig` or `src/utils/tailwindVars.ts`**, not inline hex
  in the chart body.
- **`ChartCard` is the wrapper**, not a hand-rolled `Card` + `CardHeader` + `CardTitle`. It
  owns the title size, the caption, and the `action` slot beside the title. Per-chart
  variation goes in `contentClassName`, which is the only thing that genuinely differs.
- Charts are client components by necessity — recharts needs the DOM. Keep the data shaping
  outside the component where you can, so the refactor to Server Components only has to move
  the fetch.

### Aspect ratio is `aspect-video`, and it lives in the primitive

`ChartContainer` defaults to `aspect-video`, not stock shadcn's `aspect-square`. A square is
wrong at both ends of the layout: at half width it towers over the card beside it, and at
full width it is as tall as the page is wide, which flattens every crossing on a line chart.

The lesson is the location of the fix, not the ratio. **Three consumers had each overridden
it independently before anyone changed the default** — a defect rediscovered more than once
belongs in the primitive. If you find yourself passing the same override a third time, that
is the signal.

### The rules that pick a colour or a scale live in `chart-scales.ts`

**Never derive a band, a ramp step, an axis tick or a series key inside a chart component.**
Those are rules, and rules go in [`src/utils/chart-scales.ts`](../src/utils/chart-scales.ts)
with tests beside them — `versusBand`, `heatStep`, `scaleTicks`, `seriesKey`, `bumpSeries`.
Five shipped defects lived in exactly that code while it was untested helpers inside
components; [`AGENTS.md`](./AGENTS.md#testing) lists them. Presentation logic never throws,
so nothing catches it but a test or an eye.

Two encoding rules follow from the same rework:

- **Encode magnitude, not only order.** A rank tells you who won; it cannot tell a one-point
  defeat from a hammering. If every chart on a page encodes rank, one of them should be
  showing margin instead.
- **Ordinal data gets a single-hue ramp, never a rainbow.** `--color-heat-*` is the
  sequential ramp for magnitude and `--color-versus-*` the diverging one for a two-sided
  comparison, both defined in `globals.css`. Categorical hues are for identity
  (`--color-series-*`) and nothing else. A diverging cell must print its number as well as
  its colour.
- **Floor a ratio on small samples.** One gameweek into a season every pair has met once, so
  every ratio is 1 or 0 and the whole grid saturates. Outer bands require
  `MIN_DECISIVE_MEETINGS`; anything that colours by proportion needs the same floor.

### Choose the axis the reader will compare along

Two shapes on the season tab were wrong for the question they answered, and both failures
were about what the eye can compare:

- **A stacked bar whose total is constant carries no information in its length.** Every
  manager plays the same number of gameweeks, so only the segment boundaries meant anything,
  and reading them asked for eight length comparisons buried inside one bar. A grid puts the
  same numbers on a shared scale: a column reads down, a row reads across.
- **A "last five" window must be chosen once for the card, not per row.** Taking each
  manager's own last five results and padding short rows meant a column could mean different
  gameweeks on different rows. Pick the gameweeks for the card, then look each manager up by
  event.

---

## Theming — tokens, not hex

- **Semantic tokens always**: `bg-background`, `text-foreground`, `text-muted-foreground`,
  `border-border`, `bg-card`, `bg-primary`. Never `text-gray-400` or a raw hex value.
- **The theme lives in `src/app/globals.css`**, in `@theme inline`. There is no
  `tailwind.config.js` — Tailwind v4 is configured in CSS. Adding `--color-brand: hsl(...)`
  there is what creates `bg-brand`.
- **The palette is HSL triplets in `:root`**, consumed as `hsl(var(--token))`. Keep that
  indirection: it is what makes the planned design refresh a single-file change.

- **A `backdrop-filter` promotes its whole subtree onto one composited layer**, where
  fractional pixel positions stop being snapped and text and icons read as slightly out of
  focus. That is what the `glass-panel` utility exists for: it paints the blur on a
  `::before` **behind** the panel, so the panel's own children stay on the normal layer. Use
  it rather than putting `backdrop-blur` on a container that holds content, and use `.glass`
  only for a purely decorative surface.
- **A hand-written rule in `globals.css` is unlayered, and unlayered beats `@layer
utilities`** — which is every Tailwind utility. `glass-panel` deliberately sets no
  `position` for exactly that reason: a `position: relative` there silently overrode the
  `fixed` on both navigations and dropped them into the page flow. A custom class states
  only what cannot be a utility, and the caller keeps positioning.

> **Known drift.** A number of components still hard-code the brand purple as
> `bg-[#2a0d33]`, `bg-[#1a0520]` and `border-white/10` — including `ErrorDisplay` and
> several cards, 77 occurrences at the last count. That predates this rule. Don't add more;
> fold the existing ones into the design refresh.

> **Check the token before trusting a `hover:` variant.** A stock variant is written against
> stock tokens, and ours are not stock: `--accent` here is a saturated cyan, not a near-white
> tint. The "View team" button went out illegible because its hover background and its hover
> text resolved to the same cyan. Read what the token actually is before relying on a
> variant's built-in hover pair.

---

## Naming and copy

- **British English** in all UI strings and comments — _colour_, _favourite_, _organise_.
- **Sentence case for all UI text.** "Position distribution", not "Position Distribution".
  Team names and player names are proper nouns and keep their own casing.
  > The current UI is inconsistent here (`Try Again`, `Match Predictions`). New and touched
  > copy follows the rule.
- **No em dashes in UI copy.** End the sentence, or use a colon. En dashes in ranges
  (`GW1–GW38`) are notation and are fine.
- **Domain words are fixed**: _rumbler_ (last place in a gameweek), _F1 score_, _entry_,
  _gameweek_. Don't invent synonyms.
- **Files:** components are `PascalCase.tsx`; shared primitives and configs are
  `kebab-case.tsx` (`base-table.tsx`, `table-configs.tsx`). Match the folder you are in.

---

## Reading order for frontend work

1. Skim this file.
2. Open the closest analogous surface — `StandingsTable.tsx` for a table,
   `RumblerFrequencyChart.tsx` for a chart, `PlayerSummaryCard.tsx` for a card.
3. Reuse the pattern. If you need something this file doesn't cover, add it here in the same
   change.

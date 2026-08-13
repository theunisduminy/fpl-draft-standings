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

| Folder                        | Holds                                                                                                                         |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `src/components/ui/`          | shadcn primitives. Nothing app-specific.                                                                                      |
| `src/components/TableView/`   | Standings, draft results, position tables, and the table base                                                                 |
| `src/components/PlayerView/`  | Per-player charts, summary cards, form guide                                                                                  |
| `src/components/RumblerView/` | Rumbler cards, dashboard, frequency chart                                                                                     |
| `src/components/DetailView/`  | Gameweek summary, score chart, match odds                                                                                     |
| `src/components/Layout/`      | `HeaderNav`, `MobileNav`, `Footer`                                                                                            |
| `src/components/*.tsx` (root) | Genuinely cross-view pieces only — `ErrorDisplay`, `SkeletonTable`, `GameweekSelector`, `PlayerLink`, `Select`, `ViewButtons` |

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
- Charts are client components by necessity — recharts needs the DOM. Keep the data shaping
  outside the component where you can, so the refactor to Server Components only has to move
  the fetch.

---

## Theming — tokens, not hex

- **Semantic tokens always**: `bg-background`, `text-foreground`, `text-muted-foreground`,
  `border-border`, `bg-card`, `bg-primary`. Never `text-gray-400` or a raw hex value.
- **The theme lives in `src/app/globals.css`**, in `@theme inline`. There is no
  `tailwind.config.js` — Tailwind v4 is configured in CSS. Adding `--color-brand: hsl(...)`
  there is what creates `bg-brand`.
- **The palette is HSL triplets in `:root`**, consumed as `hsl(var(--token))`. Keep that
  indirection: it is what makes the planned design refresh a single-file change.

> **Known drift.** A number of components still hard-code the brand purple as
> `bg-[#2a0d33]`, `bg-[#1a0520]` and `border-white/10` — including `ErrorDisplay` and
> several cards. That predates this rule. Don't add more; fold the existing ones into the
> design refresh.

> **Known bug.** `font-inter` is applied to `<body>` but no theme entry maps it, so the app
> renders in the default sans stack despite loading Inter. Fixing it changes the typography
> of the whole app, so it belongs to the design refresh rather than a drive-by edit.

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

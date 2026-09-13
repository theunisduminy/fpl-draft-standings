/**
 * Layout constants that a **server** component and a **client** component both
 * need to agree on.
 *
 * This module exists because of the boundary, not because the values belong
 * together thematically. A route's `loading.tsx` is a Server Component, and its
 * skeleton has to draw a placeholder the exact size of a control that only
 * renders on the client — so the size has to live somewhere both can read.
 *
 * Importing it from the client module instead is what this replaces, and it is
 * not free: Next's RSC compiler wraps **every** named export of a `'use client'`
 * module as a client reference, so a server render reading one string from
 * `SectionTabs.tsx` resolves it through that machinery and drags a Radix-backed
 * module into a shell that wanted a grey rectangle. `table-skeleton.tsx` already
 * refuses to import `table-configs` for exactly this reason; these constants
 * were the hole in the same rule.
 *
 * Nothing here may import a component, and this file must never carry
 * `'use client'`. Strings and arrays only.
 */

/**
 * The tab strip's footprint, so a skeleton draws a placeholder of exactly the
 * right size rather than guessing a width. `RumblerSkeleton` and
 * `StandingsSkeleton` had 400px and 384px respectively, which is the kind of
 * drift a shared constant exists to stop.
 */
export const SECTION_TABS_STRIP_CLASS = 'h-9 w-full rounded-lg md:max-w-md';

/** One column's layout: how wide, and whether a phone shows it at all. */
export interface ColumnShape {
  width: string;
  hideBelow?: 'sm' | 'md' | 'lg';
}

/**
 * The indexes hidden below `md`, for a skeleton that works in positions.
 *
 * One derivation for every column list, so the board and its placeholder
 * cannot disagree about which columns a phone hides.
 */
function hiddenBelowMdIndexes(shapes: ColumnShape[]): number[] {
  return shapes.flatMap((column, index) =>
    column.hideBelow === 'md' ? [index] : [],
  );
}

/**
 * The standings board's five columns, in order: manager, team, move, F1,
 * points.
 *
 * Read by `standingsColumns` for the real table and by `StandingsSkeleton` for
 * the placeholder, which needs the widths as classes and the hidden columns as
 * indexes. Both derive from this one list rather than keeping their own copy —
 * two hand-kept copies is how a loading shape ends up a breakpoint away from
 * the board it stands in for, and nothing would fail: the skeleton would simply
 * hand over with a visible reflow.
 *
 * Percentages, because the table is `table-fixed`: the three columns that stay
 * visible must sum to 100 on a phone, and all five must at `md`.
 */
export const STANDINGS_COLUMN_SHAPES: ColumnShape[] = [
  { width: 'w-[46%] md:w-[30%]' },
  { width: 'md:w-[20%]', hideBelow: 'md' },
  { width: 'md:w-[14%]', hideBelow: 'md' },
  { width: 'w-[26%] md:w-[18%]' },
  { width: 'w-[28%] md:w-[18%]' },
];

/** The indexes a phone hides, for a skeleton that works in positions. */
export const STANDINGS_HIDDEN_BELOW_MD = hiddenBelowMdIndexes(
  STANDINGS_COLUMN_SHAPES,
);

/**
 * The league's rank palette, first through eighth.
 *
 * Lives here rather than in `table-configs.tsx`: that module sits beside a
 * `'use client'` table and pulls the button primitive with it, which is
 * exactly the drag this file exists to stop. A pure function of string
 * literals, so Tailwind still sees every class and the standings board keeps
 * no copy of its own.
 */
export function rankBadgeClasses(rank: number): string {
  if (rank === 1)
    return 'bg-yellow-400/20 text-yellow-400 border-yellow-400/30';
  if (rank === 2) return 'bg-gray-300/20 text-gray-300 border-gray-300/30';
  if (rank === 3) return 'bg-amber-600/20 text-amber-500 border-amber-600/30';
  if (rank === 8) return 'bg-red-600/20 text-red-400 border-red-600/30';
  return 'bg-white/10 text-white/70 border-white/20';
}

/**
 * The row grammar the standings cards share.
 *
 * The season tab's heatmap and form guide sit side by side and are supposed to
 * be level "by construction" — the claim only holds if their rows are literally
 * the same height, which means the same gutter, the same gap and the same cell
 * height. Three components were each spelling those classes out, and one of
 * them had already drifted, which is precisely how a levelled pair stops being
 * level a month later.
 *
 * `HeadToHeadGrid` deliberately does **not** use these: eight opponent columns
 * need a tighter gutter and their own fixed widths, and that card sits alone on
 * its own tab with nothing to line up against.
 */

/**
 * The name gutter down the left of every row, headings included.
 *
 * Narrow on a phone on purpose. These are first names — "Ian", "Nick" — and at
 * 80px the gutter was mostly empty while the cells beside it were squeezed to
 * the point of being hard to read. The desktop width is unchanged; there is
 * room there and a longer name benefits from it.
 */
export const CARD_ROW_GUTTER = 'w-16 md:w-24';

/** One row: the gutter, then the cells. Tighter on a phone, for the same reason. */
export const CARD_ROW = 'flex items-center gap-2 md:gap-3';

/** The strip of cells filling the rest of a row. */
export const CARD_ROW_CELLS = 'flex flex-1 gap-1.5';

/** One cell. The height is what actually levels two cards against each other. */
export const CARD_CELL = 'h-8 min-w-0 flex-1 md:h-9';

/** A column heading above the cells. */
export const CARD_COLUMN_HEADING =
  'min-w-0 flex-1 text-center text-[10px] whitespace-nowrap text-muted-foreground md:text-xs';

/** The manager's name in the gutter. */
export const CARD_ROW_NAME =
  'truncate text-xs font-medium text-muted-foreground md:text-sm';

import { cn } from '@/lib/utils';

/**
 * The one skeleton shape primitive.
 *
 * It is decorative by definition, so it is `aria-hidden` — a screen reader must
 * not read out a grid of empty bars. The single spoken "Loading" announcement
 * belongs to the `SkeletonRegion` wrapper around the whole region, not to each
 * bar.
 *
 * `motion-reduce:animate-none` honours `prefers-reduced-motion`: a full page of
 * pulsing blocks is precisely the motion that preference exists to suppress.
 *
 * It renders a `<span class="block">`, not a `<div>`, and that is load-bearing.
 * A skeleton stands in for *content*, so it lands wherever content lands —
 * including inside `<p>` and `<CardTitle>`. A `<div>` inside a `<p>` is invalid
 * HTML and React fails it as a hydration error. A block-display `<span>` is
 * valid in every one of those slots and lays out identically.
 */
function Skeleton({ className, ...props }: React.ComponentProps<'span'>) {
  return (
    <span
      data-slot='skeleton'
      aria-hidden='true'
      className={cn(
        'block animate-pulse rounded-md bg-white/10 motion-reduce:animate-none',
        className,
      )}
      {...props}
    />
  );
}

/**
 * Height scale for a text placeholder. Each step is the height of the real type
 * size the bar stands in for, so a skeleton line occupies the same space as the
 * text that replaces it.
 */
const TEXT_HEIGHTS = {
  /** `text-[10px]`/`text-xs` — column headers, captions, helper lines. */
  label: 'h-3',
  /** `text-sm` — table cells, list lines, player names. */
  body: 'h-4',
  /** `text-base`/`text-lg` — card titles, section headings. */
  title: 'h-5',
  /** `text-2xl`+ — the big number on a stat card. */
  value: 'h-8',
} as const;

/**
 * Width scale, in `ch` units so a bar tracks the font rather than a pixel guess.
 *
 * Deliberately a closed set: free-form widths drift out of step with the text
 * they stand in for, and a page of subtly mismatched bars is what makes a
 * skeleton read as broken rather than as loading.
 */
const TEXT_WIDTHS = {
  xs: 'w-[4ch]',
  sm: 'w-[8ch]',
  md: 'w-[14ch]',
  lg: 'w-[20ch]',
  full: 'w-full',
} as const;

export type SkeletonTextSize = keyof typeof TEXT_HEIGHTS;
export type SkeletonTextWidth = keyof typeof TEXT_WIDTHS;

/** A placeholder for a line of text, sized to the type it replaces. */
function SkeletonText({
  size = 'body',
  width = 'md',
  className,
}: {
  size?: SkeletonTextSize;
  width?: SkeletonTextWidth;
  className?: string;
}) {
  return (
    <Skeleton
      className={cn(
        TEXT_HEIGHTS[size],
        TEXT_WIDTHS[width],
        // A `ch` width is a guess about the type, not about the slot, so in a
        // narrow cell it can be wider than the cell itself. Real text wraps or
        // truncates; a bar does neither, so it pushes the table's scroll width
        // out and the container grows a horizontal scrollbar the real table
        // never has. This is the clamp that stops a placeholder outgrowing the
        // content it stands in for.
        'max-w-full',
        className,
      )}
    />
  );
}

/**
 * A stable pseudo-random width for cell (row, col).
 *
 * Uniform bars read as a grid of boxes rather than as text. This varies them
 * without `Math.random()`, which would differ between the server and client
 * render and trip hydration.
 */
function cellWidth(row: number, col: number): SkeletonTextWidth {
  const widths: SkeletonTextWidth[] = ['sm', 'md', 'lg', 'md'];
  return widths[(row * 3 + col * 5) % widths.length];
}

export { Skeleton, SkeletonText, cellWidth };

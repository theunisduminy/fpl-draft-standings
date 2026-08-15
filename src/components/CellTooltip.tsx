'use client';

import type { ReactElement, ReactNode } from 'react';

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

/**
 * The hover label used by the grids and strips on the standings tabs.
 *
 * These were `title` attributes, which the browser renders after about a second
 * in a system font at a size nobody chose, positioned wherever it likes, and
 * never at all on a touch screen. This is the shadcn tooltip instead: themed,
 * instant, and portalled so it is never clipped by the card it sits in.
 *
 * **The tooltip is an enhancement, never the answer.** Every cell that carries
 * one already prints its own value, and the tooltip adds the full names and the
 * wording around it. That is deliberate: the trigger is a `span` rather than a
 * button, so 64 grid cells do not become 64 tab stops, and a keyboard or screen
 * reader user therefore never sees this content. Nothing may live in here that
 * is not already on the page.
 */
export function CellTooltip({
  label,
  children,
}: {
  label: ReactNode;
  children: ReactElement;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent className='max-w-56 text-center'>{label}</TooltipContent>
    </Tooltip>
  );
}

/**
 * One provider per card, wrapping all of its cells.
 *
 * `delayDuration` is short because these are dense grids where the reader is
 * sweeping across cells rather than deciding to hover one, and `skipDelay`
 * keeps the next cell instant once the first has opened.
 */
export function CellTooltipProvider({ children }: { children: ReactNode }) {
  return (
    <TooltipProvider delayDuration={120} skipDelayDuration={400}>
      {children}
    </TooltipProvider>
  );
}

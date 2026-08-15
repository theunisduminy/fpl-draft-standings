'use client';

import type { LucideIcon } from 'lucide-react';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

/**
 * The strip's own footprint, exported so the loading skeletons draw a
 * placeholder of exactly the right size rather than each guessing a width.
 * `RumblerSkeleton` and `StandingsSkeleton` had 400px and 384px respectively,
 * which is the kind of drift a shared constant exists to stop.
 */
export const SECTION_TABS_STRIP_CLASS = 'h-9 w-full rounded-lg md:max-w-md';

/** One tab: what it is called, what marks it, and what it shows. */
export interface SectionTab {
  value: string;
  label: string;
  icon: LucideIcon;
  content: React.ReactNode;
  /** Extra classes for this panel, e.g. `space-y-4` for a stacked one. */
  className?: string;
}

/**
 * The tab strip, in one place.
 *
 * The standings and rumblers pages each had their own copy — same Radix
 * primitive, same grid, same trigger classes, written out twice with the brand
 * purple hard-coded into both. Two copies of a control is how two pages end up
 * with tabs that are almost but not quite the same, so this is the one the app
 * uses. It is a composition of the shadcn `Tabs` primitive, not a replacement
 * for it: a page needing something genuinely different still reaches for
 * `@/components/ui/tabs` directly.
 *
 * The strip is full width on a phone, where the two halves are the tap
 * targets, and capped on a desktop, where a strip stretched across the whole
 * container reads as a toolbar rather than as a choice between two things.
 *
 * `'use client'` because Radix owns the tab state. Panels are passed as
 * rendered nodes, so anything inside them keeps whatever boundary it already
 * had.
 */
/**
 * Column counts as literal classes, because Tailwind reads the source and a
 * `grid-cols-${n}` template produces a class it has never generated. An inline
 * style would work and is what the house rules forbid, so this is the lookup
 * instead — and it doubles as the statement that a strip of more than four is
 * navigation, not tabs.
 */
const COLUMNS: Record<number, string> = {
  2: 'grid-cols-2',
  3: 'grid-cols-3',
  4: 'grid-cols-4',
};

export function SectionTabs({
  tabs,
  defaultValue,
}: {
  tabs: SectionTab[];
  defaultValue: string;
}) {
  return (
    <Tabs defaultValue={defaultValue} className='w-full'>
      <TabsList
        // `items-stretch` because the primitive's `items-center` sizes each
        // trigger to its own content and centres it, so the active pill sat in
        // the middle of the row with uneven space above and below while the
        // left and right insets were the strip's 4px padding. Stretching makes
        // all four insets that same 4px.
        className={cn(
          'grid w-full items-stretch border border-border bg-card md:max-w-md',
          COLUMNS[tabs.length] ?? COLUMNS[2],
        )}
      >
        {tabs.map((tab) => (
          <TabsTrigger
            key={tab.value}
            value={tab.value}
            // The active tab wears the brand gradient the footer used to. It
            // was the only place on the site that colour appeared at any size,
            // and a footer is the wrong thing to make the brightest object on
            // the page; the tab someone is reading is the right one. Dark
            // purple type on it, because white on cyan-to-green is unreadable.
            // `py-0` because the primitive's own numbers do not close once a
            // border is added: the strip is `h-9` (36px, border-box), so our
            // 1px border and its `p-1` leave 26px, while the trigger's `py-1`
            // plus a 20px `text-sm` line wants 28. The row overflowed its
            // padding box, and a pill that cannot fit does not centre — it
            // rides into the border, which no radius or alignment fixes.
            // Vertical padding is the wrong lever here anyway: the strip is a
            // fixed height, so the trigger should fill it, not add to it.
            //
            // `rounded-sm` (8px) rather than the primitive's `rounded-md`
            // (10px), because a shape nested inside another has to lose the
            // padding from its radius or its corners bulge against the
            // parent's: the strip is `rounded-lg` (12px) with `p-1` (4px), so
            // 12 − 4 = 8 is the only radius that traces it exactly.
            className='h-full w-full gap-2 rounded-sm py-0 text-muted-foreground data-[state=active]:bg-gradient-to-t data-[state=active]:from-[#00edfd] data-[state=active]:from-10% data-[state=active]:to-[#75fa95] data-[state=active]:font-semibold data-[state=active]:text-[#310639]'
          >
            <tab.icon className='h-4 w-4' />
            {tab.label}
          </TabsTrigger>
        ))}
      </TabsList>

      {tabs.map((tab) => (
        <TabsContent
          key={tab.value}
          value={tab.value}
          className={cn('mt-4', tab.className)}
        >
          {tab.content}
        </TabsContent>
      ))}
    </Tabs>
  );
}

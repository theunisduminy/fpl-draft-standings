import { TableSkeleton } from '@/components/TableView/table-skeleton';
import { SECTION_TABS_STRIP_CLASS } from '@/components/shapes';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * Loading shape for `/premier-league`.
 *
 * Mirrors the default tab only — the table — because that is the one rendered
 * before the reader touches anything. Shared by the page's Suspense fallback
 * and its `loading.tsx`, so a soft navigation and a stream look identical.
 *
 * Twenty rows is not a guess: the Premier League has twenty clubs, so the real
 * table lands at exactly this height and the handover does not shift. It goes
 * through `TableSkeleton` for the same reason the table itself goes through
 * `BaseTable` — one row height and one set of column widths, defined once.
 */

/** The real table's widths, in order. Kept beside it in `LeagueTable`. */
const COLUMN_WIDTHS = [
  'w-[12%] md:w-[7%]',
  'w-[40%] md:w-[26%]',
  'w-[12%] md:w-[6%]',
  'md:w-[6%]',
  'md:w-[6%]',
  'md:w-[6%]',
  'md:w-[6%]',
  'md:w-[6%]',
  'w-[16%] md:w-[7%]',
  'w-[20%] md:w-[8%]',
  'lg:w-[16%]',
];

/**
 * W, D and L hide below `sm`, GF and GA below `md`, and the form guide below
 * `lg`, matching the `hideBelow` values in `LeagueTable`.
 */
const HIDDEN_BELOW_SM = [3, 4, 5];
const HIDDEN_BELOW_MD = [6, 7];
const HIDDEN_BELOW_LG = [10];

export function PremierLeagueSkeleton() {
  return (
    <div className='space-y-4'>
      <Skeleton className={SECTION_TABS_STRIP_CLASS} />

      <TableSkeleton
        columns={COLUMN_WIDTHS.length}
        rows={20}
        // The real first column is a plain position number, not the rank badge
        // the standings board leads with.
        leadingBadge={false}
        hideBelowSm={HIDDEN_BELOW_SM}
        hideBelowMd={HIDDEN_BELOW_MD}
        hideBelowLg={HIDDEN_BELOW_LG}
        widths={COLUMN_WIDTHS}
      />
    </div>
  );
}

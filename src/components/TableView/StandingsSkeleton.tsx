import { TableSkeleton } from '@/components/TableView/table-skeleton';
import {
  SECTION_TABS_STRIP_CLASS,
  STANDINGS_COLUMN_SHAPES,
  STANDINGS_HIDDEN_BELOW_MD,
} from '@/components/shapes';
import { LEDGER_GRID_CLASS } from '@/components/TableView/LeagueLedger';
import { Skeleton, SkeletonText } from '@/components/ui/skeleton';

/**
 * Loading shape for `/`.
 *
 * Mirrors the page: the two-tab strip, then the board and the ledger strip
 * beneath it. Shared by the page's Suspense fallback and `loading.tsx`, so
 * soft-nav and stream look identical.
 *
 * **Only the default tab is drawn**, because only the default tab is ever
 * rendered before the reader touches anything. That is the one real gain from
 * dropping the desktop's stacked layout: there is a single shape to keep in
 * step with the page instead of two, and no charts to guess the height of.
 *
 * The eight rows are not a guess — the league is eight managers, so the board
 * lands at exactly this height.
 */
export function StandingsSkeleton() {
  return (
    <div className='space-y-4'>
      <Skeleton className={SECTION_TABS_STRIP_CLASS} />

      {/* The board's own widths and hidden columns, from the module both this
          server-rendered shell and the client table config read. */}
      <TableSkeleton
        columns={STANDINGS_COLUMN_SHAPES.length}
        rows={8}
        hideBelowMd={STANDINGS_HIDDEN_BELOW_MD}
        widths={STANDINGS_COLUMN_SHAPES.map((column) => column.width)}
      />

      <LedgerSkeleton />
    </div>
  );
}

/**
 * Six cells in one bordered block, at the height the real strip lands at.
 *
 * The wrapper class is imported from `LeagueLedger` rather than restated, so
 * the loading block cannot drift a breakpoint away from the real one.
 */
function LedgerSkeleton() {
  return (
    <div className={LEDGER_GRID_CLASS}>
      {Array.from({ length: 6 }).map((_, cell) => (
        <div key={cell} className='space-y-1.5 bg-card p-3 md:p-3.5'>
          <div className='flex items-center gap-1.5'>
            <Skeleton className='h-3.5 w-3.5 shrink-0 rounded' />
            <SkeletonText size='label' width='md' />
          </div>
          <SkeletonText size='body' width='md' />
          <SkeletonText size='label' width='sm' />
        </div>
      ))}
    </div>
  );
}

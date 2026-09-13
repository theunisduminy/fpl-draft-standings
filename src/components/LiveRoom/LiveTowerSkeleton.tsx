import { cn } from '@/lib/utils';
import {
  LIVE_TOWER_COLUMN_SHAPES,
  LIVE_TOWER_HIDDEN_BELOW_MD,
} from '@/components/shapes';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton, SkeletonText, cellWidth } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

/**
 * Loading shape for `/live`.
 *
 * Mirrors `LiveTower`: the badge plus refresh row, then the six column board,
 * then the two freshness lines. Shared by the page's Suspense fallback and
 * `loading.tsx`, so soft-nav and stream look identical.
 *
 * Column widths and the hidden pair come from `shapes.ts`, the same constants
 * the real board reads, so the handover lands with no layout shift. The eight
 * rows are exact: the league is eight managers.
 */
export function LiveTowerSkeleton() {
  return (
    <div className='space-y-4'>
      <div className='flex flex-wrap items-center justify-between gap-3'>
        <Skeleton className='h-7 w-36 rounded-full' />
        <Skeleton className='h-9 w-28 rounded-md' />
      </div>

      <Card className='overflow-hidden border-border bg-card'>
        <CardContent className='p-0'>
          <Table className='w-full table-fixed'>
            <TableHeader>
              <TableRow className='border-border hover:bg-transparent'>
                {LIVE_TOWER_COLUMN_SHAPES.map((column, col) => (
                  <TableHead
                    key={col}
                    className={cn(
                      SKELETON_HEAD_CLASS,
                      column.width,
                      hiddenBelowMd(col),
                    )}
                  >
                    <SkeletonText
                      size='label'
                      width='sm'
                      className={col === 0 ? undefined : 'mx-auto'}
                    />
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array.from({ length: 8 }).map((_, row) => (
                <TableRow key={row} className={SKELETON_ROW_CLASS}>
                  {LIVE_TOWER_COLUMN_SHAPES.map((_, col) => (
                    <TableCell
                      key={col}
                      className={
                        col === 0
                          ? SKELETON_CELL_CLASS
                          : cn(
                              SKELETON_CELL_CLASS,
                              'text-center',
                              hiddenBelowMd(col),
                            )
                      }
                    >
                      {col === 0 ? (
                        <div className='flex min-w-0 items-center gap-3'>
                          <Skeleton className='h-8 w-8 shrink-0 rounded-full' />
                          <div className='min-w-0 space-y-1.5'>
                            <SkeletonText size='body' width='md' />
                            <SkeletonText size='label' width='sm' />
                          </div>
                        </div>
                      ) : (
                        <SkeletonText
                          size='body'
                          width={cellWidth(row, col)}
                          className='mx-auto'
                        />
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className='space-y-1'>
        <SkeletonText size='label' width='lg' />
        <SkeletonText size='label' width='md' />
      </div>
    </div>
  );
}

/**
 * The `hidden md:table-cell` literal for a column the real board hides, or
 * nothing. Positions, not breakpoints: the skeleton hides exactly the columns
 * the board hides, so a phone hands over with no shift.
 */
function hiddenBelowMd(col: number): string {
  return LIVE_TOWER_HIDDEN_BELOW_MD.includes(col) ? 'hidden md:table-cell' : '';
}

/**
 * The tower's own rhythm, restated to match `LiveTower` by construction.
 * Header, cell, and row classes are spelled out in both files rather than
 * shared through a client module; see the note above `TOWER_HEAD_CLASS`.
 */
const SKELETON_HEAD_CLASS =
  'px-3 py-3 text-xs font-semibold uppercase tracking-wider whitespace-nowrap text-muted-foreground md:px-4';

const SKELETON_CELL_CLASS = 'px-3 py-3 text-sm text-foreground md:px-4';

const SKELETON_ROW_CLASS = 'h-14 border-0';

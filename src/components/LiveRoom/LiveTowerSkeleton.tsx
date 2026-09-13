import { cn } from '@/lib/utils';
import {
  LIVE_TOWER_COLUMN_SHAPES,
  liveTowerHiddenClass,
  TOWER_CELL_CLASS,
  TOWER_HEAD_CLASS,
  TOWER_ROW_CLASS,
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
                      TOWER_HEAD_CLASS,
                      column.width,
                      liveTowerHiddenClass(col),
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
                <TableRow key={row} className={TOWER_ROW_CLASS}>
                  {LIVE_TOWER_COLUMN_SHAPES.map((_, col) => (
                    <TableCell
                      key={col}
                      className={
                        col === 0
                          ? TOWER_CELL_CLASS
                          : cn(
                              TOWER_CELL_CLASS,
                              'text-center',
                              liveTowerHiddenClass(col),
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
                      ) : col === 1 ? (
                        // Mirrors the points cell's two-line stack (value plus
                        // provisional pill) so the handover does not grow a row.
                        <span className='inline-flex flex-col items-center gap-1'>
                          <SkeletonText
                            size='body'
                            width={cellWidth(row, col)}
                            className='mx-auto'
                          />
                          <Skeleton className='h-4 w-16 rounded-full' />
                        </span>
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

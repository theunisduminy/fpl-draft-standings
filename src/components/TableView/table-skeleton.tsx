import {
  TABLE_CELL_CLASS,
  TABLE_HEAD_CLASS,
  TABLE_ROW_CLASS,
} from './base-table';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Skeleton, SkeletonText, cellWidth } from '@/components/ui/skeleton';

/**
 * The loading shape for {@link BaseTable}.
 *
 * It lives in its own leaf module rather than beside `base-table.tsx`, because
 * that is a `'use client'` entry — a route's `loading.tsx` would ship the whole
 * interactive table just to draw six grey rows.
 *
 * It renders the real `<Table>` inside the real `Card`, and imports its cell
 * and header classes from `BaseTable` rather than restating them, so row
 * height, header height and cell rhythm cannot drift. Nothing here is a
 * measured guess, which is why the data landing causes no layout shift.
 */
export function TableSkeleton({
  columns = 3,
  rows = 8,
  /** The first column of both real tables leads with a rank badge. */
  leadingBadge = true,
  hideBelowMd = [],
}: {
  columns?: number;
  rows?: number;
  leadingBadge?: boolean;
  /**
   * Column indexes the real table hides below `md`, so the placeholder hides
   * the same ones. Without it a four-column skeleton hands over to a
   * three-column table on a phone, which is a layout shift by construction.
   */
  hideBelowMd?: number[];
}) {
  const hidden = (col: number) =>
    hideBelowMd.includes(col) ? 'hidden md:table-cell' : '';

  return (
    <div className='w-full space-y-4'>
      <Card className='overflow-hidden border-white/10 bg-[#2a0d33]'>
        <CardContent className='p-0'>
          <Table className='w-full table-fixed'>
            <TableHeader>
              <TableRow className='border-white/10 hover:bg-transparent'>
                {Array.from({ length: columns }).map((_, col) => (
                  <TableHead
                    key={col}
                    className={cn(TABLE_HEAD_CLASS, hidden(col))}
                    style={{ width: col === 0 ? '50%' : undefined }}
                  >
                    <SkeletonText size='label' width='sm' />
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array.from({ length: rows }).map((_, row) => (
                <TableRow key={row} className={TABLE_ROW_CLASS}>
                  {Array.from({ length: columns }).map((_, col) => (
                    <TableCell
                      key={col}
                      className={cn(TABLE_CELL_CLASS, hidden(col))}
                    >
                      {col === 0 && leadingBadge ? (
                        // `min-w-0` for the same reason the real cell has it:
                        // without it the text block is sized by its widest
                        // child and the row refuses to shrink, which in a
                        // scrollable container means a scrollbar.
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
                          className={col === 0 ? undefined : 'mx-auto'}
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
    </div>
  );
}

/**
 * A card whose title is real and whose body is a placeholder.
 *
 * "The page is all data" is almost never true — a card's heading is a static
 * string, known before any read, so it renders for real and only the body
 * waits. That also means the skeleton does not have to guess the heading's
 * dimensions.
 */
export function SkeletonCardBody({
  title,
  bodyClassName,
}: {
  title: string;
  bodyClassName: string;
}) {
  return (
    <Card className='border-white/10 bg-[#2a0d33]'>
      <div className='flex flex-col space-y-1.5 p-6 pb-3'>
        <h3 className='text-base font-semibold tracking-tight text-white md:text-lg'>
          {title}
        </h3>
      </div>
      <CardContent className='pt-0'>
        <Skeleton className={bodyClassName} />
      </CardContent>
    </Card>
  );
}

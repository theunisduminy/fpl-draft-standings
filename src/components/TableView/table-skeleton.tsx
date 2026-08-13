import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton, SkeletonText, cellWidth } from '@/components/ui/skeleton';

/**
 * The loading shape for {@link BaseTable}.
 *
 * It lives in its own leaf module rather than beside `base-table.tsx`, because
 * that is a `'use client'` entry — a route's `loading.tsx` would ship the whole
 * interactive table just to draw six grey rows.
 *
 * It renders the real `<Table>` inside the real `Card`, with the same padding
 * and border classes the loaded table uses, so row height, header height and
 * cell rhythm all come from the same CSS. Nothing here is a measured guess,
 * which is why the data landing causes no layout shift. The chrome classes
 * below are the one thing that must stay in step with `BaseTable`.
 */
export function TableSkeleton({
  columns = 3,
  rows = 8,
  /** The first column of both real tables leads with a rank badge. */
  leadingBadge = true,
}: {
  columns?: number;
  rows?: number;
  leadingBadge?: boolean;
}) {
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
                    className='px-3 py-4 md:px-4'
                    style={{ width: col === 0 ? '50%' : undefined }}
                  >
                    <SkeletonText size='label' width='sm' />
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array.from({ length: rows }).map((_, row) => (
                <TableRow key={row} className='border-white/5'>
                  {Array.from({ length: columns }).map((_, col) => (
                    <TableCell key={col} className='px-3 py-4 md:px-4 md:py-5'>
                      {col === 0 && leadingBadge ? (
                        <div className='flex items-center gap-3'>
                          <Skeleton className='h-6 w-6 shrink-0 rounded-full' />
                          <div className='space-y-1.5'>
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

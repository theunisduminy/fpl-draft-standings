import { GameweekSelectorSkeleton } from '@/components/GameweekSelectorSkeleton';
import { TableSkeleton } from '@/components/TableView/table-skeleton';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton, SkeletonText } from '@/components/ui/skeleton';

/**
 * Loading shape for `/results`.
 *
 * Mirrors `DraftResultsTable`: the gameweek pills, the results table, then the
 * four-stat summary card.
 */
export function ResultsSkeleton() {
  return (
    <div className='w-full space-y-6'>
      <GameweekSelectorSkeleton />

      <TableSkeleton columns={5} rows={8} />

      <Card className='border-white/10 bg-[#2a0d33]'>
        <div className='flex flex-col space-y-1.5 p-6 pb-3'>
          <SkeletonText size='title' width='md' />
        </div>
        <CardContent>
          <div className='grid grid-cols-1 gap-3 md:grid-cols-4'>
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className='rounded-lg bg-[#1a0520] p-3'>
                <div className='mb-1 flex items-center gap-2'>
                  <Skeleton className='h-4 w-4 shrink-0 rounded' />
                  <SkeletonText size='label' width='sm' />
                </div>
                <div className='flex items-center justify-between gap-2'>
                  <SkeletonText size='body' width='sm' />
                  {/* The first two cards name whoever the stat belongs to. */}
                  {i < 2 && <Skeleton className='h-5 w-20 rounded-md' />}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

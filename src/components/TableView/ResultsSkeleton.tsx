import { TableSkeleton } from '@/components/TableView/table-skeleton';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton, SkeletonText } from '@/components/ui/skeleton';

/**
 * Loading shape for `/results`.
 *
 * Mirrors `DraftResultsTable`: the gameweek selector, the results table, then
 * the four-stat summary card. The selector's label is a static string, so it
 * renders for real.
 */
export function ResultsSkeleton() {
  return (
    <div className='w-full space-y-6'>
      <div className='w-full space-y-2'>
        <p className='text-sm font-medium text-white/80'>Select Gameweek</p>
        <div className='flex gap-1.5 pb-2'>
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className='h-9 w-[70px] shrink-0 rounded-lg' />
          ))}
        </div>
      </div>

      <TableSkeleton columns={4} rows={8} />

      <Card className='border-white/10 bg-[#2a0d33]'>
        <div className='flex flex-col space-y-1.5 p-6 pb-3'>
          <SkeletonText size='title' width='md' />
        </div>
        <CardContent>
          <div className='grid grid-cols-2 gap-3 md:grid-cols-4'>
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className='rounded-lg bg-[#1a0520] p-3'>
                <div className='mb-1 flex items-center gap-2'>
                  <Skeleton className='h-4 w-4 shrink-0 rounded' />
                  <SkeletonText size='label' width='sm' />
                </div>
                <SkeletonText size='body' width='sm' />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

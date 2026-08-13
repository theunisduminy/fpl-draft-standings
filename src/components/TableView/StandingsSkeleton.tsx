import {
  SkeletonCardBody,
  TableSkeleton,
} from '@/components/TableView/table-skeleton';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * Loading shape for `/`.
 *
 * Mirrors `StandingsTabs`: the tab strip and standings table on mobile, the
 * table stacked above the four position charts on desktop. Shared by the
 * page's Suspense fallback and `loading.tsx`, so soft-nav and stream look
 * identical.
 *
 * The eight rows are not a guess — the league is eight managers, so the table
 * lands at exactly this height.
 */
export function StandingsSkeleton() {
  return (
    <>
      <div className='md:hidden'>
        <Skeleton className='h-9 w-full rounded-lg' />
        <div className='mt-4'>
          <TableSkeleton columns={3} rows={8} />
        </div>
      </div>

      <div className='hidden space-y-8 md:block'>
        <TableSkeleton columns={3} rows={8} />
        <PositionChartsSkeleton />
      </div>
    </>
  );
}

/** The four charts under the standings table, in their real two-column grid. */
export function PositionChartsSkeleton() {
  return (
    <div className='w-full space-y-4'>
      <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
        <SkeletonCardBody
          title='Position distribution'
          bodyClassName='h-64 w-full rounded-md'
        />
        <SkeletonCardBody
          title='Form guide'
          bodyClassName='h-64 w-full rounded-md'
        />
      </div>
      <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
        <SkeletonCardBody
          title='Position trajectory'
          bodyClassName='h-64 w-full rounded-md'
        />
        <SkeletonCardBody
          title='Podium race'
          bodyClassName='h-64 w-full rounded-md'
        />
      </div>
    </div>
  );
}

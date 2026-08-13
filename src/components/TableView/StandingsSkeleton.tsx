import {
  SkeletonCardBody,
  TableSkeleton,
} from '@/components/TableView/table-skeleton';
import { Card } from '@/components/ui/card';
import { Skeleton, SkeletonText } from '@/components/ui/skeleton';

/**
 * Loading shape for `/`.
 *
 * Mirrors the page: the season-lead card, then the tab strip and standings
 * table on mobile, or the table stacked above the four position charts on
 * desktop. Shared by the page's Suspense fallback and `loading.tsx`, so
 * soft-nav and stream look identical.
 *
 * The eight rows are not a guess — the league is eight managers, so the table
 * lands at exactly this height.
 */
export function StandingsSkeleton() {
  return (
    <div className='space-y-6'>
      <SeasonLeadSkeleton />

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
    </div>
  );
}

/** The two halves of `SeasonLead`, at the height the real card lands at. */
function SeasonLeadSkeleton() {
  return (
    <Card className='overflow-hidden border-white/10 bg-[#2a0d33]'>
      <div className='grid gap-px bg-white/5 sm:grid-cols-2'>
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className='space-y-2 bg-[#2a0d33] p-4'>
            <div className='flex items-center gap-2'>
              <Skeleton className='h-4 w-4 shrink-0 rounded' />
              <SkeletonText size='label' width='md' />
            </div>
            <SkeletonText size='title' width='lg' />
            <div className='flex items-baseline justify-between gap-2'>
              <SkeletonText size='body' width='sm' />
              <SkeletonText size='label' width='md' />
            </div>
          </div>
        ))}
      </div>
    </Card>
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

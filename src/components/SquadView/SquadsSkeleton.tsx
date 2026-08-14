import { Card, CardContent } from '@/components/ui/card';
import { Skeleton, SkeletonText } from '@/components/ui/skeleton';

/**
 * Loading shape for `/squads`.
 *
 * Mirrors what the page settles into: two manager selects, each over a squad,
 * because the compare column opens on the league leader rather than empty.
 * Fifteen player rows, with the same photo, position badge, name, club and
 * points columns, so the cards land at the height they are drawn at here.
 */
export function SquadsSkeleton() {
  return (
    <div className='grid grid-cols-1 gap-4 lg:grid-cols-2'>
      {Array.from({ length: 2 }).map((_, column) => (
        <div key={column} className='space-y-3'>
          <Skeleton className='h-11 w-full rounded-md' />
          <SquadCardSkeleton />
        </div>
      ))}
    </div>
  );
}

function SquadCardSkeleton() {
  return (
    <Card className='border-white/10 bg-[#2a0d33]'>
      <div className='flex flex-col space-y-1.5 p-4 pb-3 md:p-6 md:pb-3'>
        <div className='flex items-start justify-between gap-3'>
          <div className='space-y-1.5'>
            <SkeletonText size='title' width='lg' />
            <SkeletonText size='body' width='md' />
          </div>
        </div>
      </div>

      <CardContent className='pt-0'>
        <ul className='divide-y divide-white/5'>
          {Array.from({ length: 15 }).map((_, row) => (
            <li key={row} className='flex items-center gap-3 py-2'>
              <Skeleton className='h-8 w-8 shrink-0 rounded-full' />
              <Skeleton className='h-5 w-11 shrink-0 rounded-md' />
              <SkeletonText size='body' width='md' className='flex-1' />
              <Skeleton className='h-4 w-14 shrink-0 rounded-md' />
              <SkeletonText size='body' width='xs' className='shrink-0' />
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

import { Card, CardContent } from '@/components/ui/card';
import { Skeleton, SkeletonText } from '@/components/ui/skeleton';

/**
 * Loading shape for `/squads`.
 *
 * Mirrors `SquadCard` in its real two-column grid: eight cards, fifteen player
 * rows each, with the same position badge, name/club stack and round label. The
 * counts are exact — eight managers, fifteen players — so the grid lands at the
 * height it is drawn at here.
 */
export function SquadsSkeleton() {
  return (
    <div className='grid grid-cols-1 gap-4 lg:grid-cols-2'>
      {Array.from({ length: 8 }).map((_, card) => (
        <Card key={card} className='border-white/10 bg-[#2a0d33]'>
          <div className='flex flex-col space-y-1.5 p-6 pb-3'>
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
                  <Skeleton className='h-5 w-11 shrink-0 rounded-md' />
                  <div className='min-w-0 flex-1 space-y-1.5'>
                    <SkeletonText size='body' width='md' />
                    <SkeletonText size='label' width='xs' />
                  </div>
                  <SkeletonText size='label' width='xs' className='shrink-0' />
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

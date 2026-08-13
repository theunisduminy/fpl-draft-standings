import { Skeleton } from '@/components/ui/skeleton';

/**
 * The gameweek selector's loading shape.
 *
 * Its own leaf module rather than living beside the selector, which is a
 * `'use client'` entry — a route's `loading.tsx` would otherwise ship the whole
 * interactive picker to draw six grey pills. Same reasoning as
 * `table-skeleton.tsx`.
 *
 * Both skeletons that show a picker were drawing these six pills from their own
 * copy of the geometry.
 */
export function GameweekSelectorSkeleton() {
  return (
    <div className='flex w-full gap-1.5 pb-2'>
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton key={i} className='h-9 w-[70px] shrink-0 rounded-lg' />
      ))}
    </div>
  );
}

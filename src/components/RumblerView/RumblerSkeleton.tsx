import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Skeleton, SkeletonText } from '@/components/ui/skeleton';

/**
 * Loading shape for `/rumblers`.
 *
 * Mirrors `RumblerTabs`: the two-tab strip, then the victim card — gameweek
 * heading, points badge, the rumbler rows, and the blurb footer. Tab labels are
 * static, so they render for real.
 */
export function RumblerSkeleton() {
  return (
    <div className='w-full'>
      <Skeleton className='h-9 w-full rounded-lg md:w-[400px]' />

      <div className='mt-6 w-full space-y-4'>
        <div className='w-full space-y-2'>
          <p className='text-sm font-medium text-white/80'>Select Gameweek</p>
          <div className='flex gap-1.5 pb-2'>
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className='h-9 w-[70px] shrink-0 rounded-lg' />
            ))}
          </div>
        </div>

        <Card className='w-full overflow-hidden border-white/10 bg-[#2a0d33]'>
          <div className='flex flex-col space-y-1.5 p-6 pb-3'>
            <div className='flex items-center justify-between'>
              <SkeletonText size='title' width='md' />
              <Skeleton className='h-5 w-16 rounded-full' />
            </div>
            <SkeletonText size='label' width='lg' />
          </div>

          <CardContent className='p-4 pt-0'>
            <div className='space-y-3'>
              {Array.from({ length: 1 }).map((_, i) => (
                <div
                  key={i}
                  className='flex items-center justify-between rounded-lg bg-[#1a0520] p-3'
                >
                  <div className='flex items-center gap-3'>
                    <Skeleton className='h-10 w-10 shrink-0 rounded-full' />
                    <div className='space-y-1.5'>
                      <SkeletonText size='body' width='md' />
                      <SkeletonText size='label' width='lg' />
                    </div>
                  </div>
                  <Skeleton className='h-5 w-20 rounded-full' />
                </div>
              ))}
            </div>
          </CardContent>

          <Separator className='bg-white/10' />

          <div className='p-4'>
            <div className='flex items-start gap-2'>
              <Skeleton className='mt-0.5 h-4 w-4 shrink-0 rounded' />
              <SkeletonText size='body' width='full' />
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

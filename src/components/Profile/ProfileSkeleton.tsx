import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton, SkeletonText } from '@/components/ui/skeleton';

/**
 * Loading shape for `/profile`, below the heading.
 *
 * Mirrors the page: four identity cards across the top, then the details form
 * beside the season summary. Nothing here is a measured guess — the grids and
 * the card padding are copied from the page, and the seven stat rows are the
 * seven the summary actually renders.
 *
 * The heading is not drawn, for the same reason it is not drawn in any other
 * route shell: `PageShell` paints it above the boundary. See `PageShell`.
 */
export function ProfileSkeleton() {
  return (
    // `space-y-6` mirrors `ProfileBody`: behind a boundary these grids are one
    // child of `PageShell`, so neither inherits its rhythm.
    <div className='space-y-6'>
      <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-4'>
        {Array.from({ length: 4 }).map((_, card) => (
          <Card key={card} className='border-white/10 bg-[#2a0d33]'>
            <CardContent className='space-y-2 pt-4 md:pt-6'>
              <SkeletonText size='label' width='sm' />
              <SkeletonText size='title' width='md' />
            </CardContent>
          </Card>
        ))}
      </div>

      <div className='grid gap-4 lg:grid-cols-3'>
        <Card className='border-white/10 bg-[#2a0d33] lg:col-span-2'>
          <CardHeader className='flex-row items-center justify-between space-y-0'>
            <SkeletonText size='title' width='sm' />
            <Skeleton className='h-9 w-24 rounded-md' />
          </CardHeader>
          <CardContent className='space-y-4'>
            {/* Display name and club: a label above a control each. */}
            <Field control='h-10' />
            <Field control='h-10' />
            <Skeleton className='h-10 w-32 rounded-md' />
          </CardContent>
        </Card>

        <Card className='border-white/10 bg-[#2a0d33]'>
          <CardHeader>
            <SkeletonText size='title' width='sm' />
          </CardHeader>
          <CardContent className='space-y-4'>
            {Array.from({ length: 7 }).map((_, row) => (
              <div key={row} className='flex items-baseline justify-between'>
                <SkeletonText size='body' width='md' />
                <SkeletonText size='title' width='xs' />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

/** A label above an input, at the input's real height. */
function Field({ control }: { control: string }) {
  return (
    <div className='space-y-1.5'>
      <SkeletonText size='label' width='sm' />
      <Skeleton className={`${control} w-full rounded-md`} />
    </div>
  );
}

import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';

export function SkeletonCard() {
  return (
    <Card className='w-full border-white/10 bg-[#2a0d33]'>
      <CardContent className='p-4 md:p-6'>
        <div className='space-y-4'>
          <Skeleton className='h-8 w-3/4 bg-white/10' />
          <Skeleton className='h-4 w-1/2 bg-white/10' />
          <div className='space-y-3 pt-4'>
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className='h-12 w-full bg-white/10' />
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function SkeletonStats() {
  return (
    <div className='grid grid-cols-2 gap-3 md:grid-cols-4'>
      {Array.from({ length: 4 }).map((_, i) => (
        <Card key={i} className='border-white/10 bg-[#2a0d33]'>
          <CardContent className='p-4'>
            <Skeleton className='mb-2 h-4 w-16 bg-white/10' />
            <Skeleton className='h-8 w-12 bg-white/10' />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

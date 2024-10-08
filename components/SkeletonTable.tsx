import { Skeleton } from '@/components/ui/skeleton';

export function SkeletonCard() {
  return (
    <div className='flex w-[350px] flex-col space-y-3 md:h-[700px] md:w-[600px]'>
      <Skeleton className='h-[250px] w-[340px] rounded-xl md:w-[600px]' />
      <div className='space-y-2'>
        <Skeleton className='h-4 w-[300px] md:w-[600px]' />
        <Skeleton className='h-4 w-[280px] md:w-[500px]' />
      </div>
    </div>
  );
}

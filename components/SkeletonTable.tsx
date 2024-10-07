import { Skeleton } from '@/components/ui/skeleton';

export function SkeletonCard() {
  return (
    <div className='flex w-[290px] flex-col space-y-3 md:w-[500px]'>
      <Skeleton className='h-[125px] w-[290px] rounded-xl md:w-[500px]' />
      <div className='space-y-2'>
        <Skeleton className='h-4 w-[290px] md:w-[500px]' />
        <Skeleton className='h-4 w-[220px] md:w-[400px]' />
      </div>
    </div>
  );
}

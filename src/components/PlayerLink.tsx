import Link from 'next/link';
import { LineChart } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PlayerLinkProps {
  playerId: number;
  className?: string;
}

export function PlayerLink({ playerId, className }: PlayerLinkProps) {
  return (
    <Link
      href={`/players/${playerId}`}
      aria-label='View detailed statistics'
      className={cn(
        'relative inline-flex h-8 w-8 items-center justify-center rounded-md text-white/50 before:absolute before:-inset-2 before:content-[""] hover:bg-white/10 hover:text-[#00edfd]',
        className,
      )}
    >
      <LineChart className='h-4 w-4' aria-hidden='true' />
    </Link>
  );
}

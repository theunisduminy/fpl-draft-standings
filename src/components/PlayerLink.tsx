import Link from 'next/link';
import { LineChart } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface PlayerLinkProps {
  playerId: number;
  className?: string;
}

export function PlayerLink({ playerId, className }: PlayerLinkProps) {
  return (
    <Link href={`/players/${playerId}`} className={className}>
      <Button
        variant='ghost'
        size='icon'
        className='h-8 w-8 text-white/50 hover:bg-white/10 hover:text-[#00edfd]'
        title='View detailed statistics'
      >
        <LineChart className='h-4 w-4' />
      </Button>
    </Link>
  );
}

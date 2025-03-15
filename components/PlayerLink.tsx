import Link from 'next/link';
import { LineChart } from 'lucide-react';

interface PlayerLinkProps {
  playerId: number;
  className?: string;
}

export function PlayerLink({ playerId, className }: PlayerLinkProps) {
  return (
    <Link
      href={`/players/${playerId}`}
      className={`text-blackOlive inline-flex items-center justify-center rounded bg-white p-1.5 transition-colors hover:bg-gray-100 ${className || ''}`}
      title='View detailed statistics'
    >
      <LineChart className='text-blackOlive h-4 w-4' />
    </Link>
  );
}

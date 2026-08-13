import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export default function NotFound() {
  return (
    <div className='w-full py-8'>
      <Card className='w-full border-white/10 bg-[#2a0d33]'>
        <CardContent className='flex flex-col items-center gap-4 p-8 text-center'>
          <h1 className='text-xl font-bold text-white'>Not found</h1>
          <p className='text-sm text-white/60'>
            That page is not part of this league.
          </p>
          <Link href='/'>
            <Button
              variant='outline'
              className='border-white/20 text-white hover:bg-white/10'
            >
              Back to standings
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}

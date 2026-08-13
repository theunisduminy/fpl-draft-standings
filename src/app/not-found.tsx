import Link from 'next/link';

import { AppChrome } from '@/components/Layout/AppChrome';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

/**
 * Wrapped in `AppChrome` by hand. This file has to live at the app root — Next
 * only uses a root `not-found.tsx` for unmatched URLs — which puts it outside
 * the `(app)` group and therefore outside the navigation. Anyone who reaches it
 * is signed in and needs a way back.
 */
export default function NotFound() {
  return (
    <AppChrome>
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
    </AppChrome>
  );
}

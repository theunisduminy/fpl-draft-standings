'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { RefreshCw } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * Manual refresh for the live room.
 *
 * Button-only leaf: it receives no data and fetches nothing. The click calls
 * `router.refresh()`, which re-renders the server tree; the streamed subtree
 * (owning this control, not `PageShell`) then reads afresh. Pending state
 * comes from `useTransition` and disables the button while refreshing, with a
 * polite live-region announcement for assistive tech.
 *
 * Upstream guard is structural, not a timer. Refresh renders through the 60
 * second `cachedRead('live-gameweek', ...)`, so rapid clicks inside the window
 * serve the cached slice and at most one recompute (bounded at about 12
 * upstream calls) follows each expiry, shared by concurrent readers. Do not
 * add an interval or polling here without treating it as a cost change: it
 * would turn a bounded manual read into continuous upstream load.
 */
export default function RefreshControl() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <div className='flex items-center gap-3'>
      <Button
        type='button'
        variant='outline'
        onClick={() => startTransition(() => router.refresh())}
        disabled={pending}
        aria-busy={pending}
      >
        <RefreshCw
          aria-hidden='true'
          className={cn('h-4 w-4', pending && 'animate-spin')}
        />
        {/* Static label: swapping in a longer pending label widens the
            button mid-flight. Pending is already signalled by the spinner,
            the disabled state, and the live region below. */}
        Refresh
      </Button>
      <span aria-live='polite' role='status' className='sr-only'>
        {pending ? 'Refreshing live figures.' : 'Refresh finished.'}
      </span>
    </div>
  );
}

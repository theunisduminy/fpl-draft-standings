'use client';

import { useEffect } from 'react';

import { ErrorDisplay } from '@/components/ErrorDisplay';

/**
 * The route-level error boundary.
 *
 * A Server Component page that throws lands here, which is why the pages
 * themselves carry no error handling: an upstream outage or a stale
 * `FPL_LEAGUE_ID` surfaces once, in one place, with a retry that re-renders
 * the segment on the server.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className='w-full py-8'>
      <ErrorDisplay
        message='We could not load the league data. This is usually the FPL API being unavailable.'
        onRetry={reset}
      />
    </div>
  );
}

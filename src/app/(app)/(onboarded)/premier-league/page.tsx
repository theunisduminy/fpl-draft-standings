import { Suspense } from 'react';
import type { Metadata } from 'next';
import { AlertTriangle } from 'lucide-react';

import { getPremierLeagueData } from '@/utils/premier-league-data';
import { PremierLeagueTabs } from '@/components/PremierLeagueView/PremierLeagueTabs';
import { PremierLeagueSkeleton } from '@/components/PremierLeagueView/PremierLeagueSkeleton';
import { SkeletonRegion } from '@/components/SkeletonRegion';
import { PageShell } from '@/components/Layout/PageShell';

export const metadata: Metadata = { title: 'Premier League' };

// Reads live upstream data, so it is never prerendered.
export const dynamic = 'force-dynamic';

/**
 * The real Premier League: the actual table, and every fixture and result.
 *
 * The one page in the app that touches neither FPL game. Both halves come from
 * the Pulse API behind premierleague.com, because the classic bootstrap carries
 * `played`/`won`/`points` on every club and leaves them all at zero — FPL
 * simply cannot answer "what is the table?".
 *
 * `PageShell` paints the heading above the boundary, as everywhere else: the
 * title is a static string and nobody should wait on an upstream to read it.
 */
export default function PremierLeaguePage() {
  return (
    <PageShell
      title='Premier League'
      subtitle='The real table, fixtures and results'
    >
      <Suspense
        fallback={
          <SkeletonRegion>
            <PremierLeagueSkeleton />
          </SkeletonRegion>
        }
      >
        <PremierLeague />
      </Suspense>
    </PageShell>
  );
}

async function PremierLeague() {
  const data = await readOrNull();

  if (!data) return <FeedUnavailable />;

  return <PremierLeagueTabs data={data} />;
}

/**
 * The read, and only the read, inside the `try`.
 *
 * Splitting it out is not style: JSX constructed inside a `try` puts the
 * children's own render errors into the same `catch` as the fetch, so a bug in
 * the table would render "could not be reached" and hide itself. This way the
 * catch can only ever mean what it says.
 */
async function readOrNull() {
  try {
    return await getPremierLeagueData();
  } catch (error) {
    console.error('[premier-league] Pulse could not be reached.', error);

    return null;
  }
}

/**
 * **Deliberately not a fallback table.** A table derived from finished
 * fixtures was considered and rejected: it cannot see a points deduction, so
 * it would disagree with the official table by a few points in exactly the
 * season where that matters, and it would do it without saying so. An honest
 * empty state beats a quietly wrong table.
 */
function FeedUnavailable() {
  return (
    <div className='flex items-start gap-3 rounded-xl border border-border bg-card p-6'>
      <AlertTriangle
        className='mt-0.5 h-5 w-5 shrink-0 text-[#f87171]'
        aria-hidden='true'
      />
      <div className='space-y-1'>
        <p className='text-sm font-semibold text-white'>
          The Premier League feed could not be reached
        </p>
        <p className='text-sm text-white/60'>
          The table and fixtures come straight from the Premier League. Try
          again in a few minutes.
        </p>
      </div>
    </div>
  );
}

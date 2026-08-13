import { timingSafeEqual } from 'node:crypto';

import { revalidateTag } from 'next/cache';
import { NextResponse } from 'next/server';

/**
 * Drop the cached season so the next reader recomputes it.
 *
 * Without this, a finished gameweek appears whenever `cachedRead`'s one-hour
 * window happens to lapse — up to an hour after the results are real, and at a
 * different moment for every instance. A cron running through the match-day
 * evenings makes that bounded and predictable.
 *
 * **This is the second route handler in the app, and the first one we own.**
 * The rule in AGENTS.md is that a route needs its authentication designed
 * before it is added, and here it is: the caller is Vercel Cron, not a person,
 * so a session is the wrong instrument. It presents `CRON_SECRET` as a bearer
 * token, which is compared in constant time, and `src/proxy.ts` excludes this
 * one path so the request is not redirected to sign-in before it arrives.
 *
 * Revalidating is idempotent and cheap — it discards a cache entry; the next
 * page render pays for the recompute. So a replayed request is a non-event,
 * which is why a bearer token is enough and there is no nonce.
 */
/**
 * Every cache `cachedRead` owns, tagged with its own key. Squads move on
 * waivers rather than on results, but the same evening covers both.
 */
const TAGS = ['gameweek-data', 'squads', 'draft-elements'] as const;

export async function GET(request: Request): Promise<NextResponse> {
  const secret = process.env.CRON_SECRET;

  if (!secret) {
    console.error('CRON_SECRET is not set; refusing to revalidate.');
    return NextResponse.json(
      { error: 'Misconfigured', message: 'Revalidation is not configured.' },
      { status: 500 },
    );
  }

  const presented = request.headers.get('authorization') ?? '';

  if (!matches(presented, `Bearer ${secret}`)) {
    return NextResponse.json(
      { error: 'Unauthorised', message: 'Bad or missing credentials.' },
      { status: 401 },
    );
  }

  // `'max'` is Next 16's stale-while-revalidate window: the next reader is
  // served the old season immediately while the new one computes behind them,
  // rather than waiting out a ~2s recompute. Nobody watching a table needs the
  // last hour's numbers to be atomic.
  TAGS.forEach((tag) => revalidateTag(tag, 'max'));

  return NextResponse.json({ revalidated: TAGS });
}

/**
 * Compare two secrets without leaking their contents through timing.
 *
 * The length check short-circuits, which does leak the length — that is
 * unavoidable with `timingSafeEqual`, which throws on mismatched buffers, and
 * the length of a token nobody chose is not the secret part.
 */
function matches(presented: string, expected: string): boolean {
  const a = Buffer.from(presented);
  const b = Buffer.from(expected);

  return a.length === b.length && timingSafeEqual(a, b);
}

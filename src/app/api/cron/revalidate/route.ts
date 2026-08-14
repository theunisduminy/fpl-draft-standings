import { timingSafeEqual } from 'node:crypto';

import { revalidateTag } from 'next/cache';
import { NextResponse } from 'next/server';

import type { DraftBootstrap } from '@/interfaces/fpl';
import { upsertElements } from '@/server/data/elements';
import { upsertTeams } from '@/server/data/pl-teams';
import { fplApi, getLeagueId } from '@/utils/fpl-api';
import { toElementRows, toTeamRows } from '@/utils/reference-mapping';
import { clearCache } from '@/utils/cache';
import { getGameweekData } from '@/utils/gameweek-data';
import { getSquads } from '@/utils/squads';
import { getPremierLeagueTeams } from '@/utils/pl-teams';

/**
 * Sync the reference tables, finalise any completed gameweek, then drop and
 * re-warm the caches.
 *
 * This used to only drop caches. It grew because both of the things it now does
 * were otherwise paid for by whichever visitor happened to arrive first: a
 * finished gameweek was written by a reader's request, and the 850 KB draft
 * bootstrap was re-downloaded by whichever instance went cold. Both are robot
 * work on a schedule, which is where they belong.
 *
 * **This is the second route handler in the app, and the first one we own.**
 * The rule in AGENTS.md is that a route needs its authentication designed
 * before it is added, and here it is: the caller is Vercel Cron, not a person,
 * so a session is the wrong instrument. It presents `CRON_SECRET` as a bearer
 * token, which is compared in constant time, and `src/proxy.ts` excludes this
 * one path so the request is not redirected to sign-in before it arrives.
 *
 * Replaying it is close to a non-event — the upserts are idempotent and
 * revalidation just discards cache entries — which is why a bearer token is
 * enough and there is no nonce. It is no longer *free* to replay, though, so
 * there is a single-flight guard below.
 */

/**
 * Every cache `cachedRead` owns, tagged with its own key.
 *
 * Checked against the `cachedRead` call sites rather than maintained by hand:
 * `gameweek-data.ts`, `squads.ts`, `draft-elements.ts` and `pl-teams.ts`. A
 * tag nobody registers is a silent no-op that reads as coverage.
 */
const TAGS = ['gameweek-data', 'squads', 'draft-elements', 'pl-teams'] as const;

/** One step's outcome, so a partial failure cannot be mistaken for success. */
type StepResult =
  | { step: string; ok: true; detail: string }
  | { step: string; ok: false; error: string };

/**
 * The run currently in flight on this instance, if any.
 *
 * The job is now expensive — an uncached 850 KB download, ~600 upserts and a
 * season computation — where it used to be three cache drops, so two overlapping
 * runs are worth avoiding. Deliberately **not** keyed on `synced_at`: a
 * freshness gate would make scheduled runs alternate between syncing and
 * no-oping, so effective staleness would track the budget rather than the
 * interval, which is the whole thing a higher frequency is meant to fix.
 *
 * Per-process, so it does not protect against two instances running at once.
 * That is acceptable: concurrent upserts of the same payload converge, and
 * `storeFinalisedGameweeks` is `onConflictDoNothing`. A cross-instance lock
 * would need a table, and this is not worth one.
 */
let inFlight: Promise<StepResult[]> | null = null;

export async function GET(request: Request): Promise<NextResponse> {
  const secret = process.env.CRON_SECRET;

  if (!secret) {
    console.error('CRON_SECRET is not set; refusing to sync.');
    return NextResponse.json(
      { error: 'Misconfigured', message: 'The sync job is not configured.' },
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

  if (inFlight) {
    return NextResponse.json({
      skipped: 'A sync is already running on this instance.',
    });
  }

  inFlight = runSync();

  try {
    const steps = await inFlight;

    return NextResponse.json({
      revalidated: TAGS,
      steps,
      ok: steps.every((step) => step.ok),
    });
  } finally {
    inFlight = null;
  }
}

async function runSync(): Promise<StepResult[]> {
  // The two steps are independent and are run as such: a draft bootstrap that
  // 500s must not cost us a finalised gameweek, and vice versa. `Promise.all`
  // is safe here only because `step` catches — it returns a failed `StepResult`
  // rather than rejecting, so neither branch can abort the other.
  const [reference, finalisation] = await Promise.all([
    step('reference', syncReferenceTables),
    step('finalise', finaliseGameweeks),
  ]);

  // Revalidate first, then clear, then warm — and the middle one is the step
  // that is easy to leave out and impossible to notice missing. `cachedRead`
  // checks its process-local `Map` **before** the Data Cache, and
  // `revalidateTag` does not touch that map. Warm without clearing and every
  // call below returns the entry this process already holds, never running
  // `compute`: the warm silently no-ops, and the freshly synced tables are not
  // read by anything until the in-memory TTL happens to lapse.
  TAGS.forEach((tag) => revalidateTag(tag, 'max'));
  clearCache();

  // Each cache warms on its own account. `Promise.all` here would let one
  // failure report the whole step as failed, which is how "squads warmed fine,
  // the season did not" becomes an indistinguishable red cross — and
  // `getGameweekData` is the one of the three with no fallback of its own, so
  // it is exactly the one that will fail alone.
  const warm = await step('warm', async () => {
    const caches: [string, () => Promise<unknown>][] = [
      ['gameweek-data', getGameweekData],
      ['squads', getSquads],
      ['pl-teams', getPremierLeagueTeams],
    ];

    const outcomes = await Promise.all(
      caches.map(async ([name, read]) => {
        try {
          await read();
          return name;
        } catch (error) {
          console.error(`[cron] warming ${name} failed.`, error);
          return `${name} (failed)`;
        }
      }),
    );

    const summary = outcomes.join(', ');

    // Reported as a failed step, not a successful one with a caveat buried in
    // its detail. Anything watching this route reads `ok`, and a partial warm
    // that says `ok: true` is the silent partial failure R13 exists to stop.
    if (outcomes.some((outcome) => outcome.endsWith('(failed)'))) {
      throw new Error(summary);
    }

    return summary;
  });

  return [reference, finalisation, warm];
}

/**
 * Refresh `draft_elements` and `pl_teams` from the draft bootstrap.
 *
 * **Fetched with the cache bypassed, and that is not incidental.** The ordinary
 * read path holds this payload for six hours; syncing through it would re-write
 * data up to six hours old while stamping `synced_at` as now — making the table
 * look fresh and be stale, and making a higher cron frequency buy exactly
 * nothing.
 *
 * One payload feeds both tables: the draft bootstrap carries `code`, `name` and
 * `short_name` for all 20 clubs, which is everything `pl_teams` holds, so
 * fetching the classic bootstrap as well would be a second 850 KB download for
 * data we already have. `code` is the identifier both APIs agree on, so the
 * clubs stored here are the same clubs `/profile` falls back to.
 */
async function syncReferenceTables(): Promise<string> {
  const leagueId = getLeagueId();

  const response = await fetch(fplApi.draftBootstrap(), { cache: 'no-store' });

  if (!response.ok) {
    throw new Error(`Draft bootstrap request failed with ${response.status}`);
  }

  const bootstrap = (await response.json()) as DraftBootstrap;

  // `{}` and `[]` from upstream mean "nothing yet", never "has data" — and a
  // sync that wrote nothing must say so rather than reporting success on an
  // empty payload. `upsertTeams` refuses an empty list too, because pruning on
  // one would empty an allowlist a Server Action consults.
  if (bootstrap.elements.length === 0 || bootstrap.teams.length === 0) {
    throw new Error('Draft bootstrap returned no elements or no teams.');
  }

  const [elements, teams] = await Promise.all([
    upsertElements(toElementRows(bootstrap, leagueId)),
    upsertTeams(toTeamRows(bootstrap, leagueId)),
  ]);

  return `${elements} elements, ${teams} clubs`;
}

/**
 * Write any newly finalised gameweek, by the robot rather than by whichever
 * visitor arrives first.
 *
 * `getGameweekData()` already does the work and already stores what it finds;
 * calling it here just moves *when*. A gameweek that produced no performances
 * is still not recorded, so it is retried next run — that rule lives in
 * `storeFinalisedGameweeks` and this route does not second-guess it.
 */
async function finaliseGameweeks(): Promise<string> {
  const season = await getGameweekData();

  return `${season.completedGameweeks.length} completed gameweek(s)`;
}

async function step(
  name: string,
  run: () => Promise<string>,
): Promise<StepResult> {
  try {
    return { step: name, ok: true, detail: await run() };
  } catch (error) {
    console.error(`[cron] ${name} step failed.`, error);

    return {
      step: name,
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
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

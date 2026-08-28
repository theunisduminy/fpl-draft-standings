import { timingSafeEqual } from 'node:crypto';

import { revalidateTag } from 'next/cache';
import { NextResponse } from 'next/server';

import type { DraftBootstrap } from '@/interfaces/fpl';
import { upsertElements } from '@/server/data/elements';
import { upsertTeams } from '@/server/data/pl-teams';
import { fplApi, getLeagueId } from '@/utils/fpl-api';
import { toElementRows, toTeamRows } from '@/utils/reference-mapping';
import { clearCache } from '@/utils/cache';
import { computeSeasonUncached, getGameweekData } from '@/utils/gameweek-data';
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
 * `gameweek-data.ts`, `squads.ts`, `draft-elements.ts`, `pl-teams.ts` and
 * `premier-league-data.ts`. A tag nobody registers is a silent no-op that reads
 * as coverage — and the reverse is worse: adding a `cachedRead` without adding
 * it here leaves a cache this job claims to clear and does not.
 *
 * The two Pulse caches are here for that invariant rather than out of need.
 * `premier-league` expires on its own every five minutes, well inside the
 * three-hour interval, and `pulse-compseason` answers a question whose answer
 * changes once a year. Neither costs anything to drop, and leaving them out
 * would mean the list above needed a footnote instead of being simply true.
 */
const TAGS = [
  'gameweek-data',
  'squads',
  'draft-elements',
  'pl-teams',
  'premier-league',
  'pulse-compseason',
] as const;

/** One step's outcome, so a partial failure cannot be mistaken for success. */
type StepResult =
  | { step: string; ok: true; detail: string }
  | { step: string; ok: false; error: string };

/**
 * The run currently in flight on this instance, if any, and when it started.
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
 *
 * **The timestamp is what makes the guard safe to trust.** A promise held at
 * module scope outlives the request that created it, and a serverless instance
 * is frozen the moment that request ends — so an invocation the platform kills
 * mid-run leaves this slot set with a promise that will never settle and a
 * `finally` that will never run. Without the stamp, that instance then answers
 * every later cron tick with `skipped` and **never syncs again**, reporting
 * `ok: true` while it does nothing: the reference tables go stale, and a
 * finished gameweek goes back to being written by whichever visitor arrives
 * first. This is the same trap that pinned `/premier-league` on its loading
 * skeleton, one symptom over. See "Never memoise a promise across requests" in
 * `agents/AGENTS.md`.
 */
let inFlight: { run: Promise<StepResult[]>; startedAt: number } | null = null;

/**
 * How long a run may plausibly be in flight before the slot holding it is read
 * as abandoned rather than busy.
 *
 * Ten minutes is far past any real run — the platform caps an invocation long
 * before this — and far short of the three-hour cron interval, so it can never
 * let two genuine runs overlap. It only ever unsticks a slot nothing is
 * working on.
 */
const ABANDONED_AFTER_MS = 10 * 60 * 1000;

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

  if (inFlight && Date.now() - inFlight.startedAt < ABANDONED_AFTER_MS) {
    // Carries `ok` like every other response: a monitor reads that field, and
    // a third shape without it reads as a failure when nothing failed.
    return NextResponse.json({
      ok: true,
      skipped: 'A sync is already running on this instance.',
    });
  }

  if (inFlight) {
    // Past the window, so whatever set this slot is not coming back. Say so
    // out loud: a run that vanished mid-flight is worth knowing about, and
    // silently replacing it would hide the only trace it left.
    console.error(
      `[cron] Discarding a sync that has been in flight for ${Math.round(
        (Date.now() - inFlight.startedAt) / 1000,
      )}s. Its invocation was almost certainly killed.`,
    );
  }

  const started = { run: runSync(), startedAt: Date.now() };

  inFlight = started;

  try {
    const steps = await started.run;

    return NextResponse.json({
      revalidated: TAGS,
      steps,
      ok: steps.every((step) => step.ok),
    });
  } finally {
    // Only if it is still ours. An abandoned run that somehow resumes must not
    // clear the slot belonging to the run that replaced it.
    if (inFlight === started) inFlight = null;
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

  // Expire, then clear, then warm. Both halves are easy to get wrong in ways
  // that report success:
  //
  // `{ expire: 0 }` rather than `'max'` because `'max'` is
  // stale-while-revalidate — it serves the old value to the next visitor while
  // refreshing behind them, and **the warm below is that next visitor**, so it
  // would cache the pre-sync value for the full TTL and still report `ok`. The
  // Next docs name this exact case: an external system calling a route handler
  // that needs data expired immediately.
  //
  // `clearCache()` because `cachedRead` checks its process-local `Map` before
  // the Data Cache and no tag operation touches that map, so warming without it
  // returns the entry this process already holds and never runs `compute`.
  // Wrapped like its siblings, not left bare. An unguarded throw here would
  // escape `runSync` and return a 500 with none of the `{ ok, steps }` shape
  // the rest of the route is built around — a monitor would see a dead
  // endpoint rather than "invalidation failed, the other two worked".
  const invalidate = await step('invalidate', async () => {
    TAGS.forEach((tag) => revalidateTag(tag, { expire: 0 }));
    clearCache();

    return `${TAGS.length} tags expired, in-memory cache cleared`;
  });

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

  return [reference, finalisation, invalidate, warm];
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
  const bootstrap = await fetchDraftBootstrap();

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

/** How long one attempt at the 850 KB payload may take before it is abandoned. */
const BOOTSTRAP_TIMEOUT_MS = 20_000;
/** Attempts, not retries: one immediate retry after the first failure. */
const BOOTSTRAP_ATTEMPTS = 2;
const BOOTSTRAP_RETRY_DELAY_MS = 1_000;

/**
 * The draft bootstrap, uncached, bounded, and retried once.
 *
 * **The timeout is the load-bearing half, and not for the reason it looks.**
 * `inFlight` stays set for as long as this runs, so an unbounded fetch that
 * hangs does not merely lose one sync — every later cron sees the guard still
 * held and returns "already running", and the job stops forever without
 * anything reporting a failure. A bounded attempt cannot wedge it.
 *
 * The retry is for what was actually observed: this exact call failed with a
 * bare `fetch failed` on two separate first runs against production and
 * succeeded immediately afterwards both times. `cache: 'no-store'` means there
 * is no stored response to fall back on, so a transient blip is a lost sync.
 *
 * A 4xx is **not** retried. That is upstream saying the request itself is
 * wrong — a rotated league id, a moved path — and a second attempt cannot fix
 * it, it only spends the window twice.
 */
async function fetchDraftBootstrap(): Promise<DraftBootstrap> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= BOOTSTRAP_ATTEMPTS; attempt++) {
    const outcome = await attemptBootstrapFetch();

    if (outcome.ok) return outcome.bootstrap;
    if (!outcome.retryable) throw outcome.error;

    lastError = outcome.error;

    if (attempt < BOOTSTRAP_ATTEMPTS) {
      console.error(
        `[cron] draft bootstrap attempt ${attempt} failed; retrying.`,
        outcome.error,
      );
      await new Promise((resolve) =>
        setTimeout(resolve, BOOTSTRAP_RETRY_DELAY_MS),
      );
    }
  }

  throw lastError;
}

type BootstrapAttempt =
  | { ok: true; bootstrap: DraftBootstrap }
  | { ok: false; error: Error; retryable: boolean };

async function attemptBootstrapFetch(): Promise<BootstrapAttempt> {
  try {
    const response = await fetch(fplApi.draftBootstrap(), {
      cache: 'no-store',
      signal: AbortSignal.timeout(BOOTSTRAP_TIMEOUT_MS),
    });

    if (response.ok) {
      return { ok: true, bootstrap: (await response.json()) as DraftBootstrap };
    }

    return {
      ok: false,
      error: new Error(
        `Draft bootstrap request failed with ${response.status}`,
      ),
      retryable: response.status >= 500,
    };
  } catch (error) {
    // A throw here is a network failure, a timeout, or malformed JSON — all
    // the transient kind, none of them a verdict from upstream.
    return {
      ok: false,
      error: error instanceof Error ? error : new Error(String(error)),
      retryable: true,
    };
  }
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
  // Deliberately **not** `getGameweekData()`. That wrapper would answer from
  // the process-local map on a warm instance and return a count without doing
  // any work — reporting `ok: true` while the write this step exists for never
  // happened. Writing is the point, so it goes straight to the computation.
  const season = await computeSeasonUncached();

  const finalised = season.scoredGameweeks.filter(
    (gameweek) => gameweek !== season.provisionalGameweek,
  );

  return season.provisionalGameweek
    ? `${finalised.length} finalised gameweek(s), GW${season.provisionalGameweek} in flight`
    : `${finalised.length} finalised gameweek(s)`;
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

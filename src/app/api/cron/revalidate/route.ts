import { timingSafeEqual } from 'node:crypto';

import { revalidateTag } from 'next/cache';
import { NextResponse } from 'next/server';

import type {
  DraftBootstrap,
  ElementCode,
  ElementId,
  ElementStatus,
  EntryId,
  LeagueDetails,
  LeagueEntryId,
} from '@/interfaces/fpl';
import { upsertElements } from '@/server/data/elements';
import { getFinalisedGameweeks } from '@/server/data/gameweeks';
import {
  readDraftPicks,
  seedDraftPicks,
  storeOwnershipSnapshots,
} from '@/server/data/lineage';
import { upsertTeams } from '@/server/data/pl-teams';
import {
  buildCodeByElement,
  draftForGameweek,
  toDraftPickRows,
  toOwnershipSnapshotRows,
} from '@/utils/draft-lineage';
import { getElementLookup } from '@/utils/draft-elements';
import {
  fetchUpstream,
  fplApi,
  getLeagueId,
  upstreamFetch,
} from '@/utils/fpl-api';
import { fetchLeagueDetails } from '@/utils/league';
import { toElementRows, toTeamRows } from '@/utils/reference-mapping';
import { clearCache } from '@/utils/cache';
import { computeSeasonUncached, getGameweekData } from '@/utils/gameweek-data';
import type { FinalisationGateReport } from '@/utils/gameweek-data';
import { fetchDraftChoices, getSquads } from '@/utils/squads';
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
 * `gameweek-data.ts`, `squads.ts`, `draft-elements.ts`, `pl-teams.ts`,
 * `premier-league-data.ts` and `live-gameweek.ts`. A tag nobody registers is a
 * silent no-op that reads as coverage — and the reverse is worse: adding a
 * `cachedRead` without adding it here leaves a cache this job claims to clear
 * and does not.
 *
 * The two Pulse caches are here for that invariant rather than out of need.
 * `premier-league` expires on its own every five minutes, well inside the
 * three-hour interval, and `pulse-compseason` answers a question whose answer
 * changes once a year. Neither costs anything to drop, and leaving them out
 * would mean the list above needed a footnote instead of being simply true.
 *
 * `live-gameweek` is invalidated here but deliberately never warmed below: a
 * 60 second cache warmed on a three hour schedule buys nothing and spends 12
 * upstream calls per run. The first `/live` visit after a sync warms it on
 * demand.
 */
const TAGS = [
  'gameweek-data',
  'squads',
  'draft-elements',
  'pl-teams',
  'premier-league',
  'pulse-compseason',
  'live-gameweek',
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
  //
  // `newlyFinalised` is captured out of the finalise closure: the lineage step
  // below snapshots exactly those gameweeks, so it needs the list, not just
  // the display string.
  let newlyFinalised: number[] = [];

  const [reference, finalisation] = await Promise.all([
    step('reference', syncReferenceTables),
    step('finalise', async () => {
      const result = await finaliseGameweeks();
      newlyFinalised = result.newlyStored;
      return result.detail;
    }),
  ]);

  // Sequential, after finalisation. Ownership snapshots must read the present —
  // `element-status` reflects now, not the gameweek — so they cover exactly the
  // gameweeks this run newly finalised: never older ones, whose ownership is
  // unrecoverable, and never the in-flight one. The draft seed lives here too,
  // guarded on draft id. A failure fails only this step; reference and
  // finalise still report honestly through `step`.
  const lineage = await step('lineage', () => syncLineage(newlyFinalised));

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

  return [reference, finalisation, lineage, invalidate, warm];
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
    const response = await upstreamFetch(fplApi.draftBootstrap(), {
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
 * Two-phase since the 2026-08-21 incident: a gameweek that newly reads as
 * final is held as a candidate and only written after a second agreeing read
 * at least CANDIDATE_HOLD_SECONDS later, with draft shape-tripwire probes
 * gating every write. So a genuinely finished gameweek is stored up to about
 * one three hour cron cycle later than it settles, and the in-flight display
 * covers the gap with provisional labelling. The detail below names every
 * gameweek that was finalised, held for agreement, blocked by a probe, or
 * dropped without a write; held and blocked weeks stay absent and are retried
 * next run. A gameweek that produced no performances is still not recorded, so
 * it is retried next run — that rule lives in `storeFinalisedGameweeks` and
 * this route does not second-guess it.
 *
 * Returns the display detail plus the gameweeks this run newly stored, so the
 * lineage step can snapshot exactly those. The outward `StepResult` shape is
 * unchanged — `runSync` unwraps `detail` for the step.
 */
async function finaliseGameweeks(): Promise<{
  detail: string;
  newlyStored: number[];
}> {
  // The before-image for the newly-stored diff below. A read failure here must
  // not fail finalisation — it only means lineage snapshots nothing this run,
  // which is the safe direction (absence over misattribution).
  const before = await getFinalisedGameweeks().catch((error) => {
    console.error(
      '[cron] could not read finalised gameweeks before finalising; lineage will snapshot nothing.',
      error,
    );
    return null;
  });

  // Deliberately **not** `getGameweekData()`. That wrapper would answer from
  // the process-local map on a warm instance and return a count without doing
  // any work — reporting `ok: true` while the write this step exists for never
  // happened. Writing is the point, so it goes straight to the computation.
  const gate: FinalisationGateReport = {
    finalised: [],
    held: [],
    blocked: [],
    dropped: [],
  };
  const season = await computeSeasonUncached(gate);

  // finalised: confirmed by two agreeing reads and written. held: read as
  // final but awaiting a second agreeing read (or scored data). blocked: a
  // probe refused the write, with the failing probe names and payload
  // evidence in the log. dropped: the candidate was removed without a write
  // (decider reversal, or the week was already stored).
  const parts = [`${gate.finalised.length} finalised gameweek(s)`];
  parts.push(
    gate.held.length > 0
      ? `${gate.held.length} held (${gate.held.map((h) => `GW${h.gameweek}: ${h.reason}`).join(', ')})`
      : '0 held',
  );
  parts.push(
    gate.blocked.length > 0
      ? `${gate.blocked.length} blocked (${gate.blocked.map((b) => `GW${b.gameweek}: ${b.probes.join('+')}`).join(', ')})`
      : '0 blocked',
  );
  parts.push(
    gate.dropped.length > 0
      ? `${gate.dropped.length} dropped (${gate.dropped.map((gameweek) => `GW${gameweek}`).join(', ')})`
      : '0 dropped',
  );

  if (season.provisionalGameweek) {
    parts.push(`GW${season.provisionalGameweek} in flight`);
  }

  if (gate.blocked.length > 0) {
    // A blocked write never persists, so this points at the log evidence, not
    // at a repair: the undo below is for the opposite case, a write that
    // should not have happened.
    parts.push(
      'blocked writes never persist (see the log evidence); reverse a bad write with scripts/forget-gameweek.mjs',
    );
  }

  const detail = parts.join(', ');

  // The diff, not the store's own return: `storeFinalisedGameweeks` reports
  // every storable gameweek including ones already held, while snapshots must
  // cover exactly what this run added — `onConflictDoNothing` means re-stored
  // rows are not new facts.
  const after = await getFinalisedGameweeks().catch((error) => {
    console.error(
      '[cron] could not read finalised gameweeks after finalising; lineage will snapshot nothing.',
      error,
    );
    return null;
  });

  const newlyStored =
    before && after
      ? [...after]
          .filter((gameweek) => !before.has(gameweek))
          .sort((a, b) => a - b)
      : [];

  return { detail, newlyStored };
}

/**
 * Persist the draft-to-waiver lineage: the frozen draft record and one
 * ownership snapshot per newly-finalised gameweek.
 *
 * Runs sequentially after finalisation in the same invocation, so "newly
 * finalised" and "present ownership" are minutes apart at most. Everything
 * throws into the `step` wrapper: a failed `element-status` read fails only
 * this step while reference and finalise still report honestly.
 */
async function syncLineage(newlyFinalised: number[]): Promise<string> {
  const leagueId = getLeagueId();
  const details = await fetchLeagueDetails(leagueId);
  const lookup = await getElementLookup();

  // Stable codes are the join key everywhere lineage persists. The lookup
  // resolves them, and anything it cannot resolve is dropped by the mapping
  // helpers rather than stored with a null code.
  const codeOf = (element: ElementId): ElementCode | null =>
    lookup.describe(element).code;

  const seeded = await seedUnseededDrafts(details, codeOf, leagueId);
  const snapshotted = await snapshotNewlyFinalised(
    newlyFinalised,
    details,
    codeOf,
    leagueId,
  );

  return `${seeded}; ${snapshotted}`;
}

/**
 * Seed the frozen draft record, once per draft id.
 *
 * The guard keys on the upstream draft id, not on row count: a populated table
 * is never re-synced, while a newly started draft (the GW24 re-draft) still
 * seeds when its id appears. An empty choices response seeds nothing and
 * deletes nothing — against a populated table that is the draft board surviving
 * an upstream wipe; against an empty one the next run simply retries.
 */
async function seedUnseededDrafts(
  details: LeagueDetails,
  codeOf: (element: ElementId) => ElementCode | null,
  leagueId: number,
): Promise<string> {
  const started = details.league.drafts.filter((draft) => draft.draft_started);

  if (started.length === 0) return 'no started drafts to seed';

  const stored = await readDraftPicks();
  const seededIds = new Set(stored.map((pick) => pick.draftId));
  const unseeded = started.filter((draft) => !seededIds.has(draft.id));

  if (unseeded.length === 0) {
    return `${started.length} started draft(s) already seeded`;
  }

  // Once: the choices endpoint is league scoped, not draft scoped, so every
  // unseeded draft is attributed the same list.
  const choices = await fetchDraftChoices(leagueId);

  if (choices.length === 0) {
    return `choices empty; ${unseeded.length} draft(s) left unseeded`;
  }

  const codeByElement = buildCodeByElement(
    choices.map((choice) => choice.element),
    codeOf,
  );

  let written = 0;

  for (const draft of unseeded) {
    const rows = toDraftPickRows(choices, {
      leagueId,
      draftId: draft.id,
      draftEvent: draft.event,
      codeByElement,
    });

    // Nothing resolvable (no codes): inserting an empty set would write
    // nothing anyway, and the draft stays unseeded for the next run.
    if (rows.length === 0) continue;

    written += await seedDraftPicks(rows);
  }

  return `seeded ${written} pick(s) across ${unseeded.length} draft(s)`;
}

/**
 * Snapshot ownership for exactly the gameweeks this run newly finalised.
 *
 * `element-status` reflects the present, so snapshotting any other gameweek
 * would misattribute it: older ones are unrecoverable and stay absent, and the
 * in-flight one is never in the list. A gameweek no draft covers is
 * unattributable rather than an error, so it is skipped and named.
 */
async function snapshotNewlyFinalised(
  newlyFinalised: number[],
  details: LeagueDetails,
  codeOf: (element: ElementId) => ElementCode | null,
  leagueId: number,
): Promise<string> {
  if (newlyFinalised.length === 0) {
    return 'no newly-finalised gameweeks to snapshot';
  }

  const attributable = newlyFinalised.filter((gameweek) => {
    if (draftForGameweek(details.league.drafts, gameweek)) return true;

    console.error(
      `[cron] GW${gameweek} is finalised but no draft covers it; leaving it unsnapshotted.`,
    );

    return false;
  });

  if (attributable.length === 0) {
    return 'no attributable gameweeks to snapshot';
  }

  const ownership = await fetchUpstream<{ element_status: ElementStatus[] }>(
    fplApi.elementStatus(leagueId),
  );

  // One read, resolved once: every snapshotted gameweek shares the same
  // present-tense ownership, which is exactly why only newly-finalised ones
  // may be stored.
  const codeByElement = buildCodeByElement(
    ownership.element_status.map((status) => status.element),
    codeOf,
  );
  const leagueEntryByEntry = new Map<EntryId, LeagueEntryId>(
    details.league_entries.map((entry) => [entry.entry_id, entry.id]),
  );

  let stored = 0;

  for (const gameweek of attributable) {
    const rows = toOwnershipSnapshotRows(ownership.element_status, {
      leagueId,
      gameweek,
      codeByElement,
      leagueEntryByEntry,
    });
    stored += await storeOwnershipSnapshots(gameweek, rows);
  }

  // Zero rows stored for attributable gameweeks is a failure, not a quiet
  // success: it means the ownership read was refused or nothing resolved,
  // and reporting ok would retire the gameweeks from every future diff.
  if (stored === 0) {
    throw new Error(
      `snapshotted 0 row(s) for GW${attributable.join(', GW')}; failing the step so it retries`,
    );
  }

  return `snapshotted GW${attributable.join(', GW')} (${stored} row(s))`;
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

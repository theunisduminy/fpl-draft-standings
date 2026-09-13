import type {
  GameweekPerformance,
  GameweekDataResponse,
} from '@/interfaces/players';
import { GameWeekStatus } from '@/interfaces/match';
import type {
  EventLive,
  GameState,
  LeagueEntry,
  LeagueStanding,
} from '@/interfaces/fpl';
import {
  getFinalisedGameweeks,
  getStoredPerformances,
  storeFinalisedGameweeks,
} from '@/server/data/gameweeks';
/**
 * Candidate persistence behind a hand applied migration.
 *
 * `readCandidates` resolves the current league's candidate rows
 * (`FinalisationCandidateRow`: gameweek, fingerprint, firstSeen, lastChecked,
 * blockReason); `recordCandidate(gameweek, fingerprint)` creates or resets
 * one; `confirmCandidate(gameweek)` deletes one (used for both confirm and
 * drop); `noteBlocked(gameweek, fingerprint, reason)` records or updates the
 * truncated block reason without confirming.
 */
import {
  confirmCandidate,
  noteBlocked,
  readCandidates,
  recordCandidate,
} from '@/server/data/finalisation';
import {
  aggregatePlayers,
  assignRanks,
  buildRumblerData,
  scoreGameweek,
  type EntryPicks,
} from './scoring';
import { deriveSeasonState } from './season-state';
/**
 * Two-phase finalise gate.
 *
 * `fingerprintPerformances` stably serialises one gameweek's scored content
 * plus the played signal; `evaluateCandidate` maps
 * `{ existing, fingerprint, deciderFinal, nowSeconds, isEmpty }` to
 * `{ outcome, candidate }` with `outcome` one of `record`, `hold`, `confirm`,
 * `reset` or `drop`; and `CANDIDATE_HOLD_SECONDS` (7200, two hours against
 * the three hour cron) is the minimum age of a candidate before it may
 * confirm.
 */
import {
  CANDIDATE_HOLD_SECONDS,
  evaluateCandidate,
  fingerprintPerformances,
  type CandidateRecord,
} from './finalisation';
/**
 * Draft shape-tripwire probes.
 *
 * `runDraftProbes` is pure and synchronous, taking the raw upstream bodies
 * (`{ eventStatusBody, liveData, leagueDetails }`) and returning one
 * `{ name, pass, evidence }` result per probe, failing closed on unknown
 * shapes. The already parsed reads are wrapped back into those bodies at the
 * call site; `fetchEventStatus` already maps the pre-season 404 to `[]`, so
 * the shape probe sees `{ status: [] }` there while the rows probe still
 * reads every row.
 */
import { runDraftProbes, truncateText } from './shape-tripwires';
import { fplApi, getLeagueId, upstreamFetch } from './fpl-api';
import { fetchEntryPicks } from './gameweek-squad';
import { fetchLeagueDetails } from './league';
import { cachedRead } from './cache';

const CACHE_KEY = 'gameweek-data';
/**
 * Five minutes, matching the `revalidate` on the live feed and the picks below.
 *
 * It was an hour, on the reasoning that FPL data only changes once per
 * gameweek. That stopped being true when the season started including the
 * gameweek in progress: caching the aggregate for longer than its own inputs
 * means a reader watching Sunday afternoon sees a score frozen at lunchtime,
 * and the whole point of showing an in-flight week is that it moves. The extra
 * cost is one league read, two state reads and nine calls for the live gameweek
 * per five minutes, which for an eight-person league is nothing.
 */
const CACHE_TTL_SECONDS = 300;
const BATCH_SIZE = 5; // fetch 5 gameweeks at a time to avoid flooding the API

/**
 * Between seasons `/pl/event-status` answers 404 with the bare string
 * "Game not started" — not the usual `{ status: [...] }` object. Treat that as
 * "no gameweeks have been played yet" so the app renders an empty season
 * instead of failing.
 *
 * Shared with the live slice, which reads the same endpoint for the same
 * reason rather than restating the 404 mapping.
 */
export async function fetchEventStatus(): Promise<GameWeekStatus[]> {
  const res = await upstreamFetch(fplApi.eventStatus());

  if (res.status === 404) {
    return [];
  }

  if (!res.ok) {
    throw new Error(`Event status request failed with ${res.status}`);
  }

  const body = (await res.json()) as { status?: GameWeekStatus[] } | null;
  return Array.isArray(body?.status) ? body.status : [];
}

/**
 * `/api/game` — the only draft endpoint that answers year-round.
 *
 * Resolves to `null` rather than throwing, because it is a cross-check: without
 * it `deriveSeasonState` falls back to `event-status` alone, which is still
 * correct for a completed gameweek and merely defers an in-flight one. Losing
 * the whole season because one state endpoint blipped would be the worse trade.
 */
async function fetchGameState(): Promise<GameState | null> {
  try {
    const res = await upstreamFetch(fplApi.game());

    if (!res.ok) return null;

    const body = (await res.json()) as GameState;

    return typeof body?.current_event_finished === 'boolean' ? body : null;
  } catch (error) {
    console.error('[season] /api/game could not be read.', error);
    return null;
  }
}

/**
 * Score a contiguous run of gameweeks from the live feed and everyone's picks.
 *
 * `finished` is threaded straight through to `scoreGameweek` and is what marks
 * the results as safe to persist. The in-flight gameweek goes through this same
 * function with `false`.
 *
 * Returns the scored performances alongside the raw live feed per gameweek.
 * The feed is what the shape-tripwire probes read: an unscored week leaves no
 * performances behind, so without it the probes could not tell an empty feed
 * from a played one.
 */
async function fetchGameweekBatch(
  startGw: number,
  endGw: number,
  leagueEntries: LeagueEntry[],
  finished: boolean,
): Promise<{
  performances: GameweekPerformance[];
  liveByGameweek: Map<number, EventLive | null>;
}> {
  const batchPromises = [];

  for (let gw = startGw; gw <= endGw; gw++) {
    batchPromises.push(
      Promise.all([
        upstreamFetch(fplApi.eventLive(gw)).then(
          (res) => res.json() as Promise<EventLive>,
        ),
        // `entry_id` addresses the URL, `id` identifies the manager. They are
        // different numbers for the same person; the branded types are what
        // stop them being swapped here.
        ...leagueEntries.map((entry): Promise<EntryPicks> =>
          fetchEntryPicks(entry.entry_id, gw)
            .then((picks) => ({ league_entry: entry.id, picks }))
            // A manager whose picks cannot be read drops out with an empty
            // list, which `scoreGameweek` treats as "not played" rather than
            // scoring a partial league.
            .catch(() => ({ league_entry: entry.id, picks: [] })),
        ),
      ])
        .then(([liveData, ...playerPicks]) => ({
          gameweek: gw,
          liveData,
          playerPicks,
        }))
        .catch(() => ({
          gameweek: gw,
          liveData: null as EventLive | null,
          playerPicks: [] as EntryPicks[],
        })),
    );
  }

  const results = await Promise.all(batchPromises);

  const liveByGameweek = new Map<number, EventLive | null>();

  // `scoreGameweek` returns nothing for a gameweek that cannot be scored, so an
  // unplayed week falls out of the results rather than being stored as zeros.
  const performances = results.flatMap(
    ({ gameweek, liveData, playerPicks }) => {
      liveByGameweek.set(gameweek, liveData);
      return scoreGameweek(gameweek, liveData, playerPicks, finished);
    },
  );

  return { performances, liveByGameweek };
}

/**
 * Fetch only the gameweeks we don't already hold.
 *
 * A finished gameweek is immutable, so anything already in the database is
 * read back rather than refetched. Recomputing the whole season costs
 * `9 x gameweeks` upstream calls — 344 by May — and the in-memory cache does
 * not survive a cold start, so without this every new serverless instance paid
 * that bill in full.
 *
 * Batching still applies to whatever genuinely is missing, so a first run (or
 * a rebuilt database) behaves exactly as it used to.
 */
async function fetchMissingGameweeks(
  missing: number[],
  leagueEntries: LeagueEntry[],
): Promise<{
  performances: GameweekPerformance[];
  liveByGameweek: Map<number, EventLive | null>;
}> {
  const fetched: GameweekPerformance[] = [];
  const liveByGameweek = new Map<number, EventLive | null>();
  const missingSet = new Set(missing);

  for (let i = 0; i < missing.length; i += BATCH_SIZE) {
    const batch = missing.slice(i, i + BATCH_SIZE);
    // The batch helper takes a range; consecutive gameweeks are the norm, and
    // a sparse batch just means a few wasted slots in one round.
    const batchData = await fetchGameweekBatch(
      batch[0],
      batch[batch.length - 1],
      leagueEntries,
      // Only ever called with gameweeks `deriveSeasonState` has declared final.
      true,
    );
    batchData.liveByGameweek.forEach((live, gameweek) => {
      liveByGameweek.set(gameweek, live);
    });
    fetched.push(
      ...batchData.performances.filter((p) => missingSet.has(p.event)),
    );
  }

  return { performances: fetched, liveByGameweek };
}

/**
 * Compute the season from scratch: upstream, database, scoring, aggregation.
 *
 * Expensive — three upstream calls and two database round trips before any
 * gameweek work, which measured ~2s from here, plus nine more calls whenever a
 * gameweek is in flight. Readers always reach it through `getGameweekData()`,
 * never directly.
 *
 * Exported only for the sync job, which must **not** go through the cache: its
 * whole purpose is to write any newly finalised gameweek, and a cache hit would
 * return a count without doing that work while still reporting success. Every
 * other caller wants the cached wrapper.
 */
export async function computeSeasonUncached(
  report?: FinalisationGateReport,
): Promise<GameweekDataResponse> {
  const leagueId = getLeagueId();

  // The two database reads are keyed off the league alone, so they do not
  // wait on the upstream calls — issuing all five together removes a serial
  // Neon round trip, which measured 290-650ms, from every cold read.
  const [
    { league_entries, standings },
    status,
    game,
    finalised,
    storedPerformances,
  ] = await Promise.all([
    fetchLeagueDetails(leagueId),
    fetchEventStatus(),
    fetchGameState(),
    getFinalisedGameweeks(),
    getStoredPerformances(),
  ]);

  // The one place "is this gameweek over?" is decided. Read `season-state.ts`
  // before touching it: `event-status` has a row per **date**, so the obvious
  // `some(leagues_updated)` reading declares a gameweek complete on its opening
  // Friday night.
  const { currentGameweek, finalisedThrough } = deriveSeasonState(status, game);

  // Fetch only the gap between what we hold and what is genuinely settled.
  // Nothing in flight ever reaches this list — a stored gameweek is never
  // refetched, so storing a provisional one freezes it for the season.
  const missing: number[] = [];
  for (let gw = 1; gw <= finalisedThrough; gw++) {
    if (!finalised.has(gw)) missing.push(gw);
  }

  const { performances: freshPerformances, liveByGameweek } =
    await fetchMissingGameweeks(missing, league_entries);

  // Every finalised-but-unstored write passes two gates here, in both page
  // renders and the sync job: draft shape-tripwire probes first, then
  // candidate agreement across two reads. Either gate refuses by leaving the
  // gameweek absent for retry, never by throwing. `storeFinalisedGameweeks`
  // below is untouched as the last line of defence.
  //
  // The gate is owned here rather than inside finaliseGatedGameweeks so the
  // display filter below reads the same object the sync job reports through.
  const gate: FinalisationGateReport = report ?? {
    finalised: [],
    held: [],
    blocked: [],
    dropped: [],
  };
  await finaliseGatedGameweeks({
    missing,
    performances: freshPerformances,
    liveByGameweek,
    status,
    leagueEntries: league_entries,
    standings,
    finalisedThrough,
    stored: finalised,
    report: gate,
  });

  // The gameweek being played right now, scored fresh on every cache miss and
  // deliberately never written down.
  //
  // **Shown, not hidden.** A league table that ignores the weekend in progress
  // is wrong on the one day everybody looks at it, so the provisional result
  // ranks and pays F1 points exactly like a settled one; the surfaces that show
  // it say that it is provisional. What it must never do is persist, because
  // `gameweeks` is a claim that a result will never change again.
  const inFlight = currentGameweek > finalisedThrough ? currentGameweek : null;

  const provisional = inFlight
    ? (await fetchGameweekBatch(inFlight, inFlight, league_entries, false))
        .performances
    : [];

  // Written facts only. freshPerformances carries every fetched week,
  // including held and blocked ones whose fingerprints the gate above needs —
  // but only gate.finalised weeks were actually written this run. An
  // unconfirmed week must not render as settled history (a provisional rank
  // shown as settled is worse than a gap), so held and blocked weeks stay
  // absent until a later tick confirms them. The in-flight week below is the
  // one provisional surface, with its label intact.
  const confirmed = new Set(gate.finalised);
  const historicalData = [
    ...withoutInFlight(storedPerformances, inFlight, provisional.length > 0),
    ...freshPerformances.filter((performance) =>
      confirmed.has(performance.event),
    ),
    ...provisional,
  ];

  // Last resort for the current gameweek when its live feed or its picks are
  // unreadable: upstream's own `event_total`, which is a different source from
  // the starting-XI sum stored everywhere else. Provisional for that reason as
  // much as any other — it is never persisted, so the two sources cannot mix in
  // the history, and the gameweek is retried on the next run.
  const fallback = standingsFallback(
    standings,
    currentGameweek,
    historicalData,
  );

  historicalData.push(...fallback);

  const provisionalGameweek =
    provisional.length > 0 || fallback.length > 0 ? currentGameweek : null;

  const scoredGameweeks = Array.from(
    new Set(historicalData.map((gw) => gw.event)),
  ).sort((a, b) => b - a);

  return {
    players: aggregatePlayers(league_entries, historicalData, standings),
    gameweekPerformances: historicalData,
    currentGameweek,
    scoredGameweeks,
    provisionalGameweek,
    rumblerData: buildRumblerData(historicalData, league_entries),
  };
}

/**
 * What the two-phase finalise gate decided on this computation, per gameweek.
 *
 * Additive observability only: the season response shape is unchanged, and a
 * caller that does not care passes nothing and gets nothing. The cron sync job
 * passes one in and formats it into the finalise step detail, so Monday
 * behaviour (held, blocked, dropped) is visible without new routes.
 */
export interface FinalisationGateReport {
  /** Gameweeks confirmed by two agreeing reads and written by this run. */
  finalised: number[];
  /** Gameweeks read as final but not yet writable, with why. */
  held: { gameweek: number; reason: string }[];
  /** Gameweeks refused by a shape-tripwire probe, with evidence. */
  blocked: { gameweek: number; probes: string[]; evidence: string }[];
  /** Gameweeks whose candidate was removed without a write. */
  dropped: number[];
}

/**
 * Route every finalised-but-unstored gameweek through the two pre-write gates.
 *
 * On 2026-08-21 a single agreeing read froze a wrong GW1 for the season: a
 * finalised gameweek is never refetched and writes are onConflictDoNothing, so
 * a gameweek stored early stays wrong. Since then no gameweek finalises on one
 * read. The first read that finds a gameweek final but unstored records a
 * candidate row and holds; the write happens only when a later read, at least
 * CANDIDATE_HOLD_SECONDS after the first, still finds it final with an
 * identical fingerprint. Upstream shape drift blocks the write before that,
 * with payload evidence.
 *
 * Gate refusals stay non-throwing by design, following rejectUnfinalisable:
 * the caller serves every page render, so refusing the write is the entire
 * job. The gameweek stays absent and the next run tries again.
 */
async function finaliseGatedGameweeks(args: {
  missing: number[];
  performances: GameweekPerformance[];
  liveByGameweek: Map<number, EventLive | null>;
  status: GameWeekStatus[];
  leagueEntries: LeagueEntry[];
  standings: LeagueStanding[];
  finalisedThrough: number;
  stored: Set<number>;
  report: FinalisationGateReport | undefined;
}): Promise<void> {
  const {
    missing,
    performances,
    liveByGameweek,
    status,
    leagueEntries,
    standings,
    finalisedThrough,
    stored,
  } = args;
  const gate: FinalisationGateReport = args.report ?? {
    finalised: [],
    held: [],
    blocked: [],
    dropped: [],
  };

  // Candidates are the proof that two reads agreed across a cron boundary:
  // instance memory does not survive serverless cold starts. Without the table
  // (before the hand applied production migration lands) there is no proof, so
  // every write waits. That is the safe direction: finalisation holds rather
  // than confirms.
  const candidates = new Map<number, CandidateRecord>();
  try {
    const rows = await readCandidates();
    rows.forEach((row) => {
      candidates.set(row.gameweek, {
        fingerprint: row.fingerprint,
        firstSeenSeconds: Math.floor(toEpochMs(row.firstSeen) / 1000),
      });
    });
  } catch (error) {
    console.error(
      '[season] Finalisation candidates could not be read; holding every write until they can be.',
      error,
    );
    missing.forEach((gameweek) => {
      gate.held.push({ gameweek, reason: 'candidate store unreachable' });
    });
    return;
  }

  // Decider reversal, and the already-stored leftover: a candidate for a
  // gameweek deriveSeasonState no longer calls final is dropped, never
  // confirmed, and a candidate whose gameweek somehow got stored has served
  // its purpose. Both delete through confirmCandidate.
  for (const gameweek of candidates.keys()) {
    const alreadyStored = stored.has(gameweek);
    if (!alreadyStored && gameweek <= finalisedThrough) continue;
    try {
      await confirmCandidate(gameweek);
    } catch (error) {
      console.error(
        `[season] GW${gameweek} candidate could not be dropped; it stays and will be retried.`,
        error,
      );
      continue;
    }
    candidates.delete(gameweek);
    gate.dropped.push(gameweek);
    console.error(
      `[season] GW${gameweek} candidate dropped ` +
        `(${alreadyStored ? 'already stored' : 'no longer final'}).`,
    );
  }

  const byGameweek = new Map<number, GameweekPerformance[]>();
  performances.forEach((performance) => {
    const week = byGameweek.get(performance.event) ?? [];
    week.push(performance);
    byGameweek.set(performance.event, week);
  });

  const writable: GameweekPerformance[] = [];
  const confirmPending: number[] = [];

  for (const gameweek of missing) {
    const week = byGameweek.get(gameweek) ?? [];

    // scoreGameweek already refused the unscorable shapes (an empty or
    // all-zero live feed, unreadable picks), which is why there is nothing
    // here. An empty list never confirms, so no candidate is recorded and the
    // week stays absent for retry.
    if (week.length === 0) {
      gate.held.push({ gameweek, reason: 'awaiting scored performances' });
      continue;
    }

    // Coverage: every league entry must have scored. A transiently unreadable
    // entry drops out of the week upstream, and two agreeing partial reads
    // would fingerprint identically and freeze seven managers' truth in as
    // the eight's — the joint-first bug in a subtler shape. The week holds
    // for retry rather than confirming short.
    const scoredEntries = new Set(week.map((p) => p.league_entry));
    if (!leagueEntries.every((entry) => scoredEntries.has(entry.id))) {
      gate.held.push({
        gameweek,
        reason: 'incomplete picks; will be retried',
      });
      continue;
    }

    // The fingerprint is the scored content the confirming read must
    // reproduce exactly, mixed with the played signal so an unscored feed
    // wearing the shape of a scored one cannot agree with the real thing.
    const liveData = liveByGameweek.get(gameweek) ?? null;
    const fingerprint = fingerprintPerformances(week, liveData);

    // Gate one: draft probes run before anything is stored. A failure drops
    // the week from the writable set, records the block reason on the
    // candidate, and leaves the week absent for retry.
    const failed = probeGameweekFailures({
      status,
      liveData,
      leagueEntries,
      standings,
    });
    if (failed.length > 0) {
      const probes = failed.map((result) => result.name);
      const evidence = truncateText(
        failed
          .map((result) => `${result.name}: ${result.evidence}`)
          .join(' | '),
      );
      console.error(
        `[season] GW${gameweek} blocked by shape tripwire (${probes.join(', ')}). ` +
          `Evidence: ${evidence} It stays absent and will be retried.`,
      );
      try {
        await noteBlocked(
          gameweek,
          fingerprint,
          truncateText(`blocked by ${probes.join(', ')}: ${evidence}`),
        );
      } catch (error) {
        console.error(
          `[season] GW${gameweek} block reason could not be recorded; the write is still refused.`,
          error,
        );
      }
      gate.blocked.push({ gameweek, probes, evidence });
      continue;
    }

    // Gate two: candidate agreement. First sighting records and holds; an
    // agreeing read past the hold interval confirms; a changed fingerprint
    // resets the hold; a decider reversal drops (unreachable for a missing
    // week, which is still final by construction, but handled all the same).
    // The week is non-empty here, so isEmpty is false: the empty list never
    // reaches the decider.
    const nowSeconds = Math.floor(Date.now() / 1000);
    const decision = evaluateCandidate({
      existing: candidates.get(gameweek) ?? null,
      fingerprint,
      deciderFinal: true,
      nowSeconds,
      isEmpty: false,
    });

    if (decision.outcome === 'confirm') {
      writable.push(...week);
      confirmPending.push(gameweek);
    } else if (decision.outcome === 'drop') {
      try {
        await confirmCandidate(gameweek);
      } catch (error) {
        console.error(
          `[season] GW${gameweek} candidate could not be dropped; it stays and will be retried.`,
          error,
        );
        gate.held.push({
          gameweek,
          reason: 'candidate drop failed; will be retried',
        });
        continue;
      }
      candidates.delete(gameweek);
      gate.dropped.push(gameweek);
      console.error(
        `[season] GW${gameweek} candidate dropped (no longer final).`,
      );
    } else {
      if (decision.outcome !== 'hold') {
        try {
          await recordCandidate(gameweek, fingerprint);
        } catch (error) {
          console.error(
            `[season] GW${gameweek} candidate could not be recorded; holding without proof.`,
            error,
          );
        }
        candidates.set(gameweek, { fingerprint, firstSeenSeconds: nowSeconds });
      }
      gate.held.push({
        gameweek,
        reason:
          decision.outcome === 'reset'
            ? 'fingerprint changed; hold restarted'
            : decision.outcome === 'record'
              ? `first sighting; held at least ${CANDIDATE_HOLD_SECONDS}s for a second agreeing read`
              : 'agreeing read inside the hold window',
      });
    }
  }

  // The write itself, still through the untouched last line of defence:
  // storeFinalisedGameweeks refuses provisional rows and all-zero weeks, and
  // inserts onConflictDoNothing. Only a week it actually wrote has its
  // candidate confirmed away; a refused week stays absent (held) with its
  // candidate intact for the next tick.
  const storedNow =
    writable.length > 0
      ? new Set(await storeFinalisedGameweeks(writable))
      : new Set<number>();

  for (const gameweek of confirmPending) {
    if (!storedNow.has(gameweek)) {
      console.error(
        `[season] GW${gameweek} confirmed twice but refused by the final guard. It stays absent and will be retried.`,
      );
      gate.held.push({
        gameweek,
        reason: 'refused by the final guard; stays absent',
      });
      continue;
    }
    try {
      await confirmCandidate(gameweek);
    } catch (error) {
      console.error(
        `[season] GW${gameweek} stored but its candidate could not be confirmed away; the next tick drops it as already stored.`,
        error,
      );
    }
    candidates.delete(gameweek);
    gate.finalised.push(gameweek);
  }
}

/**
 * Run the draft shape-tripwire probes for one gameweek, failing closed.
 *
 * A probe harness that throws proves nothing about the payload, so the throw
 * itself becomes the failing probe and the write is refused with it as
 * evidence. Follows rejectUnfinalisable: never throws.
 */
function probeGameweekFailures(args: {
  status: GameWeekStatus[];
  liveData: EventLive | null;
  leagueEntries: LeagueEntry[];
  standings: LeagueStanding[];
}): { name: string; pass: boolean; evidence: string }[] {
  try {
    return runDraftProbes({
      eventStatusBody: { status: args.status },
      liveData: args.liveData,
      leagueDetails: {
        league_entries: args.leagueEntries,
        standings: args.standings,
      },
    }).filter((result) => !result.pass);
  } catch (error) {
    return [
      {
        name: 'probe-runner',
        pass: false,
        evidence: truncateText(
          error instanceof Error ? error.message : String(error),
        ),
      },
    ];
  }
}

/**
 * Candidate timestamps cross the database driver, so read them structurally:
 * a Date in the normal case, epoch millis or an ISO string if the row type
 * ever says otherwise.
 */
function toEpochMs(value: Date | number | string): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return Date.parse(value);
  return value.getTime();
}

/**
 * Drop stored rows for a gameweek that is still being played.
 *
 * There should never be any: a gameweek is only written once
 * `deriveSeasonState` calls it final. But the whole reason this file changed is
 * that the app used to write one on the opening Friday night, and those rows
 * cannot be corrected by a later run — `storeFinalisedGameweeks` inserts with
 * `onConflictDoNothing`. Left in place they would sit beside the live scoring
 * for the same gameweek and every manager would appear twice.
 *
 * So the live scoring wins and the stale rows are logged, loudly, because the
 * fix is a `scripts/forget-gameweek.mjs` run that nobody will make if the
 * symptom quietly disappears. `replaced` guards against the other direction:
 * with nothing to replace them, keeping the rows beats blanking the gameweek.
 */
function withoutInFlight(
  stored: GameweekPerformance[],
  inFlight: number | null,
  replaced: boolean,
): GameweekPerformance[] {
  if (inFlight === null || !replaced) return stored;
  if (!stored.some((gw) => gw.event === inFlight)) return stored;

  console.error(
    `[season] GW${inFlight} is stored as finalised but is still being played. ` +
      'Using the live scoring; delete the stored rows with ' +
      `\`node --env-file=.env.local scripts/forget-gameweek.mjs ${inFlight} --prod\`.`,
  );

  return stored.filter((gw) => gw.event !== inFlight);
}

/**
 * The current gameweek reconstructed from `standings[].event_total`, or nothing.
 *
 * Only fires when the gameweek is genuinely absent from the results, and only
 * when somebody has actually scored. That second guard is the important one:
 * post-draft and pre-kick-off, upstream returns a full row per manager with
 * `event_total: 0`, and ranking eight zeros is precisely the joint-first bug
 * that this whole change exists to stop.
 */
function standingsFallback(
  standings: LeagueStanding[] | undefined,
  currentGameweek: number,
  performances: GameweekPerformance[],
): GameweekPerformance[] {
  if (!standings || currentGameweek <= 0) return [];
  if (performances.some((gw) => gw.event === currentGameweek)) return [];
  if (!standings.some((standing) => standing.event_total > 0)) return [];

  return assignRanks(
    standings.map((standing) => ({
      league_entry: standing.league_entry,
      event_total: standing.event_total,
    })),
  ).map((player) => ({
    event: currentGameweek,
    league_entry: player.league_entry,
    event_total: player.event_total,
    rank: player.rank,
    finished: false,
  }));
}

/**
 * The season, cached.
 *
 * Both cache layers live in `cachedRead`; see there for why a per-process map
 * still earns its place in front of the shared one. Revalidate early with
 * `revalidateTag('gameweek-data', { expire: 0 })` — which is what the cron
 * route does on every sync.
 */
export const getGameweekData = cachedRead(
  CACHE_KEY,
  CACHE_TTL_SECONDS,
  computeSeasonUncached,
);

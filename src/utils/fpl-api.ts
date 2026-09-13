import 'server-only';

import { Agent, fetch as undiciFetch } from 'undici';

import type { EntryId } from '@/interfaces/fpl';

/**
 * The single source of truth for every upstream Premier League API this app
 * reads, plus the environment-derived league ID they are addressed with.
 *
 * Response shapes and pre-season behaviour are documented in `agents/API.md`.
 * Nothing in here is bundled for the browser — see the `server-only` import.
 */

/** Draft game API. Powers standings, entries, picks and gameweek scoring. */
const DRAFT_API = 'https://draft.premierleague.com/api';

/** Classic FPL API. Powers the static dataset (teams, elements) and fixtures. */
const FANTASY_API = 'https://fantasy.premierleague.com/api';

/**
 * The Pulse API behind premierleague.com. The real league table and the real
 * fixture list — neither of which either FPL game can answer.
 *
 * It is here rather than in a module of its own because this file's job is to
 * be the *one* place an upstream URL is written, and "upstream" is a boundary,
 * not a vendor. Its own quirks are documented on the builders below.
 */
const PULSE_API = 'https://footballapi.pulselive.com/football';

/**
 * Pulse rejects a request with no `Origin` it recognises. Nothing else is
 * needed — no key, no cookie — and the header is only meaningful server-side,
 * which this module already is.
 *
 * It lives on the Pulse builders below rather than at any call site, so a
 * Pulse read without it is unrepresentable. A call that forgets the header
 * does not fail loudly — it comes back `403` and reads as "the Premier League
 * page is down".
 */
const PULSE_HEADERS: Record<string, string> = {
  Origin: 'https://www.premierleague.com',
};

/**
 * One upstream request: where it goes, what it carries, what to call it.
 *
 * Every builder in `fplApi` and `pulseApi` returns one of these rather than a
 * bare URL, so anything an endpoint requires travels with the endpoint. The
 * `label` is the short name failures log under — a failure names its endpoint
 * instead of printing a URL with a league ID in it.
 */
export interface UpstreamRequest {
  url: string;
  headers?: Record<string, string>;
  label: string;
}

const LEAGUE_ID_VAR = 'FPL_LEAGUE_ID';

/**
 * Ten seconds, on every upstream read.
 *
 * `fetch` has no timeout of its own, so without this a connection that never
 * answers stays open until the platform kills the invocation, and a promise
 * waiting on it never settles. That is survivable inside one request, which
 * fails with it. It is not survivable when the promise is one this app shares
 * between requests: see `withDeadline` in `src/utils/deadline.ts` for
 * how a never-settling read pins a page in its skeleton.
 *
 * Ten seconds is generous. Pulse answers in under 300ms and the draft API in
 * about a second; anything near this number is already broken, and an error the
 * reader can retry beats a skeleton that never resolves.
 *
 * It only means anything because these reads are `no-store`: a cached fetch
 * waits on Next's per-URL lock *before* the request goes out, so a signal
 * started here would be timing the queue rather than the network. See
 * `fetchUpstream`.
 */
const UPSTREAM_TIMEOUT_MS = 10_000;

/** The abort signal every upstream `fetch` in this app carries. */
export function upstreamSignal(): AbortSignal {
  return AbortSignal.timeout(UPSTREAM_TIMEOUT_MS);
}

/**
 * One fresh connection per upstream read, closed when the response lands.
 *
 * `pipelining: 0` is undici's "no keep-alive" for HTTP/1.1: the request goes
 * out with `connection: close` and the socket is destroyed once it completes,
 * so nothing about a finished read outlives it, and that is the entire point.
 * The default pool keeps idle sockets to reuse, which is exactly the state a
 * serverless pause corrupts. The sign-in burst prefetches every page in the
 * nav, one of those renders opens a connection to Pulse, and the instance is
 * then paused with that socket in its pool. The far end gives up on it during
 * the pause — but the FIN or RST arrives while nothing is listening, so on
 * resume undici still believes the socket is alive, writes the next request
 * into the void, and waits. That was `/premier-league` timing out after
 * exactly ten seconds on the first click of every session while a reload
 * beside it answered in 300ms: the click reused the corpse (and, by timing
 * out, destroyed it), the reload got the fresh connection the click should
 * have had.
 *
 * `pipelining: 0` alone was not enough, and that is why this line also says
 * `allowH2: false`. Pulse negotiates HTTP/2 — measured `http=2` against
 * `footballapi.pulselive.com` — and undici documents that `pipelining` "has no
 * effect once HTTP/2 is negotiated". The H2 session stayed pooled in this
 * singleton across requests, froze and died exactly like the H1 socket before
 * it, and the first click per session hung the same ten seconds while a
 * reload worked. `allowH2: false` holds ALPN to `http/1.1` only, so every read
 * is H1 with `connection: close`. Measured H1 against Pulse at ~200ms cold,
 * against ~600ms over H2, so reuse was buying nothing here either.
 *
 * This is the fourth face of the same law — never share state across requests
 * that only makes sense inside one. First the memoised promise, then the
 * dedup slot, then the H1 socket pool, now the H2 session: each fix moved the
 * sharing down a layer and the pause corrupted the next one. A TCP connection
 * or session is request-scoped state here, so it is not kept.
 *
 * The price is a TLS handshake per read — one to three reads per page miss,
 * against caches measured in minutes. Pulse answers in ~200ms cold including
 * the handshake; reuse was buying nothing and costing the page.
 *
 * `undici`'s own `fetch` rather than the global: Node's bundled fetch rejects
 * a dispatcher built by a different undici major (`invalid onRequestStart`),
 * so the agent and the fetch must come from the same package. Bypassing
 * Next's patched fetch also loses nothing — these reads were `no-store`
 * precisely so that patch would do nothing.
 */
const freshConnectionAgent = new Agent({ pipelining: 0, allowH2: false });

/**
 * The one door every upstream read leaves through.
 *
 * Returns the raw `Response`, for the callers that must read a status before
 * a body — `event-status` 404s with a bare string, `entryEvent` 404s meaning
 * "no picks yet". `fetchUpstream` below is the JSON-or-throw wrapper over it.
 *
 * A caller may bring its own `signal` (the cron job runs a longer deadline
 * and owns its own retry); everyone else gets a fresh `upstreamSignal()` per
 * attempt. Both the fresh connection and the timeout are applied here so no
 * call site can forget either.
 *
 * A throw from `fetch` itself — a timeout, a reset connection, a transient
 * `fetch failed` of the kind the sync job already retries around — is retried
 * once, immediately, on a new signal. The first signal may have fired to cause
 * the throw, so reusing it would reject before touching the network. An HTTP
 * error status is **not** retried: that is upstream's verdict on the request,
 * and a second attempt cannot change it. Neither is a caller-provided signal
 * retried: aborting it was the caller's decision.
 */
export async function upstreamFetch(
  req: UpstreamRequest,
  init?: { signal?: AbortSignal },
): ReturnType<typeof undiciFetch> {
  if (init?.signal) {
    return undiciFetch(req.url, {
      headers: req.headers,
      signal: init.signal,
      dispatcher: freshConnectionAgent,
    });
  }

  try {
    return await undiciFetch(req.url, {
      headers: req.headers,
      signal: upstreamSignal(),
      dispatcher: freshConnectionAgent,
    });
  } catch (error) {
    console.error(`[upstream] ${req.label} failed; retrying once.`, error);

    return undiciFetch(req.url, {
      headers: req.headers,
      signal: upstreamSignal(),
      dispatcher: freshConnectionAgent,
    });
  }
}

/**
 * Draft league IDs are season-scoped — a renewed league gets a fresh ID every
 * August — so the ID is read from the environment, never hard-coded.
 *
 * Read lazily (rather than at module scope) so a missing value fails the
 * request that needs it, not `next build`.
 */
export function getLeagueId(): number {
  const raw = process.env[LEAGUE_ID_VAR];

  if (!raw) {
    throw new Error(
      `${LEAGUE_ID_VAR} is not set. Copy .env.example to .env.local and set it to ` +
        'your draft league ID (the number in your draft.premierleague.com league URL).',
    );
  }

  const leagueId = Number(raw);

  if (!Number.isInteger(leagueId) || leagueId <= 0) {
    throw new Error(
      `${LEAGUE_ID_VAR} must be a positive integer, received "${raw}".`,
    );
  }

  return leagueId;
}

/**
 * Read one upstream endpoint as JSON, or throw.
 *
 * The only sanctioned way to assert an upstream payload's shape, so the cast
 * happens in one place and every caller gets the same error format. Endpoints
 * with a documented non-JSON failure mode — `event-status` answers 404 with a
 * bare string — need their own handling rather than this.
 *
 * **`no-store`, deliberately: caching is `cachedRead`'s job and only its job.**
 * These reads used to carry `next: { revalidate }` as well, which put Next's
 * per-URL Data Cache underneath a layer that was already caching the finished
 * result on the same TTL — the same data kept three times, and the third copy
 * cost a page.
 *
 * Any fetch with a positive `revalidate` takes Next's cached path, and that
 * path opens with `await incrementalCache.lock(cacheKey)` before it touches
 * the network (`patch-fetch.js`). A request aborted mid-fetch — a discarded
 * prefetch, a navigation the reader moved on from — can leave that per-URL lock
 * held, and the next render simply waits on it. On `/premier-league` that was
 * ten seconds of skeleton followed by "the feed could not be reached", while a
 * reload beside it loaded instantly: the lock made the *second* caller pay, and
 * the timeout below, started before the lock wait, expired on queueing rather
 * than on anything the network did. Pulse answers in under 300ms, cold, every
 * time.
 *
 * So the timeout now measures what a timeout should measure, and there is one
 * cache instead of two.
 *
 * `upstreamFetch` sidesteps Next's fetch patching entirely, which is what
 * `cache: 'no-store'` was opting out of, so that option goes with it.
 */
export async function fetchUpstream<T>(req: UpstreamRequest): Promise<T> {
  const res = await upstreamFetch(req);

  if (!res.ok) {
    throw new Error(`${req.label} failed with ${res.status}`);
  }

  return (await res.json()) as T;
}

export const fplApi = {
  /**
   * Per-gameweek processing status for the draft game.
   * Returns HTTP 404 with the bare string `"Game not started"` before the
   * season begins — always go through `fetchEventStatus` rather than calling
   * this directly.
   */
  eventStatus: (): UpstreamRequest => ({
    url: `${DRAFT_API}/pl/event-status`,
    label: 'draft event-status',
  }),

  /**
   * Draft game state (`current_event`, `next_event`, `processing_status`).
   * Available year-round, including pre-season, so it is the reliable way to
   * ask "has the season started?".
   */
  game: (): UpstreamRequest => ({
    url: `${DRAFT_API}/game`,
    label: 'draft game',
  }),

  /** League metadata, its entries, and standings. */
  leagueDetails: (leagueId: number): UpstreamRequest => ({
    url: `${DRAFT_API}/league/${leagueId}/details`,
    label: 'draft league details',
  }),

  /** Live per-element stats for one gameweek, keyed by element ID. */
  eventLive: (gameweek: number): UpstreamRequest => ({
    url: `${DRAFT_API}/event/${gameweek}/live`,
    label: `draft event ${gameweek} live`,
  }),

  /**
   * Who currently owns each element: `{ element, owner, status }`.
   *
   * The right source for squads — it reflects trades and waivers, and it works
   * before GW1, unlike `entryEvent`. **`owner` is an `entry_id`**, not the
   * league entry.
   */
  elementStatus: (leagueId: number): UpstreamRequest => ({
    url: `${DRAFT_API}/league/${leagueId}/element-status`,
    label: 'draft element-status',
  }),

  /** Every pick made in the draft, in order. A historical record only. */
  draftChoices: (leagueId: number): UpstreamRequest => ({
    url: `${DRAFT_API}/draft/${leagueId}/choices`,
    label: 'draft choices',
  }),

  /**
   * The draft game's static dataset: elements, teams, element types.
   *
   * **No trailing slash** — adding one 404s here, the exact inverse of the
   * classic API below. Draft element IDs must be resolved against this, never
   * against the classic bootstrap: the two disagree on ~21 of 581 elements.
   */
  draftBootstrap: (): UpstreamRequest => ({
    url: `${DRAFT_API}/bootstrap-static`,
    label: 'draft bootstrap-static',
  }),

  /**
   * One entry's picks for one gameweek.
   * 404s with `"No pick history"` until that entry has played a gameweek.
   *
   * Takes the `entry_id`, **not** the `league_entries[].id` we use as the
   * player ID everywhere else. Passing the wrong one 404s, which this app
   * swallows as "no picks" — so the gameweek would vanish rather than fail
   * loudly. Hence the branded parameter type.
   */
  entryEvent: (entryId: EntryId, gameweek: number): UpstreamRequest => ({
    url: `${DRAFT_API}/entry/${entryId}/event/${gameweek}`,
    label: `draft entry event GW${gameweek}`,
  }),

  /**
   * The full classic-FPL static dataset: teams, events, elements.
   * The trailing slash is required — without it the API answers 301.
   */
  bootstrapStatic: (): UpstreamRequest => ({
    url: `${FANTASY_API}/bootstrap-static/`,
    label: 'classic bootstrap-static',
  }),

  /**
   * All 380 Premier League fixtures for the season.
   * The trailing slash is required — without it the API answers 301.
   */
  fixtures: (): UpstreamRequest => ({
    url: `${FANTASY_API}/fixtures/`,
    label: 'classic fixtures',
  }),
} as const;

/**
 * The Pulse API — the real Premier League, as premierleague.com renders it.
 *
 * Each builder carries the `Origin` header Pulse insists on, so every Pulse
 * read goes through the same `fetchUpstream` as the two FPL games — there is
 * no separate Pulse reader to remember.
 *
 * **`compSeasonId` is season-scoped, exactly like the draft league ID**, so it
 * is never written down. `pulseApi.compSeasons()` lists them and
 * `getCompSeasonId()` in `premier-league-data.ts` picks the newest. Do not be
 * tempted to parse the labels to find it: they are not one format. The current
 * season reads `"English Premier League Season 2026/2027"` while the one before
 * it reads `"2025/26"`.
 */
export const pulseApi = {
  /**
   * Every Premier League season Pulse knows, newest first, as `{ id, label }`.
   * Competition `1` is the Premier League.
   */
  compSeasons: (): UpstreamRequest => ({
    url: `${PULSE_API}/competitions/1/compseasons?pageSize=50`,
    headers: PULSE_HEADERS,
    label: 'Pulse seasons',
  }),

  /**
   * The league table. `detail=2` is what adds `form`, `annotations` and the
   * home/away splits; without it you get positions and totals only.
   *
   * Out of season this returns all 20 clubs on zero with `tables[0].gameWeek`
   * of `0` — **not** an empty array. Guard on `gameWeek`, never on length.
   */
  standings: (compSeasonId: number): UpstreamRequest => ({
    url: `${PULSE_API}/standings?compSeasons=${compSeasonId}&altIds=true&detail=2`,
    headers: PULSE_HEADERS,
    label: 'Pulse standings',
  }),

  /**
   * All 380 fixtures in one response — `pageSize` of 400 returns `numPages: 1`,
   * so this never needs paging. `statuses=U,L,C` asks for upcoming, live and
   * complete, which is everything.
   */
  fixtures: (compSeasonId: number): UpstreamRequest => ({
    url:
      `${PULSE_API}/fixtures?comps=1&compSeasons=${compSeasonId}` +
      '&pageSize=400&page=0&sort=asc&statuses=U,L,C&altIds=true',
    headers: PULSE_HEADERS,
    label: 'Pulse fixtures',
  }),
} as const;

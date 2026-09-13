import type { EventLive } from '@/interfaces/fpl';

import { hasBeenPlayed } from './scoring';

/**
 * The seven known upstream traps as named probes.
 *
 * Pure, like `scoring.ts` and `season-state.ts`: each probe is a function of
 * its argument and returns pass or fail with bounded evidence, so every trap
 * is independently testable. The draft subset gates finalisation before the
 * write; the Pulse subset annotates the existing loud failure, since Pulse
 * has no fallback by design.
 *
 * Probes gate, they never throw. A failed probe refuses the write while the
 * read carries on, following the `rejectUnfinalisable` precedent. Malformed
 * or missing inputs fail closed: a probe that cannot recognise its input
 * fails it, and never passes an unknown shape.
 *
 * Observed payloads for every trap below live in `agents/API.md`, which names
 * the consuming function beside each one.
 */

/** Uniform probe result: name, pass flag, and bounded evidence. */
export interface TripwireResult {
  name: string;
  pass: boolean;
  evidence: string;
}

/**
 * Evidence snippets are truncated to this many characters, plus short named
 * field values. Upstream payloads carry no credentials, but logs stay
 * readable only when the offending snippet is bounded.
 */
export const TRIPWIRE_EVIDENCE_MAX_CHARS = 500;

/**
 * Bound a string to a readable length.
 *
 * The one truncation rule: probe evidence, gate evidence and stored block
 * reasons all share the budget above and differ only in suffix, so the length
 * check lives here once. Callers keep their own suffix — probe logs name the
 * cut, the cron detail does not, and the stored block reason carries none.
 */
export function truncateText(
  text: string,
  max: number = TRIPWIRE_EVIDENCE_MAX_CHARS,
  suffix: string = '...',
): string {
  return text.length > max ? `${text.slice(0, max)}${suffix}` : text;
}

/** Raw parsed body of `/api/pl/event-status`, before any mapping. */
export type EventStatusBody = unknown;

/** Raw parsed body of `/api/event/{gw}/live`. */
export type LiveBody = unknown;

/** League details payload carrying `league_entries` and `standings`. */
export type LeagueDetailsBody = unknown;

/** Raw parsed Pulse standings response. */
export type PulseStandingsBody = unknown;

/** Raw parsed Pulse competition seasons response. */
export type PulseSeasonsBody = unknown;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** The offending payload as a bounded snippet for logs and cron detail. */
function snippet(value: unknown): string {
  let raw: string;

  try {
    raw =
      typeof value === 'string'
        ? value
        : (JSON.stringify(value) ?? String(value));
  } catch {
    raw = String(value);
  }

  return truncateText(raw, TRIPWIRE_EVIDENCE_MAX_CHARS, '... (truncated)');
}

/**
 * The event status body is an object with a status array.
 *
 * Out of season `/api/pl/event-status` 404s with the bare string
 * `Game not started`, not an object. Destructuring that throws further down
 * the line, so the probe fails it here with the string attached.
 */
export function probeEventStatusShape(body: EventStatusBody): TripwireResult {
  const name = 'event-status-shape';

  if (isRecord(body) && Array.isArray(body.status)) {
    return {
      name,
      pass: true,
      evidence: `status array with ${body.status.length} rows`,
    };
  }

  return {
    name,
    pass: false,
    evidence: `expected { status: [...] }, saw ${snippet(body)}`,
  };
}

/**
 * Every event status row carries the inputs the every row rule needs.
 *
 * `deriveSeasonState` finalises only when every row for the gameweek says
 * `leagues_updated`, so a row missing `event`, `date` or `leagues_updated`
 * (a renamed field upstream, a partial payload) must block rather than read
 * as agreement. An empty array passes: with no rows the decider, not the
 * probe, refuses the verdict.
 */
export function probeEventStatusRows(body: EventStatusBody): TripwireResult {
  const name = 'event-status-rows';

  if (!isRecord(body) || !Array.isArray(body.status)) {
    return {
      name,
      pass: false,
      evidence: `no status array to check: ${snippet(body)}`,
    };
  }

  const rows: unknown[] = body.status;
  const badIndex = rows.findIndex(
    (row) =>
      !isRecord(row) ||
      typeof row.event !== 'number' ||
      typeof row.date !== 'string' ||
      typeof row.leagues_updated !== 'boolean',
  );

  if (badIndex !== -1) {
    return {
      name,
      pass: false,
      evidence: `row ${badIndex} of ${rows.length} is missing the every row rule inputs: ${snippet(rows[badIndex])}`,
    };
  }

  return {
    name,
    pass: true,
    evidence: `${rows.length} rows carry event, date and leagues_updated`,
  };
}

/**
 * The live feed names at least one element.
 *
 * For an unscored gameweek `elements` is `{}`, which is truthy, so a naive
 * guard scores every manager on nil points and ties them all first. The key
 * count catches that shape; the played probe below catches the fuller one.
 */
export function probeLiveElementsPresent(liveData: LiveBody): TripwireResult {
  const name = 'live-elements-present';

  if (isRecord(liveData) && isRecord(liveData.elements)) {
    const count = Object.keys(liveData.elements).length;

    if (count > 0) {
      return { name, pass: true, evidence: `${count} elements in the feed` };
    }

    return {
      name,
      pass: false,
      evidence: `elements is {}, the unscored shape: ${snippet(liveData)}`,
    };
  }

  return {
    name,
    pass: false,
    evidence: `no elements object to score: ${snippet(liveData)}`,
  };
}

/**
 * Someone has actually taken the field in the live feed.
 *
 * The harder trap: once a gameweek's fixtures exist, the feed lists every
 * element in the game on nil minutes hours before kickoff, which the key
 * count above cannot tell from a scored week. The verdict is
 * `hasBeenPlayed`'s, applied per element so the evidence count and the pass
 * flag cannot disagree.
 */
export function probeLiveElementsPlayed(liveData: LiveBody): TripwireResult {
  const name = 'live-elements-played';

  if (!isRecord(liveData) || !isRecord(liveData.elements)) {
    return {
      name,
      pass: false,
      evidence: `no elements object to read minutes from: ${snippet(liveData)}`,
    };
  }

  const elements = liveData.elements;
  const keys = Object.keys(elements);
  const played = keys.filter((key) =>
    hasBeenPlayed({ elements: { [key]: elements[key] } } as EventLive),
  ).length;

  if (played > 0) {
    return {
      name,
      pass: true,
      evidence: `${played} of ${keys.length} elements have played`,
    };
  }

  return {
    name,
    pass: false,
    evidence: `${keys.length} elements and none has played, the pre kickoff shape`,
  };
}

/**
 * Every standings row resolves to a known league entry id.
 *
 * `league_entries[].id` and `league_entries[].entry_id` are different numbers
 * for the same manager, and `standings[].league_entry` must match the first.
 * A row pointing at an `entry_id` (a team, for `/api/entry/...` URLs) finds
 * no manager and renders Unknown, or 404s the gameweek away. Evidence names
 * the swap when it recognises it.
 */
export function probeStandingsIdentity(
  details: LeagueDetailsBody,
): TripwireResult {
  const name = 'standings-identity';

  if (
    !isRecord(details) ||
    !Array.isArray(details.league_entries) ||
    !Array.isArray(details.standings)
  ) {
    return {
      name,
      pass: false,
      evidence: `expected league_entries and standings arrays: ${snippet(details)}`,
    };
  }

  const knownIds = new Set<number>();
  const teamIds = new Set<number>();

  for (const entry of details.league_entries) {
    if (isRecord(entry) && typeof entry.id === 'number') {
      knownIds.add(entry.id);
    }
    if (isRecord(entry) && typeof entry.entry_id === 'number') {
      teamIds.add(entry.entry_id);
    }
  }

  const wanted: number[] = [];

  for (const row of details.standings) {
    if (!isRecord(row) || typeof row.league_entry !== 'number') {
      return {
        name,
        pass: false,
        evidence: `a standings row has no numeric league_entry: ${snippet(row)}`,
      };
    }
    wanted.push(row.league_entry);
  }

  const unknown = wanted.filter((id) => !knownIds.has(id));

  if (unknown.length > 0) {
    const shown = unknown.slice(0, 8).join(', ');
    const swapped = unknown.filter((id) => teamIds.has(id));

    return {
      name,
      pass: false,
      evidence:
        `${unknown.length} of ${wanted.length} standings rows reference ` +
        `unknown league entries (${shown})` +
        (swapped.length > 0
          ? `; ${swapped.length} match team ids, not league entry ids`
          : `; known entries: ${knownIds.size}`),
    };
  }

  return {
    name,
    pass: true,
    evidence: `${wanted.length} standings rows resolve to known league entries`,
  };
}

/**
 * Pulse has started its season: `tables[0].gameWeek` is above zero.
 *
 * Out of season Pulse returns all 20 clubs on nil points rather than an
 * empty array, so a length check answers that there is a table about a page
 * of noughts. Same rule as `hasSeasonStarted` in `premier-league.ts`, stated
 * here so the probe and the page cannot drift.
 */
export function probePulseSeasonStarted(
  standings: PulseStandingsBody,
): TripwireResult {
  const name = 'pulse-season-started';

  if (
    !isRecord(standings) ||
    !Array.isArray(standings.tables) ||
    !isRecord(standings.tables[0])
  ) {
    return {
      name,
      pass: false,
      evidence: `no Pulse table to read gameWeek from: ${snippet(standings)}`,
    };
  }

  const table = standings.tables[0];
  const gameWeek: unknown = table.gameWeek;
  const entryCount = Array.isArray(table.entries) ? table.entries.length : 0;

  if (typeof gameWeek === 'number' && gameWeek > 0) {
    return {
      name,
      pass: true,
      evidence: `gameWeek ${gameWeek} with ${entryCount} entries`,
    };
  }

  return {
    name,
    pass: false,
    evidence: `gameWeek ${snippet(gameWeek)} with ${entryCount} entries: the pre season page of noughts`,
  };
}

/**
 * A Pulse season can be chosen by highest id.
 *
 * Season labels are not one format (`English Premier League Season
 * 2026/2027` sits above `2025/26` in the same response), so any parse of
 * them is a bug waiting for next August. Same rule as `newestCompSeasonId`
 * in `premier-league.ts`: the probe passes when at least one finite numeric
 * id exists to select, and its evidence names the selection.
 */
export function probePulseSeasonSelectable(
  compSeasons: PulseSeasonsBody,
): TripwireResult {
  const name = 'pulse-season-selectable';

  if (!isRecord(compSeasons) || !Array.isArray(compSeasons.content)) {
    return {
      name,
      pass: false,
      evidence: `no compSeasons content to choose from: ${snippet(compSeasons)}`,
    };
  }

  const ids: number[] = [];

  for (const season of compSeasons.content) {
    if (
      isRecord(season) &&
      typeof season.id === 'number' &&
      Number.isFinite(season.id)
    ) {
      ids.push(season.id);
    }
  }

  if (ids.length === 0) {
    return {
      name,
      pass: false,
      evidence: `no numeric season id in ${compSeasons.content.length} listed seasons: ${snippet(compSeasons)}`,
    };
  }

  const selected = Math.max(...ids);

  return {
    name,
    pass: true,
    evidence: `selected season ${selected} by highest id from ${ids.length} listed`,
  };
}

/** The inputs the draft probes read, before any mapping. */
export interface DraftProbeInputs {
  /** Raw parsed body of `/api/pl/event-status`. */
  eventStatusBody: EventStatusBody;
  /** Raw parsed body of `/api/event/{gw}/live`. */
  liveData: LiveBody;
  /** League details payload carrying `league_entries` and `standings`. */
  leagueDetails: LeagueDetailsBody;
}

/**
 * The draft subset: five probes that gate finalisation before the write.
 * Never throws; missing inputs fail every probe rather than erroring.
 */
export function runDraftProbes(inputs: DraftProbeInputs): TripwireResult[] {
  const safe: DraftProbeInputs = inputs ?? {
    eventStatusBody: undefined,
    liveData: undefined,
    leagueDetails: undefined,
  };

  return [
    probeEventStatusShape(safe.eventStatusBody),
    probeEventStatusRows(safe.eventStatusBody),
    probeLiveElementsPresent(safe.liveData),
    probeLiveElementsPlayed(safe.liveData),
    probeStandingsIdentity(safe.leagueDetails),
  ];
}

/**
 * The Pulse subset: two probes that annotate, never block. Pulse has no
 * fallback by design, so these attach the reason to the failure the page
 * already raises. Never throws.
 */
export function runPulseProbes(
  standings: PulseStandingsBody,
  compSeasons: PulseSeasonsBody,
): TripwireResult[] {
  return [
    probePulseSeasonStarted(standings),
    probePulseSeasonSelectable(compSeasons),
  ];
}

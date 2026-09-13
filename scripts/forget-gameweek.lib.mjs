/**
 * Pure validation for `scripts/forget-gameweek.mjs`.
 *
 * Everything here takes explicit values and returns data or throws
 * {@link UsageError} — no `process` access, no database, no network — so
 * Vitest can pin the guardrails without touching a real branch.
 */

/** Lowest playable gameweek number. */
export const MIN_GAMEWEEK = 1;

/** Highest playable gameweek number in a Premier League season. */
export const MAX_GAMEWEEK = 38;

/** Delete this to forget; anything else refuses to run. */
export const PROD_FLAG = '--prod';

/** Delete nothing without this; dry run is the default. */
export const APPLY_FLAG = '--apply';

/**
 * Every table holding rows for one league plus gameweek slice, in deletion
 * order. `finalisation_candidates` rides along so a forgotten gameweek is
 * genuinely refetched through the two-phase path rather than confirmed from
 * a stale candidate — and `ownership_snapshots` rides along because snapshot
 * writes are first-write-wins: a stale snapshot would block the re-snapshot
 * of the corrected gameweek forever.
 *
 * @type {string[]}
 */
export const TABLES = [
  'gameweek_scores',
  'gameweeks',
  'ownership_snapshots',
  'finalisation_candidates',
];

/** Thrown for any input the script must refuse to act on. */
export class UsageError extends Error {
  /**
   * @param {string} message
   */
  constructor(message) {
    super(message);
    this.name = 'UsageError';
  }
}

/**
 * @typedef {object} ForgetTarget
 * @property {'sandbox' | 'PRODUCTION'} name
 * @property {string} url
 * @property {string} connectionVar
 */

/**
 * @typedef {object} ForgetOptions
 * @property {number} gameweek
 * @property {boolean} useProd
 * @property {boolean} apply
 */

/**
 * @typedef {object} HelpOptions
 * @property {true} help
 */

/**
 * @typedef {object} ForgetSlice
 * @property {number} leagueId
 * @property {number} gameweek
 * @property {string[]} tables
 * @property {string} label
 */

/**
 * Accept an integer gameweek in range, reject everything else.
 *
 * @param {unknown} raw
 * @returns {number}
 * @throws {UsageError}
 */
export function parseGameweek(raw) {
  const gameweek = typeof raw === 'number' ? raw : Number(raw);

  if (
    !Number.isInteger(gameweek) ||
    gameweek < MIN_GAMEWEEK ||
    gameweek > MAX_GAMEWEEK
  ) {
    throw new UsageError(
      `Invalid gameweek "${String(raw)}": expected an integer ` +
        `${MIN_GAMEWEEK}..${MAX_GAMEWEEK}.`,
    );
  }

  return gameweek;
}

/**
 * Accept a positive integer league id, reject everything else.
 *
 * @param {unknown} raw
 * @returns {number}
 * @throws {UsageError}
 */
export function parseLeagueId(raw) {
  const leagueId = typeof raw === 'number' ? raw : Number(raw);

  if (!Number.isInteger(leagueId) || leagueId <= 0) {
    throw new UsageError('FPL_LEAGUE_ID is not set to a positive integer.');
  }

  return leagueId;
}

/**
 * Resolve which branch the script may touch. Sandbox is the default;
 * production is reachable only behind the explicit prod flag, and a missing
 * connection string for the chosen target is a refusal, never a fallback.
 *
 * @param {object} args
 * @param {boolean} args.prodFlag
 * @param {string | undefined} args.sandboxUrl
 * @param {string | undefined} args.prodUrl
 * @returns {ForgetTarget}
 * @throws {UsageError}
 */
export function resolveTarget({ prodFlag, sandboxUrl, prodUrl }) {
  if (prodFlag) {
    if (!prodUrl) {
      throw new UsageError('NEON_CONNECTION_STRING_PROD is not set.');
    }

    return {
      name: 'PRODUCTION',
      url: prodUrl,
      connectionVar: 'NEON_CONNECTION_STRING_PROD',
    };
  }

  if (!sandboxUrl) {
    throw new UsageError('NEON_CONNECTION_STRING_SANDBOX is not set.');
  }

  return {
    name: 'sandbox',
    url: sandboxUrl,
    connectionVar: 'NEON_CONNECTION_STRING_SANDBOX',
  };
}

/**
 * Parse CLI arguments. Exactly one positional (the gameweek) plus any of the
 * known flags; `--help` wins over everything else, unknown flags refuse.
 *
 * @param {string[]} argv
 * @returns {ForgetOptions | HelpOptions}
 * @throws {UsageError}
 */
export function parseArgs(argv) {
  if (argv.includes('--help') || argv.includes('-h')) {
    return { help: true };
  }

  let useProd = false;
  let apply = false;
  const positionals = [];

  for (const arg of argv) {
    if (arg === PROD_FLAG) {
      useProd = true;
    } else if (arg === APPLY_FLAG) {
      apply = true;
    } else if (arg.startsWith('-')) {
      throw new UsageError(`Unknown flag "${arg}".`);
    } else {
      positionals.push(arg);
    }
  }

  if (positionals.length === 0) {
    throw new UsageError('Missing gameweek.');
  }

  if (positionals.length > 1) {
    throw new UsageError(
      `Expected one gameweek, received ${positionals.length}.`,
    );
  }

  return { gameweek: parseGameweek(positionals[0]), useProd, apply };
}

/**
 * Describe the exact slice a run may delete: one league plus one gameweek
 * across every table that holds rows for it.
 *
 * @param {number} leagueId
 * @param {number} gameweek
 * @returns {ForgetSlice}
 */
export function sliceDescriptor(leagueId, gameweek) {
  return {
    leagueId,
    gameweek,
    tables: [...TABLES],
    label: `GW${gameweek} for league ${leagueId}`,
  };
}

/**
 * Help text documenting the guarded procedure: dry run default, explicit
 * apply, prod flag, then one revalidate run.
 *
 * @returns {string}
 */
export function usage() {
  return [
    'Usage: node --env-file=.env.local scripts/forget-gameweek.mjs',
    `  <gameweek ${MIN_GAMEWEEK}..${MAX_GAMEWEEK}> [${APPLY_FLAG}] [${PROD_FLAG}]`,
    '',
    'Deletes one league plus gameweek slice (scores, finalised marker,',
    'ownership snapshot, and finalisation candidate) so the next read',
    'refetches it from the API.',
    '',
    'Dry run by default: prints the slice and row counts, deletes nothing.',
    `Pass ${APPLY_FLAG} to delete. Pass ${PROD_FLAG} to target production;`,
    'without it the script only ever touches the sandbox branch.',
    '',
    'After an apply, trigger one revalidate run so the gameweek comes back',
    'through the two-phase path:',
    '  curl -X POST -H "Authorization: Bearer $CRON_SECRET" \\',
    '    <site>/api/cron/revalidate',
  ].join('\n');
}

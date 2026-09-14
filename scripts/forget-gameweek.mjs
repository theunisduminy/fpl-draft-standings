/**
 * Delete a stored gameweek so the app refetches and re-scores it.
 *
 *   node --env-file=.env.local scripts/forget-gameweek.mjs <gameweek> [--apply] [--prod]
 *
 * A gameweek in `gameweeks` is a claim that its result will never change again,
 * and the insert behind it is `onConflictDoNothing` — so a gameweek stored
 * wrongly cannot be corrected by any later run of the app. This is the escape
 * hatch, and it is a script rather than a page because it is an administrative
 * act on a table of facts.
 *
 * **Why it exists.** GW1 of 2026/27 was written on the Friday evening, before a
 * ball was kicked, as eight managers on zero points and joint first — paying
 * every one of them a win and 20 F1 points, permanently. Two upstream shapes
 * conspired: `/pl/event-status` has one row per *date*, so three of GW1's four
 * rows saying `leagues_updated` read as "gameweek complete"; and the live feed
 * lists every element on zero once the fixtures exist, so counting its keys
 * said "scored". Both are fixed in `season-state.ts` and `scoring.ts`, and
 * `rejectUnfinalisable` now refuses the write — but the row already written had
 * to be removed by hand.
 *
 * Guarded by default: a dry run prints the slice and row counts and deletes
 * nothing. Pass `--apply` to delete, and `--prod` to target production —
 * without it the script only ever touches the sandbox branch.
 */

import { neon } from '@neondatabase/serverless';

import {
  parseArgs,
  parseLeagueId,
  resolveTarget,
  sliceDescriptor,
  usage,
  UsageError,
} from './forget-gameweek.lib.mjs';

function fail(error) {
  console.error(error instanceof UsageError ? error.message : error);
  console.error(usage());
  process.exit(1);
}

let options;
try {
  options = parseArgs(process.argv.slice(2));
} catch (error) {
  fail(error);
}

if (options.help) {
  console.log(usage());
  process.exit(0);
}

let leagueId;
try {
  leagueId = parseLeagueId(process.env.FPL_LEAGUE_ID);
} catch (error) {
  fail(error);
}

let target;
try {
  target = resolveTarget({
    prodFlag: options.useProd,
    sandboxUrl: process.env.NEON_CONNECTION_STRING_SANDBOX,
    prodUrl: process.env.NEON_CONNECTION_STRING_PROD,
  });
} catch (error) {
  fail(error);
}

const sql = neon(target.url);
const slice = sliceDescriptor(leagueId, options.gameweek);

// Printed before deleting, not after. The rows are the only record of what was
// there, so a run that turns out to have been aimed at the wrong gameweek at
// least leaves the numbers in the terminal.
const rows = await sql`
  select league_entry, points, rank
  from gameweek_scores
  where league_id = ${leagueId} and gameweek = ${options.gameweek}
  order by rank
`;

const markers = await sql`
  select gameweek, finalised_at
  from gameweeks
  where league_id = ${leagueId} and gameweek = ${options.gameweek}
`;

const candidates = await sql`
  select gameweek, fingerprint, first_seen, last_checked, block_reason
  from finalisation_candidates
  where league_id = ${leagueId} and gameweek = ${options.gameweek}
`;

// Counted, never printed: a snapshot is ~581 narrow rows, and the dry run
// exists to confirm the slice, not to dump it.
const snapshots = await sql`
  select element_code
  from ownership_snapshots
  where league_id = ${leagueId} and gameweek = ${options.gameweek}
`;

if (
  rows.length === 0 &&
  markers.length === 0 &&
  candidates.length === 0 &&
  snapshots.length === 0
) {
  console.log(
    `No stored rows for ${slice.label} on ${target.name}. Nothing to do.`,
  );
  process.exit(0);
}

console.log(`Target: ${target.name} (${target.connectionVar}).`);
console.log(
  `${slice.label}: ${rows.length} score row(s), ` +
    `${markers.length} finalised marker(s), ` +
    `${snapshots.length} snapshot row(s), ` +
    `${candidates.length} candidate row(s).`,
);

if (rows.length > 0) {
  console.table(rows);
}

if (candidates.length > 0) {
  console.table(candidates);
}

if (!options.apply) {
  console.log('Dry run: nothing deleted. Re-run with --apply to delete.');
  process.exit(0);
}

// One non-interactive transaction: a crash between deletes must not leave
// scores deleted with the finalised marker kept, or vice versa. Re-running
// the script converges a half-applied delete.
await sql.transaction([
  sql`
    delete from gameweek_scores
    where league_id = ${leagueId} and gameweek = ${options.gameweek}
  `,
  sql`
    delete from gameweeks
    where league_id = ${leagueId} and gameweek = ${options.gameweek}
  `,
  sql`
    delete from ownership_snapshots
    where league_id = ${leagueId} and gameweek = ${options.gameweek}
  `,
  sql`
    delete from finalisation_candidates
    where league_id = ${leagueId} and gameweek = ${options.gameweek}
  `,
]);

console.log(
  `Deleted ${slice.label} from ${slice.tables.join(', ')}. ` +
    'The next read recomputes it through the two-phase path.',
);
console.log(
  'Trigger one revalidate run now with the CRON_SECRET bearer token:',
);
console.log(
  '  curl -X POST -H "Authorization: Bearer $CRON_SECRET" ' +
    '<site>/api/cron/revalidate',
);
console.log('or just load the site.');
